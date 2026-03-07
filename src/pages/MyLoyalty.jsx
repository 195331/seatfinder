import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Gift, Star, Award, History, Copy, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import LoyaltyCard from '@/components/customer/LoyaltyCard';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TIER_COLORS = {
  Bronze: 'from-amber-600 to-amber-700',
  Silver: 'from-slate-400 to-slate-500',
  Gold: 'from-yellow-500 to-amber-500',
  Platinum: 'from-purple-500 to-indigo-600'
};

export default function MyLoyalty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [redeemingReward, setRedeemingReward] = useState(null); // { reward, loyaltyId, restaurantId }
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate(createPageUrl('Home'));
        return;
      }
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, [navigate]);

  // Fetch user's loyalty memberships
  const { data: loyaltiesRaw = [], isLoading } = useQuery({
    queryKey: ['myLoyalties', currentUser?.id],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  // Deduplicate by restaurant_id (keep most recent per restaurant)
  const loyalties = React.useMemo(() => {
    const seen = new Map();
    loyaltiesRaw.forEach(l => {
      if (!l?.restaurant_id) return;
      const existing = seen.get(l.restaurant_id);
      if (!existing || new Date(l.created_date) > new Date(existing.created_date)) {
        seen.set(l.restaurant_id, l);
      }
    });
    return Array.from(seen.values());
  }, [loyaltiesRaw]);

  // Fetch all programs
  const programIds = [...new Set(loyalties.map(l => l.program_id))];
  const { data: programs = [] } = useQuery({
    queryKey: ['loyaltyPrograms', programIds],
    queryFn: async () => {
      if (programIds.length === 0) return [];
      const results = await Promise.all(
        programIds.map(id => base44.entities.LoyaltyProgram.filter({ id }).then(r => r[0]))
      );
      return results.filter(Boolean);
    },
    enabled: programIds.length > 0,
  });

  // Fetch restaurants
  const restaurantIds = [...new Set(loyalties.map(l => l.restaurant_id))];
  const { data: restaurants = [] } = useQuery({
    queryKey: ['loyaltyRestaurants', restaurantIds],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const results = await Promise.all(
        restaurantIds.map(id => base44.entities.Restaurant.filter({ id }).then(r => r[0]))
      );
      return results.filter(Boolean);
    },
    enabled: restaurantIds.length > 0,
  });

  const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
  const restaurantMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

  // Calculate total points and stats
  const totalPoints = loyalties.reduce((sum, l) => sum + (l.available_points || 0), 0);
  const totalVisits = loyalties.reduce((sum, l) => sum + (l.visits || 0), 0);

  const selectedLoyalty = selectedProgram 
    ? loyalties.find(l => l.program_id === selectedProgram) 
    : null;
  const selectedProgramData = selectedProgram ? programMap[selectedProgram] : null;

  const generateRedemptionLink = async (reward, loyalty) => {
    setRedeemingReward({ reward, loyalty });
    setGeneratedLink(null);
    setCopied(false);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    await base44.entities.RewardRedemption.create({
      token,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      restaurant_id: loyalty.restaurant_id,
      loyalty_id: loyalty.id,
      reward_name: reward.name,
      reward_description: reward.description || '',
      points_cost: reward.points_required,
      status: 'pending',
      expires_at: expiresAt
    });

    const link = `${window.location.origin}${createPageUrl('RedeemReward')}?token=${token}`;
    setGeneratedLink(link);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!currentUser || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => selectedProgram ? setSelectedProgram(null) : navigate(-1)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">
              {selectedProgram ? restaurantMap[selectedLoyalty?.restaurant_id]?.name : 'My Rewards'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {!selectedProgram ? (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Gift className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                  <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Total Points</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Star className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                  <p className="text-2xl font-bold">{totalVisits}</p>
                  <p className="text-xs text-slate-500">Total Visits</p>
                </CardContent>
              </Card>
            </div>

            {/* Loyalty Cards */}
            {loyalties.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <Award className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Rewards Yet</h3>
                  <p className="text-slate-500 mb-4">
                    Visit restaurants with loyalty programs to start earning rewards!
                  </p>
                  <Button onClick={() => navigate(createPageUrl('Home'))} className="rounded-full">
                    Explore Restaurants
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-500">YOUR MEMBERSHIPS</h2>
                {loyalties.map((loyalty) => (
                  <div key={loyalty.id}>
                    <LoyaltyCard
                      loyalty={loyalty}
                      program={programMap[loyalty.program_id]}
                      onClick={() => setSelectedProgram(loyalty.program_id)}
                    />
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      {restaurantMap[loyalty.restaurant_id]?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Program Detail View */
          <div className="space-y-6">
            {/* Current Status Card */}
            <Card className={cn(
              "overflow-hidden border-0 text-white",
              "bg-gradient-to-br",
              TIER_COLORS[selectedLoyalty?.current_tier] || TIER_COLORS.Bronze
            )}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-white/20 text-white border-0">
                    <Award className="w-3 h-3 mr-1" />
                    {selectedLoyalty?.current_tier}
                  </Badge>
                  <span className="text-sm opacity-80">{selectedLoyalty?.visits} visits</span>
                </div>
                <p className="text-4xl font-bold mb-1">
                  {selectedLoyalty?.available_points?.toLocaleString()}
                </p>
                <p className="text-sm opacity-80">Available Points</p>
              </CardContent>
            </Card>

            <Tabs defaultValue="rewards">
              <TabsList className="w-full bg-slate-100 rounded-full p-1">
                <TabsTrigger value="rewards" className="flex-1 rounded-full">Rewards</TabsTrigger>
                <TabsTrigger value="tiers" className="flex-1 rounded-full">Tiers</TabsTrigger>
                <TabsTrigger value="history" className="flex-1 rounded-full">History</TabsTrigger>
              </TabsList>

              <TabsContent value="rewards" className="mt-4 space-y-3">
                {selectedProgramData?.rewards?.map((reward, idx) => {
                  const canRedeem = (selectedLoyalty?.available_points || 0) >= reward.points_required;
                  return (
                    <Card key={idx} className={cn("border-0 shadow-sm", !canRedeem && "opacity-60")}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{reward.name}</h4>
                          <p className="text-sm text-slate-500">{reward.description}</p>
                          <Badge variant="outline" className="mt-2">
                            {reward.points_required.toLocaleString()} pts
                          </Badge>
                        </div>
                        <Button 
                          size="sm" 
                          disabled={!canRedeem}
                          onClick={() => canRedeem && generateRedemptionLink(reward, selectedLoyalty)}
                          className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                        >
                          <Gift className="w-3 h-3 mr-1" />
                          Redeem
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {(!selectedProgramData?.rewards || selectedProgramData.rewards.length === 0) && (
                  <p className="text-center text-slate-500 py-8">No rewards available yet</p>
                )}
              </TabsContent>

              <TabsContent value="tiers" className="mt-4 space-y-3">
                {selectedProgramData?.tiers?.map((tier, idx) => {
                  const isCurrentTier = tier.name === selectedLoyalty?.current_tier;
                  const isUnlocked = (selectedLoyalty?.lifetime_points || 0) >= tier.min_points;
                  
                  return (
                    <Card key={idx} className={cn(
                      "border-2 transition-all",
                      isCurrentTier ? "border-emerald-500 bg-emerald-50" : "border-transparent"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              "bg-gradient-to-br",
                              TIER_COLORS[tier.name] || TIER_COLORS.Bronze
                            )}>
                              <Award className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold">{tier.name}</span>
                          </div>
                          {isCurrentTier && (
                            <Badge className="bg-emerald-600">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mb-2">
                          {tier.min_points.toLocaleString()} points required
                        </p>
                        {tier.multiplier && tier.multiplier > 1 && (
                          <Badge variant="outline" className="mr-2">
                            {tier.multiplier}x points
                          </Badge>
                        )}
                        {tier.perks?.map((perk, i) => (
                          <Badge key={i} variant="secondary" className="mr-1 mb-1 text-xs">
                            {perk}
                          </Badge>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {selectedLoyalty?.rewards_redeemed?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLoyalty.rewards_redeemed.map((redemption, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl">
                        <div>
                          <p className="font-medium text-sm">Reward Redeemed</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(redemption.redeemed_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className="text-red-600 font-medium">-{redemption.points_used}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500">No redemption history</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Gift, Star, Award, History, Loader2, X,
  Lock, CheckCircle, AlertTriangle, TrendingUp, Utensils,
  ChevronRight, Sparkles, Clock, BarChart2, Zap
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const TIER_COLORS = {
  Bronze: { gradient: 'from-amber-600 to-amber-700', light: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Silver: { gradient: 'from-slate-400 to-slate-500', light: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  Gold: { gradient: 'from-yellow-500 to-amber-500', light: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Platinum: { gradient: 'from-purple-500 to-indigo-600', light: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
};

const REWARD_ICONS = {
  discount: '💰',
  free_item: '🎁',
  priority_seating: '⭐',
  special_offer: '✨',
};

export default function MyLoyalty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [redeemingReward, setRedeemingReward] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) { navigate(createPageUrl('Home')); return; }
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, [navigate]);

  const { data: loyaltiesRaw = [], isLoading } = useQuery({
    queryKey: ['myLoyalties', currentUser?.id],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  // Deduplicate by restaurant_id (keep most recent)
  const loyalties = useMemo(() => {
    const seen = new Map();
    loyaltiesRaw.forEach(l => {
      if (!l?.restaurant_id) return;
      const existing = seen.get(l.restaurant_id);
      if (!existing || new Date(l.created_date) > new Date(existing.created_date)) {
        seen.set(l.restaurant_id, l);
      }
    });
    return Array.from(seen.values()).sort((a, b) => (b.visits || 0) - (a.visits || 0));
  }, [loyaltiesRaw]);

  const restaurantIds = useMemo(() => [...new Set(loyalties.map(l => l.restaurant_id))], [loyalties]);
  const programIds = useMemo(() => [...new Set(loyalties.map(l => l.program_id).filter(Boolean))], [loyalties]);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['loyaltyRestaurants', restaurantIds],
    queryFn: async () => {
      const results = await Promise.all(restaurantIds.map(id =>
        base44.entities.Restaurant.filter({ id }).then(r => r[0])
      ));
      return results.filter(Boolean);
    },
    enabled: restaurantIds.length > 0,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['loyaltyPrograms', programIds],
    queryFn: async () => {
      const results = await Promise.all(programIds.map(id =>
        base44.entities.LoyaltyProgram.filter({ id }).then(r => r[0])
      ));
      return results.filter(Boolean);
    },
    enabled: programIds.length > 0,
  });

  const restaurantMap = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r])), [restaurants]);
  const programMap = useMemo(() => Object.fromEntries(programs.map(p => [p.id, p])), [programs]);

  // Aggregate stats
  const totalAvailablePoints = useMemo(() => loyalties.reduce((s, l) => s + (l.available_points || 0), 0), [loyalties]);
  const totalLifetimePoints = useMemo(() => loyalties.reduce((s, l) => s + (l.lifetime_points || 0), 0), [loyalties]);
  const totalVisits = useMemo(() => loyalties.reduce((s, l) => s + (l.visits || 0), 0), [loyalties]);
  const totalRedeemed = useMemo(() => loyalties.reduce((s, l) => s + (l.rewards_redeemed?.length || 0), 0), [loyalties]);

  // Build a unified visit/history timeline across all programs
  const visitHistory = useMemo(() => {
    const events = [];
    loyalties.forEach(loyalty => {
      const restaurant = restaurantMap[loyalty.restaurant_id];
      // Redemption events
      (loyalty.rewards_redeemed || []).forEach(r => {
        events.push({
          type: 'redemption',
          date: r.redeemed_at,
          restaurantName: restaurant?.name || 'Unknown',
          restaurantId: loyalty.restaurant_id,
          label: r.reward_name || 'Reward Redeemed',
          points: -r.points_used,
          color: 'text-red-600',
          icon: '🎁',
        });
      });
      // Last visit synthetic event
      if (loyalty.last_visit) {
        events.push({
          type: 'visit',
          date: loyalty.last_visit,
          restaurantName: restaurant?.name || 'Unknown',
          restaurantId: loyalty.restaurant_id,
          label: 'Visit',
          visits: loyalty.visits,
          icon: '🍽️',
          color: 'text-emerald-600',
        });
      }
    });
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [loyalties, restaurantMap]);

  const selectedLoyalty = selectedRestaurantId ? loyalties.find(l => l.restaurant_id === selectedRestaurantId) : null;
  const selectedProgram = selectedLoyalty ? programMap[selectedLoyalty.program_id] : null;
  const selectedRestaurant = selectedRestaurantId ? restaurantMap[selectedRestaurantId] : null;

  // Tier progress
  const tierProgress = useMemo(() => {
    if (!selectedLoyalty || !selectedProgram?.tiers?.length) return null;
    const tiers = [...selectedProgram.tiers].sort((a, b) => a.min_points - b.min_points);
    const lifePoints = selectedLoyalty.lifetime_points || 0;
    const currentTierIdx = [...tiers].reverse().findIndex(t => lifePoints >= t.min_points);
    const currentTier = currentTierIdx >= 0 ? tiers[tiers.length - 1 - currentTierIdx] : tiers[0];
    const nextTier = tiers[tiers.indexOf(currentTier) + 1];
    const progress = nextTier
      ? Math.min(100, ((lifePoints - currentTier.min_points) / (nextTier.min_points - currentTier.min_points)) * 100)
      : 100;
    return { currentTier, nextTier, progress, lifePoints };
  }, [selectedLoyalty, selectedProgram]);

  const redeemMutation = useMutation({
    mutationFn: async ({ reward, loyalty }) => {
      const newAvailable = (loyalty.available_points || 0) - reward.points_required;
      const newTotal = (loyalty.total_points || 0) - reward.points_required;
      const redemptionEntry = {
        reward_id: reward.id || reward.name,
        redeemed_at: new Date().toISOString(),
        points_used: reward.points_required,
        reward_name: reward.name,
      };
      await base44.entities.CustomerLoyalty.update(loyalty.id, {
        available_points: newAvailable,
        total_points: newTotal,
        rewards_redeemed: [...(loyalty.rewards_redeemed || []), redemptionEntry],
      });
      const token = crypto.randomUUID();
      await base44.entities.RewardRedemption.create({
        token,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        restaurant_id: loyalty.restaurant_id,
        loyalty_id: loyalty.id,
        reward_name: reward.name,
        reward_description: reward.description || '',
        points_cost: reward.points_required,
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return newAvailable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myLoyalties']);
      setConfirmed(true);
      toast.success('Reward redeemed!');
    },
    onError: () => toast.error('Redemption failed, please try again.'),
  });

  if (!currentUser || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => selectedRestaurantId ? setSelectedRestaurantId(null) : navigate(-1)} className="rounded-full shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {selectedRestaurantId ? selectedRestaurant?.name : 'Loyalty Dashboard'}
            </h1>
            {selectedRestaurantId && selectedLoyalty && (
              <p className="text-xs text-slate-500">{selectedLoyalty.current_tier} Member · {selectedLoyalty.visits} visits</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!selectedRestaurantId ? (
          <>
            {/* Summary Banner */}
            <div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white overflow-hidden">
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute bottom-0 right-12 w-20 h-20 bg-white/5 rounded-full" />
              <p className="text-sm font-medium text-emerald-100 mb-1">Total Available Points</p>
              <p className="text-5xl font-bold mb-3">{totalAvailablePoints.toLocaleString()}</p>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-emerald-200">Lifetime Earned</p>
                  <p className="font-semibold">{totalLifetimePoints.toLocaleString()}</p>
                </div>
                <div className="w-px bg-white/20" />
                <div>
                  <p className="text-emerald-200">Visits</p>
                  <p className="font-semibold">{totalVisits}</p>
                </div>
                <div className="w-px bg-white/20" />
                <div>
                  <p className="text-emerald-200">Redeemed</p>
                  <p className="font-semibold">{totalRedeemed}</p>
                </div>
              </div>
            </div>

            {loyalties.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Loyalty Programs Yet</h3>
                  <p className="text-slate-500 mb-6 text-sm">Make reservations at restaurants with loyalty programs to start earning points.</p>
                  <Button onClick={() => navigate(createPageUrl('Home'))} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                    Explore Restaurants
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Memberships List */}
                <section>
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Memberships</h2>
                  <div className="space-y-3">
                    {loyalties.map(loyalty => {
                      const restaurant = restaurantMap[loyalty.restaurant_id];
                      const program = programMap[loyalty.program_id];
                      const tierStyle = TIER_COLORS[loyalty.current_tier] || TIER_COLORS.Bronze;
                      const availableRewards = (program?.rewards || []).filter(r => (loyalty.available_points || 0) >= r.points_required);

                      return (
                        <button
                          key={loyalty.id}
                          onClick={() => setSelectedRestaurantId(loyalty.restaurant_id)}
                          className="w-full text-left"
                        >
                          <Card className="border-0 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                {/* Restaurant image / icon */}
                                <div className={cn(
                                  "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 overflow-hidden",
                                  tierStyle.gradient
                                )}>
                                  {restaurant?.cover_image
                                    ? <img src={restaurant.cover_image} alt={restaurant.name} className="w-full h-full object-cover" />
                                    : <Utensils className="w-6 h-6 text-white" />
                                  }
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900 truncate">{restaurant?.name || 'Restaurant'}</p>
                                      <p className="text-xs text-slate-500">{program?.name || 'Loyalty Program'}</p>
                                    </div>
                                    <Badge className={cn("shrink-0 text-xs border", tierStyle.light)}>
                                      {loyalty.current_tier}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-bold text-emerald-700">{(loyalty.available_points || 0).toLocaleString()} pts</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{loyalty.visits || 0} visits</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {availableRewards.length > 0 && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs gap-1">
                                          <Gift className="w-3 h-3" />
                                          {availableRewards.length} ready
                                        </Badge>
                                      )}
                                      <ChevronRight className="w-4 h-4 text-slate-300" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Visit History Timeline */}
                {visitHistory.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" /> Recent Activity
                    </h2>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-0 divide-y divide-slate-50">
                        {visitHistory.slice(0, 12).map((event, idx) => (
                          <div key={idx} className="flex items-center gap-4 px-4 py-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-base shrink-0">
                              {event.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{event.restaurantName}</p>
                              <p className="text-xs text-slate-500">{event.label}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {event.points !== undefined && (
                                <p className={cn("text-sm font-semibold", event.color)}>{event.points > 0 ? '+' : ''}{event.points} pts</p>
                              )}
                              <p className="text-xs text-slate-400">
                                {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </section>
                )}
              </>
            )}
          </>
        ) : (
          /* === RESTAURANT DETAIL VIEW === */
          <div className="space-y-5">
            {/* Points + Tier Card */}
            <div className={cn(
              "rounded-3xl p-6 text-white bg-gradient-to-br relative overflow-hidden",
              (TIER_COLORS[selectedLoyalty?.current_tier] || TIER_COLORS.Bronze).gradient
            )}>
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div>
                  <p className="text-sm opacity-75 mb-0.5">{selectedRestaurant?.name}</p>
                  <p className="text-4xl font-bold">{(selectedLoyalty?.available_points || 0).toLocaleString()}</p>
                  <p className="text-sm opacity-75 mt-0.5">Available Points</p>
                </div>
                <Badge className="bg-white/20 text-white border-0 text-sm">
                  <Award className="w-3.5 h-3.5 mr-1" />
                  {selectedLoyalty?.current_tier}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20 relative z-10">
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedLoyalty?.visits || 0}</p>
                  <p className="text-xs opacity-70">Visits</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{(selectedLoyalty?.lifetime_points || 0).toLocaleString()}</p>
                  <p className="text-xs opacity-70">Lifetime pts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedLoyalty?.rewards_redeemed?.length || 0}</p>
                  <p className="text-xs opacity-70">Redeemed</p>
                </div>
              </div>

              {/* Tier progress */}
              {tierProgress?.nextTier && (
                <div className="mt-4 relative z-10">
                  <div className="flex justify-between text-xs opacity-75 mb-1">
                    <span>{tierProgress.currentTier.name}</span>
                    <span>{tierProgress.nextTier.name} — {(tierProgress.nextTier.min_points - tierProgress.lifePoints).toLocaleString()} pts away</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-700"
                      style={{ width: `${tierProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Tabs defaultValue="rewards">
              <TabsList className="w-full rounded-full p-1 bg-slate-100">
                <TabsTrigger value="rewards" className="flex-1 rounded-full text-sm">
                  <Gift className="w-3.5 h-3.5 mr-1.5" />Rewards
                </TabsTrigger>
                <TabsTrigger value="tiers" className="flex-1 rounded-full text-sm">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />Tiers
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 rounded-full text-sm">
                  <History className="w-3.5 h-3.5 mr-1.5" />History
                </TabsTrigger>
              </TabsList>

              {/* REWARDS TAB */}
              <TabsContent value="rewards" className="mt-4">
                {!selectedProgram?.rewards?.length ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-10 text-center text-slate-500 text-sm">No rewards set up by this restaurant yet.</CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      You have <strong className="text-slate-800">{(selectedLoyalty?.available_points || 0).toLocaleString()} pts</strong> to spend.
                    </p>
                    {[...selectedProgram.rewards]
                      .sort((a, b) => a.points_required - b.points_required)
                      .map((reward, idx) => {
                        const canRedeem = (selectedLoyalty?.available_points || 0) >= reward.points_required;
                        const pctProgress = Math.min(100, ((selectedLoyalty?.available_points || 0) / reward.points_required) * 100);
                        return (
                          <Card key={idx} className={cn(
                            "border-0 shadow-sm transition-all",
                            canRedeem ? "ring-2 ring-amber-200" : "opacity-70"
                          )}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0",
                                  canRedeem ? "bg-amber-50" : "bg-slate-100"
                                )}>
                                  {REWARD_ICONS[reward.type] || '🎁'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900">{reward.name}</p>
                                      {reward.description && (
                                        <p className="text-xs text-slate-500 mt-0.5">{reward.description}</p>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      disabled={!canRedeem}
                                      onClick={() => { setRedeemingReward({ reward, loyalty: selectedLoyalty }); setConfirmed(false); }}
                                      className={cn(
                                        "rounded-full shrink-0 text-xs h-8",
                                        canRedeem
                                          ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      )}
                                    >
                                      {canRedeem ? 'Redeem' : <Lock className="w-3.5 h-3.5" />}
                                    </Button>
                                  </div>

                                  <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className={cn("font-medium", canRedeem ? "text-amber-700" : "text-slate-500")}>
                                        {reward.points_required.toLocaleString()} pts
                                      </span>
                                      {!canRedeem && (
                                        <span className="text-slate-400">
                                          {(reward.points_required - (selectedLoyalty?.available_points || 0)).toLocaleString()} more needed
                                        </span>
                                      )}
                                    </div>
                                    <Progress
                                      value={pctProgress}
                                      className={cn("h-1.5", canRedeem ? "[&>div]:bg-amber-500" : "[&>div]:bg-slate-300")}
                                    />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </TabsContent>

              {/* TIERS TAB */}
              <TabsContent value="tiers" className="mt-4 space-y-3">
                {selectedProgram?.tiers?.length ? (
                  [...selectedProgram.tiers]
                    .sort((a, b) => a.min_points - b.min_points)
                    .map((tier, idx) => {
                      const isCurrentTier = tier.name === selectedLoyalty?.current_tier;
                      const isUnlocked = (selectedLoyalty?.lifetime_points || 0) >= tier.min_points;
                      const tierStyle = TIER_COLORS[tier.name] || TIER_COLORS.Bronze;
                      return (
                        <Card key={idx} className={cn(
                          "border-2 transition-all",
                          isCurrentTier ? "border-emerald-400" : "border-transparent"
                        )}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={cn("w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0", tierStyle.gradient)}>
                                <Award className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">{tier.name}</span>
                                  {isCurrentTier && <Badge className="bg-emerald-600 text-white text-xs">Current</Badge>}
                                  {!isUnlocked && <Badge variant="outline" className="text-xs text-slate-400">Locked</Badge>}
                                </div>
                                <p className="text-xs text-slate-500">{tier.min_points.toLocaleString()} lifetime points</p>
                              </div>
                              {tier.multiplier > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  <Sparkles className="w-3 h-3 mr-1" />{tier.multiplier}x pts
                                </Badge>
                              )}
                            </div>
                            {tier.perks?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tier.perks.map((perk, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{perk}</Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                ) : (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-10 text-center text-slate-500 text-sm">No tiers defined for this program.</CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* HISTORY TAB */}
              <TabsContent value="history" className="mt-4">
                {(selectedLoyalty?.rewards_redeemed?.length || 0) === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-10 text-center">
                      <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-slate-500 text-sm">No activity recorded yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0 divide-y divide-slate-50">
                      {/* Last visit */}
                      {selectedLoyalty?.last_visit && (
                        <div className="flex items-center gap-4 px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-base">🍽️</div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">Last Visit</p>
                            <p className="text-xs text-slate-500">{format(new Date(selectedLoyalty.last_visit), 'MMM d, yyyy')}</p>
                          </div>
                          <p className="text-xs text-slate-400">{selectedLoyalty.visits} total</p>
                        </div>
                      )}
                      {/* Redemptions */}
                      {[...(selectedLoyalty.rewards_redeemed || [])]
                        .sort((a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at))
                        .map((r, idx) => (
                          <div key={idx} className="flex items-center gap-4 px-4 py-3">
                            <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-base">🎁</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{r.reward_name || 'Reward Redeemed'}</p>
                              <p className="text-xs text-slate-500">{format(new Date(r.redeemed_at), 'MMM d, yyyy · h:mm a')}</p>
                            </div>
                            <p className="text-sm font-semibold text-red-600 shrink-0">−{r.points_used} pts</p>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Go to restaurant */}
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => navigate(`${createPageUrl('RestaurantDetail')}?id=${selectedRestaurantId}`)}
            >
              <Utensils className="w-4 h-4 mr-2" />
              View Restaurant
            </Button>
          </div>
        )}
      </main>

      {/* Redeem Confirm Modal */}
      {redeemingReward && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            {!confirmed ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">Redeem Reward</h2>
                  <button onClick={() => setRedeemingReward(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-200">
                  <p className="font-semibold text-slate-900 text-lg">{redeemingReward.reward.name}</p>
                  {redeemingReward.reward.description && (
                    <p className="text-sm text-slate-600 mt-0.5">{redeemingReward.reward.description}</p>
                  )}
                  <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Cost</span>
                    <span className="font-bold text-amber-700 text-lg">{redeemingReward.reward.points_required.toLocaleString()} pts</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-slate-500">Balance after</span>
                    <span className="font-bold text-slate-700">
                      {((redeemingReward.loyalty.available_points || 0) - redeemingReward.reward.points_required).toLocaleString()} pts
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-700">Points are deducted immediately. Show the confirmation screen to a restaurant staff member to claim your reward.</p>
                </div>
                <Button
                  onClick={() => redeemMutation.mutate(redeemingReward)}
                  disabled={redeemMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-12 rounded-xl"
                >
                  {redeemMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                    : `Confirm & Redeem — ${redeemingReward.reward.points_required.toLocaleString()} pts`
                  }
                </Button>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-9 h-9 text-emerald-600" />
                </div>
                <h2 className="font-bold text-xl text-slate-900 mb-1">Reward Redeemed!</h2>
                <p className="text-sm text-slate-500 mb-5">Show this to a staff member.</p>
                <div className="bg-emerald-50 rounded-2xl p-5 mb-4 text-left border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Customer</p>
                  <p className="font-bold text-slate-900 text-lg mb-3">{currentUser?.full_name}</p>
                  <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Reward</p>
                  <p className="font-bold text-slate-900 text-lg">{redeemingReward.reward.name}</p>
                  <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Points deducted</span>
                    <span className="font-bold text-red-600">−{redeemingReward.reward.points_required.toLocaleString()} pts</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4">
                  🛎️ <strong>Staff:</strong> This screen confirms the reward has been redeemed. Please apply the reward.
                </p>
                <Button onClick={() => setRedeemingReward(null)} className="w-full rounded-xl" variant="outline">Done</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
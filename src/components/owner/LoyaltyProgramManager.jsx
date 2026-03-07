import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Gift, Plus, Trash2, Save, Loader2, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_TIERS = [
  { name: 'Bronze', min_points: 0, multiplier: 1, perks: ['Welcome drink'] },
  { name: 'Silver', min_points: 500, multiplier: 1.25, perks: ['10% off', 'Priority seating'] },
  { name: 'Gold', min_points: 1500, multiplier: 1.5, perks: ['15% off', 'Free appetizer', 'VIP seating'] },
  { name: 'Platinum', min_points: 5000, multiplier: 2, perks: ['20% off', 'Free entree', 'Private events'] }
];

export default function LoyaltyProgramManager({ restaurantId, restaurantName }) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: program, isLoading } = useQuery({
    queryKey: ['loyaltyProgram', restaurantId],
    queryFn: async () => {
      const programs = await base44.entities.LoyaltyProgram.filter({ restaurant_id: restaurantId });
      return programs[0] || null;
    },
    enabled: !!restaurantId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['loyaltyMembers', restaurantId],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const [formData, setFormData] = useState(null);

  React.useEffect(() => {
    if (program) {
      setFormData(program);
    } else if (!isLoading && !program) {
      setFormData({
        restaurant_id: restaurantId,
        name: `${restaurantName || 'Restaurant'} Rewards`,
        is_active: false,
        points_per_dollar: 1,
        signup_bonus: 100,
        tiers: DEFAULT_TIERS,
        rewards: [
          { id: '1', name: 'Free Dessert', points_required: 200, description: 'Any dessert on the menu', type: 'free_item' },
          { id: '2', name: '15% Off Bill', points_required: 500, description: 'Valid on any visit', type: 'discount' },
          { id: '3', name: 'Priority Seating', points_required: 300, description: 'Skip the waitlist', type: 'priority_seating' }
        ]
      });
    }
  }, [program, isLoading, restaurantId, restaurantName]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (program?.id) {
        await base44.entities.LoyaltyProgram.update(program.id, formData);
      } else {
        await base44.entities.LoyaltyProgram.create(formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['loyaltyProgram']);
      toast.success('Loyalty program saved!');
    },
    onError: () => toast.error('Failed to save')
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...formData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    updateField('tiers', newTiers);
  };

  const addReward = () => {
    updateField('rewards', [
      ...formData.rewards,
      { id: Date.now().toString(), name: '', points_required: 100, description: '', type: 'discount' }
    ]);
  };

  const updateReward = (index, field, value) => {
    const newRewards = [...formData.rewards];
    newRewards[index] = { ...newRewards[index], [field]: value };
    updateField('rewards', newRewards);
  };

  const removeReward = (index) => {
    updateField('rewards', formData.rewards.filter((_, i) => i !== index));
  };

  // Deduplicate members by user_id (keep the most recent record per user)
  const uniqueMembers = React.useMemo(() => {
    const seen = new Map();
    (members || []).forEach(m => {
      if (!m?.user_id) return;
      const existing = seen.get(m.user_id);
      if (!existing || new Date(m.created_date) > new Date(existing.created_date)) {
        seen.set(m.user_id, m);
      }
    });
    return Array.from(seen.values());
  }, [members]);

  // Analytics
  const totalMembers = uniqueMembers.length;
  const totalPointsIssued = uniqueMembers.reduce((sum, m) => sum + (m?.lifetime_points || 0), 0);
  const tierDistribution = (DEFAULT_TIERS || []).map(t => ({
    ...t,
    count: uniqueMembers.filter(m => m?.current_tier === t?.name).length
  }));

  if (isLoading || !formData) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-10 h-10" />
              <div>
                <h2 className="text-xl font-bold">{formData.name}</h2>
                <p className="text-sm opacity-80">
                  {formData.is_active ? 'Program Active' : 'Program Inactive'}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => updateField('is_active', checked)}
              className="data-[state=checked]:bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-3 bg-white/20 rounded-xl">
              <Users className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">{totalMembers}</p>
              <p className="text-xs opacity-80">Members</p>
            </div>
            <div className="text-center p-3 bg-white/20 rounded-xl">
              <Gift className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">{totalPointsIssued.toLocaleString()}</p>
              <p className="text-xs opacity-80">Points Issued</p>
            </div>
            <div className="text-center p-3 bg-white/20 rounded-xl">
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">{formData.points_per_dollar}x</p>
              <p className="text-xs opacity-80">Pts/$</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="settings">
        <TabsList className="bg-white shadow-sm rounded-full p-1">
          <TabsTrigger value="settings" className="rounded-full">Settings</TabsTrigger>
          <TabsTrigger value="tiers" className="rounded-full">Tiers</TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-full">Rewards</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Program Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Points per Dollar Spent</Label>
                  <Input
                    type="number"
                    value={formData.points_per_dollar}
                    onChange={(e) => updateField('points_per_dollar', Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Signup Bonus Points</Label>
                  <Input
                    type="number"
                    value={formData.signup_bonus}
                    onChange={(e) => updateField('signup_bonus', Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="mt-4 space-y-3">
          {(formData?.tiers || []).map((tier, idx) => (
            <Card key={idx} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className={cn(
                      "w-5 h-5",
                      tier.name === 'Bronze' && "text-amber-600",
                      tier.name === 'Silver' && "text-slate-400",
                      tier.name === 'Gold' && "text-yellow-500",
                      tier.name === 'Platinum' && "text-purple-500"
                    )} />
                    <span className="font-semibold">{tier.name}</span>
                  </div>
                  <Badge variant="outline">{tier.multiplier}x points</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Min Points Required</Label>
                    <Input
                      type="number"
                      value={tier.min_points}
                      onChange={(e) => updateTier(idx, 'min_points', Number(e.target.value))}
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Point Multiplier</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={tier.multiplier}
                      onChange={(e) => updateTier(idx, 'multiplier', Number(e.target.value))}
                      className="mt-1 h-8"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Perks (comma-separated)</Label>
                  <Input
                    value={tier.perks?.join(', ') || ''}
                    onChange={(e) => updateTier(idx, 'perks', e.target.value.split(',').map(p => p.trim()))}
                    className="mt-1 h-8"
                    placeholder="Free drink, Priority seating"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 space-y-3">
          {(formData?.rewards || []).map((reward, idx) => (
            <Card key={reward.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Gift className="w-5 h-5 text-emerald-600 mt-1" />
                  <div className="flex-1 space-y-3">
                    <Input
                      value={reward.name}
                      onChange={(e) => updateReward(idx, 'name', e.target.value)}
                      placeholder="Reward name"
                      className="h-8"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        value={reward.points_required}
                        onChange={(e) => updateReward(idx, 'points_required', Number(e.target.value))}
                        placeholder="Points required"
                        className="h-8"
                      />
                      <Select
                        value={reward.type}
                        onValueChange={(v) => updateReward(idx, 'type', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discount">Discount</SelectItem>
                          <SelectItem value="free_item">Free Item</SelectItem>
                          <SelectItem value="priority_seating">Priority Seating</SelectItem>
                          <SelectItem value="special_offer">Special Offer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={reward.description}
                      onChange={(e) => updateReward(idx, 'description', e.target.value)}
                      placeholder="Description"
                      className="h-8"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeReward(idx)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addReward} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Reward
          </Button>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Member Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(tierDistribution || []).map((tier) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-medium">{tier.name}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        tier.name === 'Bronze' && "bg-amber-500",
                        tier.name === 'Silver' && "bg-slate-400",
                        tier.name === 'Gold' && "bg-yellow-500",
                        tier.name === 'Platinum' && "bg-purple-500"
                      )}
                      style={{ width: `${totalMembers > 0 ? (tier.count / totalMembers) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm text-right">{tier.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Save Loyalty Program
      </Button>
    </div>
  );
}
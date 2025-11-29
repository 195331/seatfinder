import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Award, Users, Gift, TrendingUp, Star, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from "@/lib/utils";
import { format, subDays } from 'date-fns';

const COLORS = ['#f59e0b', '#94a3b8', '#eab308', '#a855f7'];

export default function LoyaltyAnalytics({ restaurantId }) {
  const { data: members = [] } = useQuery({
    queryKey: ['loyaltyAnalytics', restaurantId],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: program } = useQuery({
    queryKey: ['loyaltyProgram', restaurantId],
    queryFn: async () => {
      const programs = await base44.entities.LoyaltyProgram.filter({ restaurant_id: restaurantId });
      return programs[0];
    },
    enabled: !!restaurantId,
  });

  // Calculate metrics
  const totalMembers = members.length;
  const activeMembers = members.filter(m => {
    if (!m.last_visit) return false;
    return new Date(m.last_visit) > subDays(new Date(), 90);
  }).length;
  const totalPointsIssued = members.reduce((sum, m) => sum + (m.lifetime_points || 0), 0);
  const totalPointsRedeemed = members.reduce((sum, m) => 
    sum + (m.rewards_redeemed?.reduce((s, r) => s + (r.points_used || 0), 0) || 0), 0
  );
  const avgVisitsPerMember = totalMembers > 0 
    ? members.reduce((sum, m) => sum + (m.visits || 0), 0) / totalMembers 
    : 0;
  const totalRevenue = members.reduce((sum, m) => sum + (m.total_spent || 0), 0);

  // Tier distribution
  const tiers = program?.tiers || [
    { name: 'Bronze' }, { name: 'Silver' }, { name: 'Gold' }, { name: 'Platinum' }
  ];
  const tierData = tiers.map((t, idx) => ({
    name: t.name,
    count: members.filter(m => m.current_tier === t.name).length,
    color: COLORS[idx]
  }));

  // Redemption rate
  const redemptionRate = totalPointsIssued > 0 
    ? Math.round((totalPointsRedeemed / totalPointsIssued) * 100) 
    : 0;

  // Engagement over time (mock data for visualization)
  const engagementData = Array.from({ length: 7 }, (_, i) => ({
    day: format(subDays(new Date(), 6 - i), 'EEE'),
    signups: Math.floor(Math.random() * 5),
    redemptions: Math.floor(Math.random() * 3)
  }));

  if (totalMembers === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No loyalty members yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMembers}</p>
                <p className="text-xs text-slate-500">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMembers}</p>
                <p className="text-xs text-slate-500">Active (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{redemptionRate}%</p>
                <p className="text-xs text-slate-500">Redemption Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgVisitsPerMember.toFixed(1)}</p>
                <p className="text-xs text-slate-500">Avg Visits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Member Tier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {tierData.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                  <span>{tier.name}: {tier.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Points Economy */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Points Economy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Points Issued</span>
                <span className="font-semibold">{totalPointsIssued.toLocaleString()}</span>
              </div>
              <Progress value={100} className="h-2 bg-emerald-200" />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Points Redeemed</span>
                <span className="font-semibold">{totalPointsRedeemed.toLocaleString()}</span>
              </div>
              <Progress value={redemptionRate} className="h-2" />
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex justify-between">
                <span className="text-sm text-emerald-700">Revenue from Members</span>
                <span className="font-bold text-emerald-900">${totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Engagement */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base">Weekly Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                <Tooltip />
                <Bar dataKey="signups" name="New Signups" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="redemptions" name="Redemptions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
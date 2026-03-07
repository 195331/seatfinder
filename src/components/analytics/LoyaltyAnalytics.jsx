import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Award, Gift } from 'lucide-react';
import moment from 'moment';

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function LoyaltyAnalytics({ restaurantId }) {
  const { data: loyaltyMembers = [] } = useQuery({
    queryKey: ['loyaltyMembers', restaurantId],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: loyaltyProgram } = useQuery({
    queryKey: ['loyaltyProgram', restaurantId],
    queryFn: async () => {
      const programs = await base44.entities.LoyaltyProgram.filter({ restaurant_id: restaurantId });
      return programs[0];
    },
    enabled: !!restaurantId,
  });

  // Deduplicate by user_id (keep most recent per user)
  const uniqueMembers = useMemo(() => {
    const seen = new Map();
    loyaltyMembers.forEach(m => {
      if (!m?.user_id) return;
      const existing = seen.get(m.user_id);
      if (!existing || new Date(m.created_date) > new Date(existing.created_date)) {
        seen.set(m.user_id, m);
      }
    });
    return Array.from(seen.values());
  }, [loyaltyMembers]);

  const totalMembers = uniqueMembers.length;
  const totalPointsIssued = uniqueMembers.reduce((sum, m) => sum + (m.points_earned || 0), 0);
  const totalPointsRedeemed = uniqueMembers.reduce((sum, m) => sum + (m.points_redeemed || 0), 0);
  const redemptionRate = totalPointsIssued > 0 ? (totalPointsRedeemed / totalPointsIssued * 100).toFixed(1) : 0;

  // Member growth over time
  const memberGrowth = useMemo(() => {
    const last30Days = {};
    const now = moment();

    for (let i = 29; i >= 0; i--) {
      const date = now.clone().subtract(i, 'days').format('MMM D');
      last30Days[date] = { date, members: 0 };
    }

    uniqueMembers.forEach(member => {
      const date = moment(member.created_date).format('MMM D');
      if (last30Days[date]) {
        last30Days[date].members += 1;
      }
    });

    // Cumulative
    let cumulative = 0;
    return Object.values(last30Days).map(d => {
      cumulative += d.members;
      return { ...d, totalMembers: cumulative };
    });
  }, [loyaltyMembers]);

  // Tier distribution
  const tierDistribution = useMemo(() => {
    const tiers = {};
    uniqueMembers.forEach(member => {
      const tier = member.current_tier || 'Bronze';
      tiers[tier] = (tiers[tier] || 0) + 1;
    });
    return Object.entries(tiers).map(([tier, count]) => ({ tier, count }));
  }, [loyaltyMembers]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Members</p>
                <p className="text-2xl font-bold text-purple-600">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Points Issued</p>
                <p className="text-2xl font-bold text-emerald-600">{totalPointsIssued.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Gift className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Points Redeemed</p>
                <p className="text-2xl font-bold text-blue-600">{totalPointsRedeemed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Redemption Rate</p>
                <p className="text-2xl font-bold text-amber-600">{redemptionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Growth */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Member Growth (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={memberGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="totalMembers" stroke="#8b5cf6" strokeWidth={2} name="Total Members" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tier Distribution */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Member Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tierDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" name="Members">
                {tierDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
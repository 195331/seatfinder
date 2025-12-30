import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import moment from 'moment';

export default function FinancialPerformance({ restaurantId }) {
  const { data: preOrders = [] } = useQuery({
    queryKey: ['financialPreOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const financialData = useMemo(() => {
    const last30Days = {};
    const now = moment();

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = now.clone().subtract(i, 'days').format('MMM D');
      last30Days[date] = { date, revenue: 0, orders: 0 };
    }

    // Aggregate data
    preOrders.forEach(order => {
      const date = moment(order.created_date).format('MMM D');
      if (last30Days[date]) {
        last30Days[date].revenue += order.total_amount || 0;
        last30Days[date].orders += 1;
      }
    });

    return Object.values(last30Days);
  }, [preOrders]);

  const totalRevenue = preOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const totalOrders = preOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const revenueGrowth = useMemo(() => {
    if (financialData.length < 15) return 0;
    const firstHalf = financialData.slice(0, 15).reduce((sum, d) => sum + d.revenue, 0);
    const secondHalf = financialData.slice(15).reduce((sum, d) => sum + d.revenue, 0);
    return firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf * 100).toFixed(1) : 0;
  }, [financialData]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">${totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Order Value</p>
                <p className="text-2xl font-bold text-slate-900">${avgOrderValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Revenue Growth</p>
                <p className="text-2xl font-bold text-purple-600">{revenueGrowth}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Revenue Over Time (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders Volume */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Order Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#3b82f6" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
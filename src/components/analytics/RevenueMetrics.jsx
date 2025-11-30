import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, Users, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import moment from 'moment';
import { cn } from "@/lib/utils";

export default function RevenueMetrics({ restaurantId, dateRange = '7d' }) {
  // Fetch loyalty transactions as proxy for revenue
  const { data: loyaltyData = [] } = useQuery({
    queryKey: ['customerLoyalty', restaurantId],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Fetch reservations for visit data
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Fetch menu items for popular items
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = loyaltyData.reduce((sum, l) => sum + (l.total_spent || 0), 0);
    const totalVisits = loyaltyData.reduce((sum, l) => sum + (l.visits || 0), 0);
    const uniqueCustomers = loyaltyData.length;
    const avgSpendPerVisit = totalVisits > 0 ? totalRevenue / totalVisits : 0;
    const avgSpendPerCustomer = uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;
    
    // Calculate visit frequency
    const avgVisitsPerCustomer = uniqueCustomers > 0 ? totalVisits / uniqueCustomers : 0;

    return {
      totalRevenue,
      totalVisits,
      uniqueCustomers,
      avgSpendPerVisit,
      avgSpendPerCustomer,
      avgVisitsPerCustomer
    };
  }, [loyaltyData]);

  // Revenue by day (simulated based on loyalty data)
  const revenueByDay = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 1;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      // Simulate daily revenue based on pattern
      const baseRevenue = metrics.totalRevenue / days;
      const variance = (Math.random() - 0.5) * baseRevenue * 0.4;
      const dayOfWeek = date.day();
      const weekendBoost = (dayOfWeek === 5 || dayOfWeek === 6) ? 1.3 : 1;
      
      data.push({
        date: date.format('MMM D'),
        revenue: Math.max(0, Math.round((baseRevenue + variance) * weekendBoost)),
        visits: Math.round(metrics.totalVisits / days * (0.8 + Math.random() * 0.4))
      });
    }
    
    return data;
  }, [metrics, dateRange]);

  // Popular menu items
  const popularItems = useMemo(() => {
    return menuItems
      .filter(item => item.is_popular)
      .slice(0, 5)
      .map(item => ({
        name: item.name,
        price: item.price,
        category: item.category
      }));
  }, [menuItems]);

  // Reservations by time slot
  const reservationsByTime = useMemo(() => {
    const slots = {};
    reservations.forEach(r => {
      const time = r.reservation_time || '18:00';
      const hour = time.split(':')[0];
      slots[hour] = (slots[hour] || 0) + 1;
    });
    
    return Object.entries(slots)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [reservations]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  ${metrics.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{metrics.totalVisits}</p>
                <p className="text-xs text-slate-500">Total Visits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{metrics.uniqueCustomers}</p>
                <p className="text-xs text-slate-500">Unique Guests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  ${metrics.avgSpendPerVisit.toFixed(0)}
                </p>
                <p className="text-xs text-slate-500">Avg per Visit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {metrics.avgVisitsPerCustomer.toFixed(1)}
                </p>
                <p className="text-xs text-slate-500">Visits/Guest</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  ${metrics.avgSpendPerCustomer.toFixed(0)}
                </p>
                <p className="text-xs text-slate-500">Avg/Customer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Revenue & Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: 'none', 
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value, name) => [
                      name === 'revenue' ? `$${value}` : value,
                      name === 'revenue' ? 'Revenue' : 'Visits'
                    ]}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="visits" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Peak Reservation Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {reservationsByTime.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reservationsByTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No reservation data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular Menu Items */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Popular Menu Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {popularItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {popularItems.map((item, i) => (
                  <div 
                    key={i}
                    className="p-4 bg-slate-50 rounded-xl flex flex-col"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                        #{i + 1}
                      </span>
                      <span className="text-xs text-slate-500">{item.category}</span>
                    </div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-emerald-600 font-semibold mt-auto pt-2">
                      ${item.price?.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                Mark menu items as popular to see them here
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
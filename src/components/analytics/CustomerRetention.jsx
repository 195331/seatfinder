import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Repeat, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function CustomerRetention({ reservations }) {
  const metrics = useMemo(() => {
    const userReservations = {};
    
    reservations.forEach(r => {
      if (r.user_email) {
        if (!userReservations[r.user_email]) {
          userReservations[r.user_email] = {
            email: r.user_email,
            name: r.user_name,
            count: 0,
            firstVisit: r.reservation_date,
            lastVisit: r.reservation_date
          };
        }
        userReservations[r.user_email].count++;
        if (r.reservation_date < userReservations[r.user_email].firstVisit) {
          userReservations[r.user_email].firstVisit = r.reservation_date;
        }
        if (r.reservation_date > userReservations[r.user_email].lastVisit) {
          userReservations[r.user_email].lastVisit = r.reservation_date;
        }
      }
    });

    const users = Object.values(userReservations);
    const totalUsers = users.length;
    const repeatCustomers = users.filter(u => u.count > 1).length;
    const loyalCustomers = users.filter(u => u.count >= 5).length;
    const repeatRate = totalUsers > 0 ? (repeatCustomers / totalUsers * 100).toFixed(1) : 0;

    const topCustomers = users
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const segmentData = [
      { name: 'New Customers', value: totalUsers - repeatCustomers, color: '#94a3b8' },
      { name: 'Repeat Customers', value: repeatCustomers - loyalCustomers, color: '#10b981' },
      { name: 'Loyal Customers', value: loyalCustomers, color: '#6366f1' }
    ];

    return { totalUsers, repeatCustomers, loyalCustomers, repeatRate, topCustomers, segmentData };
  }, [reservations]);

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-slate-500">Total Customers</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{metrics.totalUsers}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-slate-500">Repeat Customers</p>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{metrics.repeatCustomers}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-slate-500">Retention Rate</p>
            </div>
            <p className="text-3xl font-bold text-purple-600">{metrics.repeatRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
          <p className="text-sm text-slate-500">Distribution of customer loyalty</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <p className="text-sm text-slate-500">Your most frequent diners</p>
        </CardHeader>
        <CardContent>
          {metrics.topCustomers.length > 0 ? (
            <div className="space-y-2">
              {metrics.topCustomers.map((customer, idx) => (
                <div key={customer.email} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{customer.name || 'Guest'}</p>
                    <p className="text-xs text-slate-500">{customer.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={idx < 3 ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-700"}>
                      {customer.count} visits
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">No customer data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
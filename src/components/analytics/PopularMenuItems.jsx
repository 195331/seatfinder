import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PopularMenuItems({ restaurantId }) {
  const { data: preOrders = [] } = useQuery({
    queryKey: ['preOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const analytics = useMemo(() => {
    const itemStats = {};
    
    preOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!itemStats[item.menu_item_id]) {
          itemStats[item.menu_item_id] = {
            id: item.menu_item_id,
            name: item.name,
            orders: 0,
            quantity: 0,
            revenue: 0
          };
        }
        itemStats[item.menu_item_id].orders++;
        itemStats[item.menu_item_id].quantity += item.quantity;
        itemStats[item.menu_item_id].revenue += item.price * item.quantity;
      });
    });

    const sorted = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity);
    const topByOrders = sorted.slice(0, 10);
    const topByRevenue = [...sorted].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return { topByOrders, topByRevenue };
  }, [preOrders]);

  const totalRevenue = analytics.topByRevenue.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Popular Items Chart */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Most Ordered Items
          </CardTitle>
          <p className="text-sm text-slate-500">Based on pre-orders</p>
        </CardHeader>
        <CardContent>
          {analytics.topByOrders.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={analytics.topByOrders} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={150} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="quantity" radius={[0, 8, 8, 0]}>
                    {analytics.topByOrders.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index < 3 ? '#10b981' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <strong>🏆 #1 Item:</strong> {analytics.topByOrders[0]?.name} ({analytics.topByOrders[0]?.quantity} orders)
                </p>
              </div>
            </>
          ) : (
            <p className="text-center text-slate-500 py-8">No pre-order data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Leaders */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            Top Revenue Generators
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topByRevenue.length > 0 ? (
            <div className="space-y-3">
              {analytics.topByRevenue.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {idx < 3 && <Award className={`w-5 h-5 ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'}`} />}
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.orders} orders • {item.quantity} items</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">
                    ${item.revenue.toFixed(2)}
                  </Badge>
                </div>
              ))}
              <div className="pt-3 border-t">
                <p className="text-sm text-slate-600">
                  <strong>Total Pre-Order Revenue:</strong> ${totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">No revenue data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
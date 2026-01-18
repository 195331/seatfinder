import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ThumbsUp, TrendingUp } from 'lucide-react';
import { toast } from "sonner";

export default function AIOrderRecommendations({ restaurantId, currentUser, menuItems = [] }) {
  const [recommendations, setRecommendations] = useState(null);

  const { data: pastReservations = [] } = useQuery({
    queryKey: ['userReservations', restaurantId, currentUser?.id],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurantId,
      user_id: currentUser.id,
      status: 'approved'
    }),
    enabled: !!currentUser && !!restaurantId,
  });

  const { data: pastOrders = [] } = useQuery({
    queryKey: ['userOrders', restaurantId, currentUser?.id],
    queryFn: async () => {
      const reservationIds = pastReservations.map(r => r.id);
      if (reservationIds.length === 0) return [];
      
      const orderPromises = reservationIds.map(id =>
        base44.entities.PreOrder.filter({ reservation_id: id }).catch(() => [])
      );
      const orders = await Promise.all(orderPromises);
      return orders.flat();
    },
    enabled: !!currentUser && pastReservations.length > 0,
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['allOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }, '-created_date', 200),
    enabled: !!restaurantId,
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ['promotions', restaurantId],
    queryFn: () => base44.entities.Promotion.filter({ restaurant_id: restaurantId, is_active: true }),
    enabled: !!restaurantId,
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: async () => {
      const userOrderedItems = {};
      pastOrders.forEach(order => {
        order.items?.forEach(item => {
          userOrderedItems[item.menu_item_id] = (userOrderedItems[item.menu_item_id] || 0) + item.quantity;
        });
      });

      const itemPopularity = {};
      allOrders.forEach(order => {
        order.items?.forEach(item => {
          itemPopularity[item.menu_item_id] = (itemPopularity[item.menu_item_id] || 0) + item.quantity;
        });
      });

      const topItems = Object.entries(itemPopularity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => menuItems.find(m => m.id === id))
        .filter(Boolean);

      const userHistory = Object.keys(userOrderedItems).length > 0
        ? `Previous orders: ${Object.entries(userOrderedItems)
            .map(([id, count]) => {
              const item = menuItems.find(m => m.id === id);
              return item ? `${item.name} (${count}x)` : null;
            })
            .filter(Boolean)
            .join(', ')}`
        : 'First time ordering';

      const menuList = menuItems.map(item => `- ${item.name} (${item.category}, $${item.price})`).join('\n');

      const prompt = `As a restaurant recommendation expert, suggest 3-4 menu items from the EXACT menu below for this customer.

**IMPORTANT: You MUST only recommend items that appear in the menu list below. Do not make up or suggest any dishes not listed.**

**Full Menu:**
${menuList}

**Customer History:**
${userHistory}

**Most Popular Items:**
${topItems.slice(0, 5).map(i => `- ${i.name} (${i.category})`).join('\n')}

**Active Promotions:**
${promotions.length > 0 ? promotions.map(p => `- ${p.title}`).join('\n') : 'None'}

Only recommend items from the menu above. Match the exact item names.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_name: { type: "string" },
                  category: { type: "string" },
                  reason: { type: "string" },
                  tag: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.recommendations || [];
    },
    onSuccess: (data) => {
      setRecommendations(data);
      toast.success('Personalized recommendations ready!');
    }
  });

  const tagStyles = {
    'Popular Choice': 'bg-amber-100 text-amber-700',
    'Based on your taste': 'bg-purple-100 text-purple-700',
    'Perfect pairing': 'bg-blue-100 text-blue-700',
    'Special offer': 'bg-emerald-100 text-emerald-700'
  };

  if (!currentUser) return null;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5" />
              Recommended For You
            </CardTitle>
            <p className="text-sm text-white/90 mt-1">
              Personalized picks based on your taste
            </p>
          </div>
          {!recommendations && (
            <Button
              onClick={() => generateRecommendationsMutation.mutate()}
              disabled={generateRecommendationsMutation.isPending}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              {generateRecommendationsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Recommendations
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {recommendations ? (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const menuItem = menuItems.find(m => m.name.toLowerCase() === rec.item_name.toLowerCase());
              return (
                <div key={idx} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">{rec.item_name}</h4>
                        {menuItem?.price && (
                          <span className="text-sm font-medium text-slate-600">
                            ${menuItem.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{rec.category}</p>
                      <p className="text-sm text-slate-700">{rec.reason}</p>
                    </div>
                    <Badge className={tagStyles[rec.tag] || 'bg-slate-100 text-slate-700'}>
                      {rec.tag}
                    </Badge>
                  </div>
                  {menuItem && (
                    <div className="flex gap-2 mt-3">
                      {menuItem.is_popular && (
                        <Badge variant="outline" className="text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                      {menuItem.is_vegetarian && (
                        <Badge variant="outline" className="text-xs">🌱 Vegetarian</Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <ThumbsUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Get Recommendations" for personalized suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
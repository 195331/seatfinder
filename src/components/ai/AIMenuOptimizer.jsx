import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';
import { toast } from "sonner";

export default function AIMenuOptimizer({ restaurantId }) {
  const [insights, setInsights] = useState(null);

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuOptimizer', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: preOrders = [] } = useQuery({
    queryKey: ['optimizerOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['optimizerInventory', restaurantId],
    queryFn: () => base44.entities.InventoryItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['optimizerReviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      // Analyze menu item popularity
      const itemPopularity = {};
      preOrders.forEach(order => {
        order.items?.forEach(item => {
          const id = item.menu_item_id;
          if (!itemPopularity[id]) {
            itemPopularity[id] = { count: 0, revenue: 0, name: item.name };
          }
          itemPopularity[id].count += item.quantity || 1;
          itemPopularity[id].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });

      // Build context for AI
      const topItems = Object.entries(itemPopularity)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([id, data]) => `${data.name}: ${data.count} orders, $${data.revenue.toFixed(2)} revenue`);

      const lowStockItems = inventory
        .filter(i => i.current_quantity <= i.reorder_threshold)
        .map(i => i.name);

      const prompt = `As a restaurant consultant, analyze this data and provide menu optimization recommendations:

**Popular Items (Top 10 by orders):**
${topItems.join('\n')}

**Low Stock Ingredients:**
${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'None critical'}

**Total Menu Items:** ${menuItems.length}
**Recent Orders:** ${preOrders.length}
**Average Rating:** ${reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 'N/A'}

Provide specific recommendations for:
1. **Optimize High Performers** - suggestions to improve/upsell top items
2. **Remove Underperformers** - items to consider removing (low orders, high cost)
3. **New Specials** - profitable dishes based on available inventory
4. **Menu Adjustments** - price changes, combos, or substitutions

Return JSON:
{
  "optimize": [{"item": "name", "action": "suggestion", "impact": "high|medium|low"}],
  "remove": [{"item": "name", "reason": "why", "savings": "estimated"}],
  "specials": [{"name": "dish name", "ingredients": ["list"], "strategy": "why profitable"}],
  "adjustments": [{"type": "price|combo|substitute", "suggestion": "details"}]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            optimize: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  action: { type: "string" },
                  impact: { type: "string" }
                }
              }
            },
            remove: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  reason: { type: "string" },
                  savings: { type: "string" }
                }
              }
            },
            specials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  ingredients: { type: "array", items: { type: "string" } },
                  strategy: { type: "string" }
                }
              }
            },
            adjustments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  suggestion: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setInsights(data);
      toast.success('Menu optimization complete!');
    }
  });

  const impactColors = {
    high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              AI Menu Optimizer
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Data-driven suggestions to maximize profitability
            </p>
          </div>
          <Button
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Optimize Menu
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insights ? (
          <div className="space-y-6">
            {/* Optimize High Performers */}
            {insights.optimize?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Optimize High Performers
                </h4>
                <div className="space-y-2">
                  {insights.optimize.map((item, idx) => (
                    <div key={idx} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{item.item}</span>
                        <Badge className={impactColors[item.impact] || impactColors.low}>
                          {item.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remove Underperformers */}
            {insights.remove?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Consider Removing
                </h4>
                <div className="space-y-2">
                  {insights.remove.map((item, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{item.item}</span>
                        <Badge className="bg-red-100 text-red-700">
                          Save: {item.savings}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Specials */}
            {insights.specials?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Suggested New Specials
                </h4>
                <div className="space-y-2">
                  {insights.specials.map((special, idx) => (
                    <div key={idx} className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                      <span className="font-medium text-slate-900 block mb-1">{special.name}</span>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {special.ingredients?.map((ing, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {ing}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-slate-700">{special.strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Menu Adjustments */}
            {insights.adjustments?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Smart Adjustments
                </h4>
                <div className="space-y-2">
                  {insights.adjustments.map((adj, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <Badge className="mb-2 bg-blue-100 text-blue-700">{adj.type}</Badge>
                      <p className="text-sm text-slate-700">{adj.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Optimize Menu" to get AI recommendations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
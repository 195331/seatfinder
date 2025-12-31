import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingDown, DollarSign, Users } from 'lucide-react';
import { toast } from "sonner";

export default function AIMenuInsights({ restaurantId }) {
  const [insights, setInsights] = useState(null);

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuInsights', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['ordersInsights', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventoryInsights', restaurantId],
    queryFn: () => base44.entities.InventoryItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      // Calculate item performance
      const itemStats = {};
      orders.forEach(order => {
        order.items?.forEach(item => {
          if (!itemStats[item.menu_item_id]) {
            itemStats[item.menu_item_id] = {
              name: item.name,
              orders: 0,
              revenue: 0
            };
          }
          itemStats[item.menu_item_id].orders += item.quantity || 1;
          itemStats[item.menu_item_id].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });

      const performanceData = Object.entries(itemStats)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([id, data]) => ({
          id,
          ...data,
          avgOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
        }));

      const topPerformers = performanceData.slice(0, 5);
      const bottomPerformers = performanceData.slice(-5).reverse();

      const lowStockItems = inventory.filter(i => i.current_quantity <= i.reorder_threshold);

      const prompt = `Analyze this restaurant's menu performance and provide actionable insights:

**Top 5 Performing Items:**
${topPerformers.map(i => `${i.name}: ${i.orders} orders, $${i.revenue.toFixed(2)} revenue`).join('\n')}

**Bottom 5 Performing Items:**
${bottomPerformers.map(i => `${i.name}: ${i.orders} orders, $${i.revenue.toFixed(2)} revenue`).join('\n')}

**Low Stock Ingredients:**
${lowStockItems.length > 0 ? lowStockItems.map(i => i.name).join(', ') : 'None'}

**Total Menu Items:** ${menuItems.length}
**Total Orders Analyzed:** ${orders.length}

Provide insights on:
1. **Underperforming Items** - which items to improve or remove
2. **Dynamic Pricing** - suggested price adjustments or bundles
3. **Staffing Predictions** - busy period forecasts and optimal staffing

Return JSON:
{
  "underperforming": [
    {
      "item": "name",
      "issue": "problem identified",
      "action": "recommended action",
      "impact": "expected result"
    }
  ],
  "pricing": [
    {
      "strategy": "strategy name",
      "items": ["item1", "item2"],
      "reasoning": "why this works",
      "expected_increase": "% or $ estimate"
    }
  ],
  "staffing": [
    {
      "period": "time period",
      "forecast": "demand level",
      "recommended_staff": "number and roles",
      "reasoning": "why"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            underperforming: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  issue: { type: "string" },
                  action: { type: "string" },
                  impact: { type: "string" }
                }
              }
            },
            pricing: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  strategy: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                  reasoning: { type: "string" },
                  expected_increase: { type: "string" }
                }
              }
            },
            staffing: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  period: { type: "string" },
                  forecast: { type: "string" },
                  recommended_staff: { type: "string" },
                  reasoning: { type: "string" }
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
      toast.success('AI insights generated!');
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Menu & Operations Insights
          </CardTitle>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insights ? (
          <div className="space-y-6">
            {/* Underperforming Items */}
            {insights.underperforming?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Underperforming Items
                </h4>
                <div className="space-y-3">
                  {insights.underperforming.map((item, idx) => (
                    <div key={idx} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                      <h5 className="font-medium text-slate-900 mb-2">{item.item}</h5>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-600">Issue: </span>
                          <span className="text-slate-900">{item.issue}</span>
                        </div>
                        <div className="p-2 bg-white rounded border border-red-200">
                          <span className="text-slate-600">Action: </span>
                          <span className="text-slate-900 font-medium">{item.action}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Expected Impact: </span>
                          <span className="text-emerald-700 font-medium">{item.impact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Pricing Strategies */}
            {insights.pricing?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Dynamic Pricing Strategies
                </h4>
                <div className="space-y-3">
                  {insights.pricing.map((strategy, idx) => (
                    <div key={idx} className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-slate-900">{strategy.strategy}</h5>
                        <Badge className="bg-emerald-600 text-white">
                          +{strategy.expected_increase}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {strategy.items?.map((item, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {item}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-slate-700">{strategy.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staffing Predictions */}
            {insights.staffing?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Staffing Predictions
                </h4>
                <div className="space-y-3">
                  {insights.staffing.map((period, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-slate-900">{period.period}</h5>
                        <Badge className="bg-blue-600 text-white">
                          {period.forecast}
                        </Badge>
                      </div>
                      <div className="p-2 bg-white rounded border border-blue-200 mb-2">
                        <span className="text-slate-600 text-sm">Recommended: </span>
                        <span className="text-slate-900 font-medium text-sm">{period.recommended_staff}</span>
                      </div>
                      <p className="text-sm text-slate-700">{period.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Generate Insights" for AI-powered recommendations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
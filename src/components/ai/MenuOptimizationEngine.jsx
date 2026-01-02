import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, TrendingUp, DollarSign, Lightbulb, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function MenuOptimizationEngine({ restaurantId, cuisine }) {
  const [optimization, setOptimization] = useState(null);

  // Fetch all data needed for optimization
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuOptEngine', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: preOrders = [] } = useQuery({
    queryKey: ['ordersOptEngine', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviewsOptEngine', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messagesOptEngine', restaurantId],
    queryFn: () => base44.entities.Message.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventoryOptEngine', restaurantId],
    queryFn: () => base44.entities.InventoryItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      // Analyze sales data
      const itemSales = {};
      preOrders.forEach(order => {
        order.items?.forEach(item => {
          const id = item.menu_item_id;
          if (!itemSales[id]) {
            itemSales[id] = {
              name: item.name,
              orders: 0,
              revenue: 0,
              quantities: []
            };
          }
          itemSales[id].orders += 1;
          itemSales[id].revenue += (item.price || 0) * (item.quantity || 1);
          itemSales[id].quantities.push(item.quantity || 1);
        });
      });

      // Extract customer feedback
      const feedback = {
        reviews: reviews.map(r => `Rating: ${r.rating}/5 - ${r.comment || 'No comment'}`).join('\n'),
        messages: messages.filter(m => !m.is_from_restaurant).map(m => m.message).join('\n')
      };

      // Analyze inventory
      const availableIngredients = inventory.filter(i => i.current_quantity > i.reorder_threshold).map(i => i.name);
      const lowStockItems = inventory.filter(i => i.current_quantity <= i.reorder_threshold).map(i => i.name);

      // Build comprehensive data for AI
      const topSellers = Object.entries(itemSales)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([id, data]) => `${data.name}: ${data.orders} orders, $${data.revenue.toFixed(2)} revenue`);

      const lowPerformers = Object.entries(itemSales)
        .sort((a, b) => a[1].orders - b[1].orders)
        .slice(0, 5)
        .map(([id, data]) => `${data.name}: ${data.orders} orders only`);

      const prompt = `You are an expert restaurant consultant and menu engineer. Analyze this comprehensive data and provide strategic menu optimization recommendations.

**RESTAURANT CUISINE:** ${cuisine}

**SALES DATA:**
Top Performers:
${topSellers.join('\n')}

Low Performers:
${lowPerformers.join('\n')}

Total Orders: ${preOrders.length}
Total Menu Items: ${menuItems.length}

**CUSTOMER FEEDBACK:**
Reviews (${reviews.length} total):
${feedback.reviews.substring(0, 2000)}

Customer Messages:
${feedback.messages.substring(0, 1000)}

**INVENTORY STATUS:**
Available Ingredients: ${availableIngredients.join(', ')}
Low Stock: ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'None'}

Based on this data, provide comprehensive optimization recommendations:

1. **Promotion & Bundling Strategies** - Which dishes should be promoted? What bundles would work well together?
2. **Dynamic Pricing** - Specific price adjustment recommendations with reasoning
3. **New Menu Ideas** - Suggest 3-5 new dishes based on: trending cuisines, available ingredients, customer preferences, and gaps in the menu
4. **Menu Item Descriptions** - Generate compelling descriptions for 3 top-selling items

Return detailed JSON:
{
  "promotions": [
    {
      "item": "dish name",
      "strategy": "promotion strategy",
      "bundle_with": ["item1", "item2"],
      "expected_impact": "impact description"
    }
  ],
  "pricing": [
    {
      "item": "dish name",
      "current_price": 0,
      "suggested_price": 0,
      "reasoning": "why this change",
      "expected_revenue_change": "+X%"
    }
  ],
  "new_items": [
    {
      "name": "new dish name",
      "category": "Appetizers|Mains|Desserts|Drinks",
      "description": "appetizing description",
      "ingredients": ["ingredient1", "ingredient2"],
      "suggested_price": 0,
      "rationale": "why this dish",
      "trending_factor": "what trend it taps into"
    }
  ],
  "descriptions": [
    {
      "item": "existing dish name",
      "new_description": "compelling, appetizing description"
    }
  ],
  "overall_insights": {
    "strengths": ["strength1", "strength2"],
    "opportunities": ["opportunity1", "opportunity2"],
    "menu_health_score": 0-100
  }
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            promotions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  strategy: { type: "string" },
                  bundle_with: { type: "array", items: { type: "string" } },
                  expected_impact: { type: "string" }
                }
              }
            },
            pricing: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  current_price: { type: "number" },
                  suggested_price: { type: "number" },
                  reasoning: { type: "string" },
                  expected_revenue_change: { type: "string" }
                }
              }
            },
            new_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  description: { type: "string" },
                  ingredients: { type: "array", items: { type: "string" } },
                  suggested_price: { type: "number" },
                  rationale: { type: "string" },
                  trending_factor: { type: "string" }
                }
              }
            },
            descriptions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  new_description: { type: "string" }
                }
              }
            },
            overall_insights: {
              type: "object",
              properties: {
                strengths: { type: "array", items: { type: "string" } },
                opportunities: { type: "array", items: { type: "string" } },
                menu_health_score: { type: "number" }
              }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setOptimization(data);
      toast.success('Menu optimization complete!');
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Menu Optimization Engine
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Comprehensive analysis of sales, feedback, and inventory
            </p>
          </div>
          <Button
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
            className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Optimization
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {optimization ? (
          <div className="space-y-6">
            {/* Overall Insights */}
            {optimization.overall_insights && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Menu Health Score</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-purple-600">
                      {optimization.overall_insights.menu_health_score}
                    </div>
                    <span className="text-slate-500">/100</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {optimization.overall_insights.strengths?.map((s, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Opportunities</p>
                    <ul className="space-y-1">
                      {optimization.overall_insights.opportunities?.map((o, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-1">
                          <span className="text-amber-600">→</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <Tabs defaultValue="promotions" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="promotions" className="flex-1">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Promotions
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex-1">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger value="new_items" className="flex-1">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  New Items
                </TabsTrigger>
                <TabsTrigger value="descriptions" className="flex-1">
                  <Package className="w-4 h-4 mr-1" />
                  Descriptions
                </TabsTrigger>
              </TabsList>

              {/* Promotions Tab */}
              <TabsContent value="promotions" className="space-y-3 mt-4">
                {optimization.promotions?.map((promo, idx) => (
                  <div key={idx} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-slate-900">{promo.item}</h5>
                      <Badge className="bg-emerald-600 text-white">Promote</Badge>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{promo.strategy}</p>
                    {promo.bundle_with?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-600 mb-1">Bundle with:</p>
                        <div className="flex flex-wrap gap-1">
                          {promo.bundle_with.map((item, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="p-2 bg-white rounded border border-emerald-300 mt-2">
                      <p className="text-xs text-emerald-700 font-medium">
                        Expected Impact: {promo.expected_impact}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="space-y-3 mt-4">
                {optimization.pricing?.map((price, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-slate-900">{price.item}</h5>
                      <Badge className="bg-blue-600 text-white">
                        {price.expected_revenue_change}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <div>
                        <p className="text-xs text-slate-600">Current</p>
                        <p className="text-lg font-bold text-slate-500 line-through">
                          ${price.current_price?.toFixed(2)}
                        </p>
                      </div>
                      <span className="text-2xl text-slate-400">→</span>
                      <div>
                        <p className="text-xs text-slate-600">Suggested</p>
                        <p className="text-lg font-bold text-blue-600">
                          ${price.suggested_price?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700">{price.reasoning}</p>
                  </div>
                ))}
              </TabsContent>

              {/* New Items Tab */}
              <TabsContent value="new_items" className="space-y-3 mt-4">
                {optimization.new_items?.map((item, idx) => (
                  <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-semibold text-slate-900">{item.name}</h5>
                        <Badge variant="outline" className="mt-1">{item.category}</Badge>
                      </div>
                      <p className="text-lg font-bold text-purple-600">
                        ${item.suggested_price?.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 mb-2 italic">"{item.description}"</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.ingredients?.map((ing, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {ing}
                        </Badge>
                      ))}
                    </div>
                    <div className="p-2 bg-white rounded border border-purple-300 mb-2">
                      <p className="text-xs text-purple-700">
                        <strong>Rationale:</strong> {item.rationale}
                      </p>
                    </div>
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                      🔥 {item.trending_factor}
                    </Badge>
                  </div>
                ))}
              </TabsContent>

              {/* Descriptions Tab */}
              <TabsContent value="descriptions" className="space-y-3 mt-4">
                {optimization.descriptions?.map((desc, idx) => (
                  <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h5 className="font-semibold text-slate-900 mb-2">{desc.item}</h5>
                    <div className="p-3 bg-white rounded border border-amber-300">
                      <p className="text-sm text-slate-700 italic">
                        "{desc.new_description}"
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Ready to optimize your menu?</p>
            <p className="text-sm">
              Our AI will analyze {preOrders.length} orders, {reviews.length} reviews,
              {messages.length} messages, and {inventory.length} inventory items
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
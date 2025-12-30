import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { toast } from "sonner";

export default function AIInventoryInsights({ restaurantId }) {
  const [insights, setInsights] = useState(null);

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', restaurantId],
    queryFn: () => base44.entities.InventoryItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const lowStock = inventory.filter(item => item.current_quantity <= item.reorder_threshold);
      const availableItems = inventory.filter(item => item.current_quantity > item.reorder_threshold);

      const prompt = `You are a restaurant operations expert. Analyze this inventory and provide actionable insights.

Low Stock Items:
${lowStock.map(i => `- ${i.name}: ${i.current_quantity} ${i.unit} (reorder at ${i.reorder_threshold})`).join('\n') || 'None'}

Well-Stocked Items:
${availableItems.map(i => `- ${i.name}: ${i.current_quantity} ${i.unit}`).join('\n')}

Current Menu Items: ${menuItems.length}

Provide 3-5 actionable insights in this format:
[
  {
    "type": "alert|suggestion|opportunity",
    "title": "Brief title",
    "description": "Detailed recommendation",
    "action": "What to do"
  }
]

Focus on:
- Urgent restocking needs
- Menu specials based on abundant ingredients
- Items to 86 (remove from menu) due to low stock
- Cross-selling opportunities`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  action: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.insights || [];
    },
    onSuccess: (data) => {
      setInsights(data);
      toast.success('Insights generated!');
    }
  });

  const typeColors = {
    alert: 'border-red-200 bg-red-50',
    suggestion: 'border-blue-200 bg-blue-50',
    opportunity: 'border-emerald-200 bg-emerald-50'
  };

  const typeBadges = {
    alert: 'bg-red-100 text-red-700',
    suggestion: 'bg-blue-100 text-blue-700',
    opportunity: 'bg-emerald-100 text-emerald-700'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              AI Inventory Insights
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Get smart recommendations for menu and inventory management
            </p>
          </div>
          <Button
            onClick={() => generateInsightsMutation.mutate()}
            disabled={generateInsightsMutation.isPending || inventory.length === 0}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            {generateInsightsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insights ? (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className={`p-4 border rounded-xl ${typeColors[insight.type] || 'bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-semibold text-slate-900">{insight.title}</h4>
                  <Badge className={typeBadges[insight.type] || 'bg-slate-200 text-slate-700'}>
                    {insight.type}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 mb-2">{insight.description}</p>
                <p className="text-sm font-medium text-slate-900">
                  → {insight.action}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Generate Insights" for AI-powered recommendations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
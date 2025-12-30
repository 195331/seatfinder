import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, Plus } from 'lucide-react';
import { toast } from "sonner";

export default function AIMenuSuggestions({ restaurantId, cuisine, onAddItem }) {
  const [suggestions, setSuggestions] = useState([]);

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const prompt = `You are a culinary expert. Suggest 5 popular or trending ${cuisine} dishes that would be excellent additions to a restaurant menu.

For each dish, provide:
- Name
- Brief description (1-2 sentences, make it appetizing)
- Estimated price range
- Category (Appetizers, Mains, Desserts, Drinks)

Format as JSON array with structure:
[
  {
    "name": "Dish Name",
    "description": "Appetizing description",
    "price": 18.99,
    "category": "Mains"
  }
]

Focus on dishes that are:
- Popular and trendy
- Well-suited to ${cuisine} cuisine
- Appealing to a broad audience
- Realistic for restaurant preparation`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            dishes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "number" },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.dishes || [];
    },
    onSuccess: (data) => {
      setSuggestions(data);
      toast.success('Generated menu suggestions!');
    }
  });

  const handleAddToMenu = (dish) => {
    onAddItem({
      name: dish.name,
      description: dish.description,
      price: dish.price,
      category: dish.category,
      is_available: true
    });
    toast.success(`Added ${dish.name} to menu!`);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Menu Suggestions
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Get trending dish recommendations for your {cuisine} restaurant
            </p>
          </div>
          <Button
            onClick={() => generateSuggestionsMutation.mutate()}
            disabled={generateSuggestionsMutation.isPending}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {generateSuggestionsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Generate Ideas
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((dish, idx) => (
              <div key={idx} className="p-4 border rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{dish.name}</h4>
                      <Badge variant="secondary">{dish.category}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{dish.description}</p>
                    <p className="text-lg font-bold text-purple-600">${dish.price?.toFixed(2)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddToMenu(dish)}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Generate Ideas" to get AI-powered menu suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
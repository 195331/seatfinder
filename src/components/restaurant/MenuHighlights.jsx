import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, Loader2, Star, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function MenuHighlights({ restaurantId, menuItems, restaurantName, cuisine }) {
  const [highlights, setHighlights] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateHighlights = async () => {
    setIsGenerating(true);
    try {
      const prompt = `You are a food critic AI analyzing the menu for ${restaurantName}, a ${cuisine} restaurant.

Menu Items: ${JSON.stringify(menuItems.map(item => ({
  name: item.name,
  description: item.description,
  price: item.price,
  is_popular: item.is_popular,
  is_vegetarian: item.is_vegetarian,
  is_vegan: item.is_vegan,
  calories: item.calories
})))}

Generate compelling menu highlights:
1. Identify 3-4 "Must Try" dishes
2. Write appetizing AI-generated descriptions (2 sentences max each)
3. Explain why each dish is special
4. Suggest a "Chef's Recommendation" for today

Return JSON:
{
  "must_try_dishes": [
    {
      "menu_item_name": "name",
      "ai_description": "Mouthwatering description",
      "why_special": "What makes it unique",
      "food_pairing": "Optional wine/drink pairing suggestion"
    }
  ],
  "chefs_pick_today": {
    "menu_item_name": "name",
    "reason": "Why chef recommends it today",
    "special_note": "Any special preparation or ingredient highlight"
  }
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            must_try_dishes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  menu_item_name: { type: 'string' },
                  ai_description: { type: 'string' },
                  why_special: { type: 'string' },
                  food_pairing: { type: 'string' }
                }
              }
            },
            chefs_pick_today: {
              type: 'object',
              properties: {
                menu_item_name: { type: 'string' },
                reason: { type: 'string' },
                special_note: { type: 'string' }
              }
            }
          }
        }
      });

      // Enrich with full menu item data
      const enrichedHighlights = {
        must_try_dishes: response.must_try_dishes.map(dish => ({
          ...dish,
          menu_item: menuItems.find(item => item.name === dish.menu_item_name)
        })),
        chefs_pick_today: {
          ...response.chefs_pick_today,
          menu_item: menuItems.find(item => item.name === response.chefs_pick_today.menu_item_name)
        }
      };

      setHighlights(enrichedHighlights);
    } catch (error) {
      console.error('Failed to generate highlights:', error);
    }
    setIsGenerating(false);
  };

  React.useEffect(() => {
    if (menuItems && menuItems.length > 0 && !highlights) {
      generateHighlights();
    }
  }, [menuItems]);

  if (isGenerating) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
          <p className="text-slate-600">AI is analyzing the menu...</p>
        </CardContent>
      </Card>
    );
  }

  if (!highlights || !highlights.must_try_dishes) return null;

  return (
    <div className="space-y-6">
      {/* Chef's Pick */}
      {highlights.chefs_pick_today?.menu_item && (
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
              Chef's Pick Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              {highlights.chefs_pick_today.menu_item.image_url && (
                <img
                  src={highlights.chefs_pick_today.menu_item.image_url}
                  alt={highlights.chefs_pick_today.menu_item.name}
                  className="w-24 h-24 rounded-xl object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-lg">
                    {highlights.chefs_pick_today.menu_item.name}
                  </h4>
                  <span className="text-lg font-bold text-amber-700">
                    ${highlights.chefs_pick_today.menu_item.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-medium">Why today:</span> {highlights.chefs_pick_today.reason}
                </p>
                {highlights.chefs_pick_today.special_note && (
                  <p className="text-xs text-amber-800 bg-amber-100 inline-block px-2 py-1 rounded">
                    💫 {highlights.chefs_pick_today.special_note}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Must Try Dishes */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Must Try Dishes
            <Badge variant="outline" className="ml-auto">AI Curated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {highlights.must_try_dishes.map((dish, idx) => 
            dish.menu_item && (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-semibold text-slate-900">{dish.menu_item.name}</h5>
                      <span className="font-bold text-slate-900">${dish.menu_item.price.toFixed(2)}</span>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-2">{dish.ai_description}</p>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-700">
                        <span className="font-medium">✨ What makes it special:</span> {dish.why_special}
                      </p>
                      {dish.food_pairing && (
                        <p className="text-xs text-purple-700">
                          <span className="font-medium">🍷 Pairs well with:</span> {dish.food_pairing}
                        </p>
                      )}
                    </div>

                    {/* Dietary badges */}
                    <div className="flex gap-1 mt-2">
                      {dish.menu_item.is_vegetarian && (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                          Vegetarian
                        </Badge>
                      )}
                      {dish.menu_item.is_vegan && (
                        <Badge variant="outline" className="text-xs border-green-600 text-green-800">
                          Vegan
                        </Badge>
                      )}
                      {dish.menu_item.is_gluten_free && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                          Gluten Free
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import RestaurantCard from '../customer/RestaurantCard';

export default function MoodBoardAI({ moodBoard, restaurants, onRestaurantClick }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      // Get restaurants already in the mood board
      const existingIds = moodBoard.filters.restaurant_ids || [];
      const existingRestaurants = restaurants.filter(r => existingIds.includes(r.id));

      const prompt = `You are a restaurant curation AI. Analyze this mood board and suggest 3 perfect additions.

Mood Board: "${moodBoard.name}" ${moodBoard.icon}
Current Restaurants: ${JSON.stringify(existingRestaurants.map(r => ({
  name: r.name,
  cuisine: r.cuisine,
  price_level: r.price_level,
  neighborhood: r.neighborhood,
  has_outdoor: r.has_outdoor,
  is_kid_friendly: r.is_kid_friendly,
  average_rating: r.average_rating
})))}

Available Restaurants to Suggest: ${JSON.stringify(restaurants
  .filter(r => !existingIds.includes(r.id))
  .map(r => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    price_level: r.price_level,
    neighborhood: r.neighborhood,
    has_outdoor: r.has_outdoor,
    is_kid_friendly: r.is_kid_friendly,
    has_bar_seating: r.has_bar_seating,
    average_rating: r.average_rating,
    available_seats: r.available_seats
  })))}

ANALYSIS:
1. Identify the common vibe/theme from existing restaurants (cuisine types, price range, neighborhood, amenities)
2. Suggest 3 restaurants that perfectly match this vibe but add variety
3. Explain why each suggestion fits the mood board
4. Consider: cuisine diversity, similar price points, complementary neighborhoods, matching ambiance features

Return JSON array:
[
  {
    "restaurant_id": "id",
    "match_reasoning": "Why this perfectly fits the mood board vibe",
    "what_it_adds": "What unique value this adds to the collection",
    "confidence": 90
  }
]`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  restaurant_id: { type: 'string' },
                  match_reasoning: { type: 'string' },
                  what_it_adds: { type: 'string' },
                  confidence: { type: 'number' }
                }
              }
            }
          }
        }
      });

      const enrichedSuggestions = (response.suggestions || []).map(s => {
        const restaurant = restaurants.find(r => r.id === s.restaurant_id);
        return { ...s, restaurant };
      }).filter(s => s.restaurant);

      setSuggestions(enrichedSuggestions);
      
      if (enrichedSuggestions.length === 0) {
        toast.info('No new suggestions found for this mood board');
      }
    } catch (error) {
      toast.error('Failed to generate suggestions');
      console.error(error);
    }
    setIsGenerating(false);
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-slate-900">AI Suggestions</h4>
          </div>
          <Button
            onClick={generateSuggestions}
            disabled={isGenerating}
            size="sm"
            variant="outline"
            className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-100"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Get Suggestions
              </>
            )}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Based on your mood board vibe, here are perfect additions:
            </p>
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-white rounded-xl p-3 border border-purple-200">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onRestaurantClick(suggestion.restaurant)}
                      className="font-medium text-slate-900 hover:text-purple-600 transition-colors text-left"
                    >
                      {suggestion.restaurant.name}
                    </button>
                    <p className="text-xs text-slate-600 mt-1">
                      {suggestion.restaurant.cuisine} • {suggestion.restaurant.neighborhood}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-purple-600">
                    {suggestion.confidence}% match
                  </div>
                </div>
                <div className="ml-11 space-y-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Why it fits:</span> {suggestion.match_reasoning}
                  </p>
                  <p className="text-sm text-emerald-700">
                    <span className="font-medium">What it adds:</span> {suggestion.what_it_adds}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SMART_FILTERS = [
{ id: 'best_for_dates', label: 'Best for Dates', icon: '💕' },
{ id: 'great_for_groups', label: 'Great for Groups', icon: '👥' },
{ id: 'quiet_ambiance', label: 'Quiet & Cozy', icon: '🤫' },
{ id: 'lively_atmosphere', label: 'Lively Atmosphere', icon: '🎉' },
{ id: 'good_value', label: 'Good Value', icon: '💰' },
{ id: 'unique_experience', label: 'Unique Experience', icon: '✨' },
{ id: 'instagram_worthy', label: 'Instagram Worthy', icon: '📸' },
{ id: 'hidden_gems', label: 'Hidden Gems', icon: '💎' }];


export default function SmartFilters({ restaurants, onFilteredResults, currentUser }) {
  const [activeFilters, setActiveFilters] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeRestaurantsMutation = useMutation({
    mutationFn: async (filterIds) => {
      if (!restaurants || restaurants.length === 0) return [];

      const filterLabels = filterIds.map((id) =>
      SMART_FILTERS.find((f) => f.id === id)?.label
      ).join(', ');

      // Prepare restaurant data for analysis
      const restaurantData = restaurants.slice(0, 50).map((r) => ({
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        price_level: r.price_level,
        has_outdoor: r.has_outdoor,
        has_bar_seating: r.has_bar_seating,
        is_kid_friendly: r.is_kid_friendly,
        average_rating: r.average_rating,
        review_count: r.review_count
      }));

      const prompt = `You are analyzing restaurants to match user preferences: ${filterLabels}

Restaurant Data:
${JSON.stringify(restaurantData, null, 2)}

For each filter, identify which restaurants match best:
- ${filterIds.map((id) => SMART_FILTERS.find((f) => f.id === id)?.label).join('\n- ')}

Consider:
- "Best for Dates": Romantic atmosphere, quieter, good ambiance, upscale
- "Great for Groups": Family-friendly, large space, good for sharing
- "Quiet & Cozy": Lower noise, intimate, smaller venue
- "Lively Atmosphere": Energetic, bar area, social vibe
- "Good Value": Reasonable prices (level 1-2), good ratings
- "Unique Experience": Unusual cuisine, special features
- "Instagram Worthy": Aesthetic appeal, photogenic dishes/decor
- "Hidden Gems": Good ratings but lower review count, lesser-known

Return an array of restaurant IDs that match ANY of the selected filters:
{
  "matching_restaurants": ["id1", "id2", ...],
  "reasons": {
    "id1": "reason why it matches",
    "id2": "reason why it matches"
  }
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            matching_restaurants: {
              type: "array",
              items: { type: "string" }
            },
            reasons: {
              type: "object",
              additionalProperties: { type: "string" }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      if (data?.matching_restaurants) {
        const filtered = restaurants.filter((r) =>
        data.matching_restaurants.includes(r.id)
        );
        onFilteredResults(filtered);
        toast.success(`Found ${filtered.length} matching restaurants`);
      }
      setIsAnalyzing(false);
    }
  });

  const handleFilterToggle = (filterId) => {
    const newFilters = activeFilters.includes(filterId) ?
    activeFilters.filter((id) => id !== filterId) :
    [...activeFilters, filterId];

    setActiveFilters(newFilters);

    if (newFilters.length > 0) {
      setIsAnalyzing(true);
      analyzeRestaurantsMutation.mutate(newFilters);
    } else {
      onFilteredResults(restaurants); // Reset
    }
  };

  return (
    <div className="bg-white my-8 px-4 py-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Smart Filters</h3>
        </div>
        {activeFilters.length > 0 &&
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveFilters([]);
            onFilteredResults(restaurants);
          }}>

            Clear
          </Button>
        }
      </div>

      <div className="flex flex-wrap gap-2">
        {SMART_FILTERS.map((filter) =>
        <button
          key={filter.id}
          onClick={() => handleFilterToggle(filter.id)}
          disabled={isAnalyzing}
          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
          activeFilters.includes(filter.id) ?
          'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg' :
          'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`
          }>

            <span className="mr-1.5">{filter.icon}</span>
            {filter.label}
          </button>
        )}
      </div>

      {isAnalyzing &&
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          AI is analyzing restaurants...
        </div>
      }
    </div>);

}
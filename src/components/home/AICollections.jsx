import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Heart, TrendingUp, Gem, MapPin } from 'lucide-react';
import RestaurantCard from '@/components/customer/RestaurantCard';

const COLLECTION_TYPES = [
  { id: 'date_night', label: 'Best Date Night Spots', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { id: 'hidden_gems', label: 'Hidden Gems', icon: Gem, color: 'from-purple-500 to-indigo-500' },
  { id: 'trending', label: 'New & Trending', icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
  { id: 'top_rated', label: 'Top Rated Near You', icon: MapPin, color: 'from-amber-500 to-orange-500' }
];

export default function AICollections({ restaurants, userLocation, onRestaurantClick }) {
  const [collections, setCollections] = useState({});
  const [loading, setLoading] = useState({});

  const generateCollectionMutation = useMutation({
    mutationFn: async (collectionType) => {
      setLoading(prev => ({ ...prev, [collectionType]: true }));

      let prompt = '';
      
      if (collectionType === 'date_night') {
        prompt = `Select the 4 best date night restaurants from this list. Look for romantic ambiance, good ratings, and intimate settings.`;
      } else if (collectionType === 'hidden_gems') {
        prompt = `Select 4 hidden gem restaurants - lesser-known spots with great food and unique character. Avoid chains or overly popular places.`;
      } else if (collectionType === 'trending') {
        prompt = `Select 4 new or trending restaurants. Prioritize recently added restaurants or those with growing popularity.`;
      } else if (collectionType === 'top_rated') {
        prompt = `Select the 4 highest-rated restaurants. Prioritize rating and review count.`;
      }

      prompt += `\n\nRestaurants to choose from:
${restaurants.map(r => `- ${r.name} (${r.cuisine}, Rating: ${r.average_rating || 'N/A'}, Reviews: ${r.review_count || 0})`).slice(0, 20).join('\n')}

Return JSON with restaurant names:
{"selected": ["Restaurant Name 1", "Restaurant Name 2", "Restaurant Name 3", "Restaurant Name 4"]}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            selected: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const selectedRestaurants = restaurants.filter(r => 
        result.selected?.includes(r.name)
      ).slice(0, 4);

      setLoading(prev => ({ ...prev, [collectionType]: false }));
      return selectedRestaurants;
    },
    onSuccess: (data, collectionType) => {
      setCollections(prev => ({ ...prev, [collectionType]: data }));
    }
  });

  return (
    <div className="space-y-8">
      {COLLECTION_TYPES.map(collection => {
        const Icon = collection.icon;
        const items = collections[collection.id] || [];
        const isLoading = loading[collection.id];

        return (
          <div key={collection.id}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${collection.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{collection.label}</h2>
              </div>
              {items.length === 0 && !isLoading && (
                <Button
                  onClick={() => generateCollectionMutation.mutate(collection.id)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map(restaurant => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onClick={() => onRestaurantClick(restaurant)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
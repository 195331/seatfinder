import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, TrendingUp, MapPin, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function SurpriseMe({ restaurants, currentUser, onRestaurantClick }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  const generateSurprise = async () => {
    setIsGenerating(true);
    try {
      const now = moment();
      const timeOfDay = now.hour() < 12 ? 'morning' : now.hour() < 17 ? 'afternoon' : 'evening';
      const dayOfWeek = now.format('dddd');
      const isWeekend = now.day() === 0 || now.day() === 6;

      // Get user's history
      const recentlyViewed = currentUser?.recently_viewed || [];
      const preferences = currentUser?.preferences || {};
      const tasteProfile = currentUser?.taste_profile || {};

      // Get search history
      const searchHistory = await base44.entities.AnalyticsEvent.filter({
        user_id: currentUser?.id,
        event_type: 'ai_search'
      }, '-created_date', 10).catch(() => []);

      const searchPatterns = searchHistory.map(e => e.metadata?.query).filter(Boolean);

      // Get recently visited restaurants
      const viewedRestaurants = recentlyViewed.length > 0 
        ? restaurants.filter(r => recentlyViewed.includes(r.id)).slice(0, 5)
        : [];

      const prompt = `You are a personalized restaurant discovery AI. Generate a single "off-the-beaten-path" restaurant recommendation.

Current Context:
- Time: ${timeOfDay} (${now.format('HH:mm')})
- Day: ${dayOfWeek} (${isWeekend ? 'Weekend' : 'Weekday'})

User Profile:
- Taste Profile: ${JSON.stringify(tasteProfile)}
- Dietary Preferences: ${JSON.stringify(preferences.dietary_restrictions || [])}
- Favorite Cuisines: ${JSON.stringify(preferences.favorite_cuisines || [])}
- Recent Search Patterns: ${JSON.stringify(searchPatterns)}
- Recently Viewed: ${JSON.stringify(viewedRestaurants.map(r => ({ name: r.name, cuisine: r.cuisine })))}

Available Restaurants: ${JSON.stringify(restaurants.map(r => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine,
  price_level: r.price_level,
  neighborhood: r.neighborhood,
  has_outdoor: r.has_outdoor,
  is_kid_friendly: r.is_kid_friendly,
  average_rating: r.average_rating,
  available_seats: r.available_seats,
  seating_updated_at: r.seating_updated_at
})))}

RULES:
1. Recommend a restaurant the user hasn't visited yet (not in recently viewed)
2. Match the time of day and occasion (e.g., brunch spots in morning, romantic places in evening)
3. Consider their taste profile and search patterns
4. Surprise them with something slightly outside their usual choices but aligned with their preferences
5. Prioritize places with good availability and recent updates
6. Weekend suggestions can be more adventurous, weekday more practical

Return JSON:
{
  "restaurant_id": "id",
  "surprise_factor": "Why this is a perfect hidden gem for them right now",
  "timing_insight": "Why this is perfect for this time/day",
  "personality_match": "How this matches their dining personality",
  "insider_tip": "A special insider tip about this place",
  "confidence_score": 85
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            restaurant_id: { type: 'string' },
            surprise_factor: { type: 'string' },
            timing_insight: { type: 'string' },
            personality_match: { type: 'string' },
            insider_tip: { type: 'string' },
            confidence_score: { type: 'number' }
          }
        }
      });

      const restaurant = restaurants.find(r => r.id === response.restaurant_id);
      if (restaurant) {
        setRecommendation({ ...response, restaurant });
        
        // Track event
        if (currentUser) {
          await base44.entities.AnalyticsEvent.create({
            event_type: 'surprise_me_generated',
            user_id: currentUser.id,
            restaurant_id: restaurant.id,
            metadata: { time_of_day: timeOfDay, day_of_week: dayOfWeek }
          }).catch(() => {});
        }
      } else {
        toast.error('Could not find a suitable surprise. Try again!');
      }
    } catch (error) {
      toast.error('Failed to generate surprise. Please try again.');
      console.error(error);
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-4">
      {!recommendation ? (
        <Card className="border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Feeling Adventurous?</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Let AI discover a hidden gem perfect for you right now, based on your taste, the time of day, and your dining personality.
            </p>
            <Button
              onClick={generateSurprise}
              disabled={isGenerating}
              size="lg"
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Surprise Me!
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <Sparkles className="w-3 h-3 mr-1" />
                Your Perfect Match
              </Badge>
              <Badge variant="outline" className="border-purple-300">
                {recommendation.confidence_score}% Match
              </Badge>
            </div>

            <button
              onClick={() => onRestaurantClick(recommendation.restaurant)}
              className="w-full text-left group"
            >
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img
                  src={recommendation.restaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}
                  alt={recommendation.restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {recommendation.restaurant.name}
                  </h3>
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <span>{recommendation.restaurant.cuisine}</span>
                    <span>•</span>
                    <span>{'$'.repeat(recommendation.restaurant.price_level || 2)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {recommendation.restaurant.neighborhood}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-purple-800 mb-1">Why This Hidden Gem?</p>
                      <p className="text-sm text-slate-700">{recommendation.surprise_factor}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <Clock className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-pink-800 mb-1">Perfect Timing</p>
                      <p className="text-sm text-slate-700">{recommendation.timing_insight}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-800 mb-1">Matches Your Style</p>
                      <p className="text-sm text-slate-700">{recommendation.personality_match}</p>
                    </div>
                  </div>
                </div>

                {recommendation.insider_tip && (
                  <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
                    <p className="text-xs font-medium text-purple-900 mb-1">💡 Insider Tip</p>
                    <p className="text-sm text-purple-800">{recommendation.insider_tip}</p>
                  </div>
                )}
              </div>
            </button>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => onRestaurantClick(recommendation.restaurant)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                View Restaurant
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRecommendation(null);
                  generateSurprise();
                }}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
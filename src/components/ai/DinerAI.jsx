import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, MapPin, Clock, DollarSign, Loader2, Star, TrendingUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function DinerAI({ 
  restaurants, 
  currentUser, 
  onResultsClick,
  onFiltersApply 
}) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const analyzeQuery = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    try {
      // Get user's taste profile and history
      const tasteProfile = currentUser?.taste_profile || {};
      const recentlyViewed = currentUser?.recently_viewed || [];
      const preferences = currentUser?.preferences || {};
      
      // Get user's review history for preferences
      const userReviews = currentUser 
        ? await base44.entities.Review.filter({ user_id: currentUser.id }, '-created_date', 20)
        : [];
      
      const reviewedCuisines = [...new Set(userReviews.map(r => {
        const restaurant = restaurants.find(rest => rest.id === r.restaurant_id);
        return restaurant?.cuisine;
      }).filter(Boolean))];

      // Get dining history if enabled
      let diningHistory = [];
      if (preferences.ai_settings?.use_dining_history) {
        try {
          const recentReservations = await base44.entities.Reservation.filter({
            user_id: currentUser.id,
            status: 'approved'
          }, '-created_date', 20);
          
          const visitedRestaurantIds = [...new Set(recentReservations.map(r => r.restaurant_id))];
          const visitedRestaurants = await Promise.all(
            visitedRestaurantIds.slice(0, 10).map(id => 
              base44.entities.Restaurant.filter({ id }).then(r => r[0])
            )
          );
          
          diningHistory = visitedRestaurants.filter(Boolean).map(r => ({
            name: r.name,
            cuisine: r.cuisine,
            price_level: r.price_level
          }));
        } catch (e) {
          console.log('Could not fetch dining history');
        }
      }

      // Build context for AI
      const context = {
        query,
        restaurants: restaurants.map(r => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          price_level: r.price_level,
          available_seats: r.available_seats,
          total_seats: r.total_seats,
          is_full: r.is_full,
          average_rating: r.average_rating,
          review_count: r.review_count,
          neighborhood: r.neighborhood,
          has_outdoor: r.has_outdoor,
          has_bar_seating: r.has_bar_seating,
          is_kid_friendly: r.is_kid_friendly,
          seating_updated_at: r.seating_updated_at,
          reliability_score: r.reliability_score,
          opening_hours: r.opening_hours
        })),
        user_preferences: {
          taste_profile: tasteProfile,
          reviewed_cuisines: reviewedCuisines,
          recently_viewed: recentlyViewed.slice(0, 5),
          favorite_cuisines: preferences.favorite_cuisines || [],
          dietary_restrictions: preferences.dietary_restrictions || [],
          preferred_amenities: preferences.preferred_amenities || [],
          dining_history: diningHistory
        },
        current_time: new Date().toISOString()
      };

      const prompt = `You are SeatFinder AI, helping users find the perfect restaurant.

User Query: "${query}"

Available Restaurants: ${JSON.stringify(context.restaurants, null, 2)}

User Preferences: ${JSON.stringify(context.user_preferences, null, 2)}

Current Time: ${context.current_time}

Analyze the query and return the top 3-5 restaurant matches. For each match:
1. Calculate confidence (High/Medium/Low) based on:
   - How well it matches the query
   - Live seating availability (<30 min = High, <2 hours = Medium)
   - Rating and review count
   - User's past preferences
   - Reliability score

2. Provide reasoning for the match
3. Highlight key features that match the query
4. Note any concerns (fully booked, low availability, etc.)

IMPORTANT RULES:
- Only recommend restaurants from the provided list
- If seating_updated_at is >2 hours old, mark confidence as Medium/Low
- Consider opening hours (don't recommend closed places)
- If a restaurant is full (is_full: true), mention alternative options
- If there's not enough data, say "Limited data available"

Return JSON format:
{
  "matches": [
    {
      "restaurant_id": "id",
      "confidence": "High|Medium|Low",
      "match_score": 85,
      "reasoning": "why this matches",
      "highlights": ["available now", "matches cuisine", "outdoor seating"],
      "concerns": ["busy evening time"],
      "wait_estimate": "10-15 minutes",
      "data_freshness": "Updated 5 min ago"
    }
  ],
  "filters_suggested": {
    "cuisines": [],
    "priceLevel": null,
    "seatingLevel": null
  },
  "summary": "Found 3 great matches for Italian date night spots"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  restaurant_id: { type: 'string' },
                  confidence: { type: 'string' },
                  match_score: { type: 'number' },
                  reasoning: { type: 'string' },
                  highlights: { type: 'array', items: { type: 'string' } },
                  concerns: { type: 'array', items: { type: 'string' } },
                  wait_estimate: { type: 'string' },
                  data_freshness: { type: 'string' }
                }
              }
            },
            filters_suggested: {
              type: 'object',
              properties: {
                cuisines: { type: 'array', items: { type: 'string' } },
                priceLevel: { type: 'number' },
                seatingLevel: { type: 'string' }
              }
            },
            summary: { type: 'string' }
          }
        }
      });

      // Enrich results with full restaurant data
      const enrichedMatches = response.matches.map(match => {
        const restaurant = restaurants.find(r => r.id === match.restaurant_id);
        return {
          ...match,
          restaurant
        };
      }).filter(m => m.restaurant);

      setResults({
        ...response,
        matches: enrichedMatches
      });

      // Apply suggested filters
      if (response.filters_suggested && onFiltersApply) {
        onFiltersApply(response.filters_suggested);
      }

      // Track AI usage
      if (currentUser) {
        await base44.entities.AnalyticsEvent.create({
          event_type: 'ai_search',
          user_id: currentUser.id,
          metadata: { query, result_count: enrichedMatches.length }
        }).catch(() => {});
      }

    } catch (error) {
      toast.error('AI search failed. Try a simpler query.');
      console.error(error);
    }
    setIsProcessing(false);
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      High: 'bg-green-100 text-green-800 border-green-200',
      Medium: 'bg-amber-100 text-amber-800 border-amber-200',
      Low: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    return colors[confidence] || colors.Low;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-start">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyzeQuery()}
            placeholder="Ask AI: 'romantic Italian spot with outdoor seating' or 'kid-friendly brunch place'"
            className="pl-10 pr-4 h-12 text-base border-purple-200 focus:border-purple-400"
            disabled={isProcessing}
          />
        </div>
        <Button
          onClick={analyzeQuery}
          disabled={!query.trim() || isProcessing}
          className="h-12 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Ask AI
            </>
          )}
        </Button>
        <a 
          href={base44.agents.getWhatsAppConnectURL('seatfinder_ai')} 
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            className="h-12 px-4 border-green-500 text-green-700 hover:bg-green-50"
          >
            💬 WhatsApp
          </Button>
        </a>
      </div>

      {results && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-900">AI Results</h3>
                <p className="text-sm text-slate-600">{results.summary}</p>
              </div>
            </div>

            <div className="space-y-3">
              {results.matches.map((match, idx) => (
                <button
                  key={match.restaurant_id}
                  onClick={() => onResultsClick?.(match.restaurant)}
                  className="w-full text-left p-4 bg-white rounded-xl border-2 border-transparent hover:border-purple-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                          {idx + 1}. {match.restaurant.name}
                        </span>
                        <Badge className={cn("text-xs", getConfidenceBadge(match.confidence))}>
                          {match.confidence} Match
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span>{match.restaurant.cuisine}</span>
                        <span>{'$'.repeat(match.restaurant.price_level || 2)}</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {match.restaurant.average_rating} ({match.restaurant.review_count})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{match.match_score}%</div>
                      <div className="text-xs text-slate-500">Match</div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mb-2">{match.reasoning}</p>

                  {match.highlights.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {match.highlights.map((highlight, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          ✓ {highlight}
                        </span>
                      ))}
                    </div>
                  )}

                  {match.concerns?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {match.concerns.map((concern, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          ⚠ {concern}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {match.wait_estimate}
                    </span>
                    <span>{match.data_freshness}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-slate-500 text-center">
        💡 Try: "Italian date night spots", "quick lunch under $20", "family-friendly with outdoor seating"
      </div>
    </div>
  );
}
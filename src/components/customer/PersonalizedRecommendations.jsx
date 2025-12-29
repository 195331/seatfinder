import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Heart, Eye } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RestaurantCard from './RestaurantCard';
import { motion } from 'framer-motion';

export default function PersonalizedRecommendations({ 
  currentUser, 
  onRestaurantClick, 
  onFavoriteToggle, 
  favoriteIds 
}) {
  const { data: restaurants = [] } = useQuery({
    queryKey: ['allRestaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ status: 'approved' }),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['userReviews', currentUser?.id],
    queryFn: () => base44.entities.Review.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  if (!currentUser) return null;

  // Calculate personalized score
  const scoredRestaurants = (restaurants || []).map(restaurant => {
    let score = 0;

    // User preferences
    const preferences = currentUser.preferences || {};
    if (preferences.favorite_cuisines?.includes(restaurant.cuisine)) {
      score += 10;
    }

    // Taste profile matching
    const tasteProfile = currentUser.taste_profile || {};
    if (tasteProfile.outdoor_seating && restaurant.has_outdoor) score += 5;
    if (tasteProfile.kid_friendly && restaurant.is_kid_friendly) score += 5;
    if (tasteProfile.bar_seating && restaurant.has_bar_seating) score += 5;

    // Amenity preferences
    if (preferences.preferred_amenities?.includes('outdoor') && restaurant.has_outdoor) score += 3;
    if (preferences.preferred_amenities?.includes('bar') && restaurant.has_bar_seating) score += 3;

    // Similar to favorites (same cuisine as favorited restaurants)
    const favoriteCuisines = new Set(
      favorites
        .map(f => restaurants.find(r => r.id === f.restaurant_id)?.cuisine)
        .filter(Boolean)
    );
    if (favoriteCuisines.has(restaurant.cuisine)) {
      score += 7;
    }

    // Recently viewed (give slight boost)
    if (currentUser.recently_viewed?.includes(restaurant.id)) {
      score += 2;
    }

    // Quality indicators
    if ((restaurant.average_rating || 0) >= 4.5) score += 4;
    if ((restaurant.reliability_score || 0) >= 80) score += 3;

    // Exclude already favorited
    if (favoriteIds.has(restaurant.id)) score = 0;

    return { ...restaurant, personalizedScore: score };
  });

  const recommendations = scoredRestaurants
    .filter(r => r.personalizedScore > 0)
    .sort((a, b) => b.personalizedScore - a.personalizedScore)
    .slice(0, 6);

  if (recommendations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <Card className="relative overflow-hidden border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
        
        <div className="relative p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Just For You</h2>
              <p className="text-slate-600">Personalized picks based on your taste</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map(restaurant => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={favoriteIds.has(restaurant.id)}
                onFavoriteToggle={onFavoriteToggle}
                onClick={onRestaurantClick}
                showBestMatch
              />
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
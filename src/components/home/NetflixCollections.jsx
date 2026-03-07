import React, { useMemo } from 'react';
import { Heart, TrendingUp, Gem, Star, Utensils, RotateCcw, Smile, Baby } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import RestaurantCard from '@/components/customer/RestaurantCard';

const COLLECTION_CONFIGS = [
  { 
    id: 'trending', 
    title: 'Trending Near You', 
    icon: TrendingUp, 
    gradient: 'from-purple-600 to-pink-600'
  },
  { 
    id: 'date_night', 
    title: 'Best Date Night Spots', 
    icon: Heart, 
    gradient: 'from-pink-600 to-rose-600'
  },
  { 
    id: 'hidden_gems', 
    title: 'Hidden Gems', 
    icon: Gem, 
    gradient: 'from-emerald-600 to-teal-600'
  },
  { 
    id: 'top_rated', 
    title: 'Top Rated Near You', 
    icon: Star, 
    gradient: 'from-amber-600 to-orange-600'
  },
  { 
    id: 'new_restaurants', 
    title: 'New Restaurants', 
    icon: Utensils, 
    gradient: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'dine_again',
    title: 'Dine Again',
    icon: RotateCcw,
    gradient: 'from-violet-600 to-purple-600'
  },
  {
    id: 'ambience_kings',
    title: 'Ambience Kings',
    icon: Smile,
    gradient: 'from-rose-500 to-pink-600'
  },
  {
    id: 'family_friendly',
    title: 'For the Whole Family',
    icon: Baby,
    gradient: 'from-green-500 to-emerald-600'
  }
];

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function NetflixCollections({ 
  restaurants, 
  userLocation, 
  onRestaurantClick,
  onFavoriteToggle,
  favoriteIds,
  allReviews,
  pastReservationRestaurantIds = []
}) {
  const collections = useMemo(() => {
    if (!restaurants.length) return {};

    const restaurantsWithDistance = restaurants.map(r => ({
      ...r,
      distance: userLocation && r.latitude && r.longitude
        ? getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude)
        : null
    }));

    // Pre-compute per-restaurant ambience score from reviews (O(n) instead of O(n²))
    const ambienceByRestaurant = {};
    if (allReviews?.length) {
      const buckets = {};
      allReviews.forEach(r => {
        if (!buckets[r.restaurant_id]) buckets[r.restaurant_id] = { sum: 0, count: 0 };
        const score = r.ambiance_rating || r.vibe_rating || 0;
        if (score > 0) {
          buckets[r.restaurant_id].sum += score;
          buckets[r.restaurant_id].count += 1;
        }
      });
      Object.entries(buckets).forEach(([id, { sum, count }]) => {
        ambienceByRestaurant[id] = count > 0 ? sum / count : 0;
      });
    }

    // Dynamic thresholds based on actual data distribution
    const viewCounts = restaurantsWithDistance.map(r => r.view_count || 0).sort((a, b) => a - b);
    const medianViews = viewCounts[Math.floor(viewCounts.length / 2)] || 0;
    const top25PercentViewThreshold = viewCounts[Math.floor(viewCounts.length * 0.75)] || 0;

    const avgRatings = restaurantsWithDistance.map(r => r.average_rating || 0).filter(r => r > 0).sort((a, b) => a - b);
    const minGoodRating = avgRatings.length > 0 ? Math.max(avgRatings[Math.floor(avgRatings.length * 0.6)], 3.5) : 3.5;

    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    // "New" = added in last 60 days; if none, fall back to newest 8
    const recentlyAdded = restaurantsWithDistance
      .filter(r => new Date(r.created_date).getTime() > sixtyDaysAgo)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const newRestaurants = recentlyAdded.length >= 3
      ? recentlyAdded.slice(0, 8)
      : restaurantsWithDistance.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 8);

    // Top-rated: use location if available, else all restaurants
    const topRatedPool = userLocation
      ? restaurantsWithDistance.filter(r => r.distance !== null && r.distance < 15)
      : restaurantsWithDistance;

    return {
      trending: restaurantsWithDistance
        .filter(r => (r.view_count || 0) >= top25PercentViewThreshold || new Date(r.created_date).getTime() > now - 30 * 24 * 60 * 60 * 1000)
        .sort((a, b) => {
          // Blend recency + views: score = views + recency bonus
          const recencyBonus = (r) => new Date(r.created_date).getTime() > now - 7 * 24 * 60 * 60 * 1000 ? 200 : 0;
          return ((b.view_count || 0) + recencyBonus(b)) - ((a.view_count || 0) + recencyBonus(a));
        })
        .slice(0, 8),

      date_night: restaurantsWithDistance
        .filter(r => (r.average_rating || 0) >= minGoodRating && (r.price_level || 1) >= 2)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 8),

      hidden_gems: restaurantsWithDistance
        .filter(r => (r.view_count || 0) <= medianViews && (r.average_rating || 0) >= minGoodRating)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 8),

      top_rated: (topRatedPool.length >= 3 ? topRatedPool : restaurantsWithDistance)
        .filter(r => (r.average_rating || 0) >= minGoodRating)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 8),

      new_restaurants: newRestaurants,

      dine_again: restaurantsWithDistance
        .filter(r => pastReservationRestaurantIds.includes(r.id))
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 8),

      ambience_kings: restaurantsWithDistance
        .filter(r => (ambienceByRestaurant[r.id] || 0) > 0 || (r.average_rating || 0) >= minGoodRating)
        .sort((a, b) => (ambienceByRestaurant[b.id] || b.average_rating || 0) - (ambienceByRestaurant[a.id] || a.average_rating || 0))
        .slice(0, 8),

      family_friendly: restaurantsWithDistance
        .filter(r => r.is_kid_friendly)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 8)
    };
  }, [restaurants, userLocation, pastReservationRestaurantIds, allReviews]);

  return (
    <div className="space-y-10">
      {COLLECTION_CONFIGS.map((config) => {
        const items = collections[config.id] || [];
        if (items.length === 0) return null;

        const Icon = config.icon;

        return (
          <div key={config.id}>
            <div className="flex items-center gap-3 mb-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                config.gradient
              )}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{config.title}</h2>
            </div>

            <div className="relative">
              <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory">
                {items.map((restaurant, index) => (
                  <motion.div
                    key={restaurant.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex-shrink-0 w-[320px] snap-start"
                  >
                    <RestaurantCard
                      restaurant={restaurant}
                      isFavorite={favoriteIds?.has(restaurant.id)}
                      onFavoriteToggle={onFavoriteToggle}
                      onClick={onRestaurantClick}
                      distance={restaurant.distance}
                      reviews={allReviews?.filter(r => r.restaurant_id === restaurant.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
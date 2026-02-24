import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, MapPin } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StarRating from "@/components/ui/StarRating";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import { cn } from "@/lib/utils";

export default function TrendingNearYou({ restaurants, onRestaurantClick, userLocation }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Get trending restaurants (high rating, recent activity)
  const trendingRestaurants = restaurants
    .filter(r => r.average_rating >= 4.0 && r.view_count > 10)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 10);

  if (trendingRestaurants.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-slate-900">Trending Near You</h2>
          <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
            Hot 🔥
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('right')}
            className="rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {trendingRestaurants.map((restaurant, idx) => (
          <motion.div
            key={restaurant.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex-shrink-0 w-[380px] group cursor-pointer"
            onClick={() => onRestaurantClick(restaurant)}
          >
            <div className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl border-2 border-slate-100 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              {/* Large High-Res Image */}
              <div className="relative h-64 overflow-hidden">
                <img
                  src={restaurant.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=90`}
                  alt={restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                
                {/* Trending Badge */}
                <div className="absolute top-4 left-4">
                  <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    #{idx + 1} Trending
                  </Badge>
                </div>

                {/* Live Badge */}
                {restaurant.seating_updated_at && new Date(restaurant.seating_updated_at) > new Date(Date.now() - 10 * 60000) && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-emerald-500 text-white shadow-lg animate-pulse">
                      🔴 LIVE
                    </Badge>
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {restaurant.name}
                </h3>
                
                <div className="flex items-center gap-2 mb-3">
                  <StarRating rating={restaurant.average_rating} count={restaurant.review_count} size="sm" />
                  <span className="text-sm text-slate-600">• {restaurant.cuisine}</span>
                </div>

                {restaurant.neighborhood && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-3">
                    <MapPin className="w-4 h-4" />
                    {restaurant.neighborhood}
                  </div>
                )}

                {/* Availability */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <OccupancyBadge 
                      available={restaurant.available_seats}
                      total={restaurant.total_seats}
                      isFull={restaurant.is_full}
                      size="sm"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      {restaurant.available_seats} seats free
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
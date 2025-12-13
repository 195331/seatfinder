import React from 'react';
import { Heart, MapPin, Clock, Zap, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import PriceLevel from "@/components/ui/PriceLevel";
import StarRating from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function RestaurantCard({ 
  restaurant, 
  isFavorite, 
  onFavoriteToggle, 
  onClick,
  compact = false 
}) {
  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onFavoriteToggle?.(restaurant);
  };

  const lastUpdate = restaurant.seating_updated_at 
    ? moment(restaurant.seating_updated_at)
    : null;
  
  const minutesSinceUpdate = lastUpdate 
    ? moment().diff(lastUpdate, 'minutes')
    : null;

  const isLive = minutesSinceUpdate !== null && minutesSinceUpdate < 15;
  const isStale = minutesSinceUpdate !== null && minutesSinceUpdate >= 30;
  const timeAgo = lastUpdate ? lastUpdate.fromNow() : null;

  return (
    <div 
      onClick={() => onClick?.(restaurant)}
      className={cn(
        "bg-white rounded-2xl border overflow-hidden cursor-pointer group",
        "hover:shadow-xl transition-all duration-300",
        isLive ? "border-emerald-200 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img 
          src={restaurant.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80`}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Live Badge */}
        {isLive && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}
        
        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className={cn(
            "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md hover:scale-110",
            isFavorite 
              ? "bg-red-500 text-white" 
              : "bg-white/95 backdrop-blur-sm text-slate-600 hover:bg-white"
          )}
        >
          <Heart className={cn("w-4.5 h-4.5", isFavorite && "fill-current")} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg text-slate-900 leading-tight flex-1">
            {restaurant.name}
          </h3>
          <PriceLevel level={restaurant.price_level || 2} />
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-sm mb-3">
          <span>{restaurant.cuisine}</span>
          {restaurant.neighborhood && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>{restaurant.neighborhood}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={restaurant.average_rating} count={restaurant.review_count} />
        </div>

        {/* Seating Status */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <OccupancyBadge 
            available={restaurant.available_seats} 
            total={restaurant.total_seats}
            isFull={restaurant.is_full}
          />
          
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {restaurant.available_seats} / {restaurant.total_seats} free
            </p>
            {timeAgo && (
              <p className="text-xs text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
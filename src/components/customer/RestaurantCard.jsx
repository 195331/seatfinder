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
        "bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer",
        "hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-200",
        "transition-all duration-300 group"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img 
          src={restaurant.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80`}
          alt={restaurant.name}
          className={cn(
            "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
            isStale && "opacity-80"
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        
        {/* Live Badge */}
        {isLive && (
          <Badge className="absolute top-3 left-3 bg-emerald-500 text-white gap-1 animate-pulse">
            <Zap className="w-3 h-3" />
            Live now
          </Badge>
        )}

        {/* Stale Warning */}
        {isStale && (
          <Badge className="absolute top-3 left-3 bg-amber-500 text-white gap-1">
            <AlertTriangle className="w-3 h-3" />
            Data may be outdated
          </Badge>
        )}
        
        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          className={cn(
            "absolute top-3 right-3 rounded-full backdrop-blur-md",
            isFavorite 
              ? "bg-red-500/90 text-white hover:bg-red-600" 
              : "bg-white/90 text-slate-600 hover:bg-white"
          )}
        >
          <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
        </Button>

        {/* Occupancy Badge */}
        <div className="absolute bottom-3 left-3">
          <OccupancyBadge 
            available={restaurant.available_seats} 
            total={restaurant.total_seats}
            isFull={restaurant.is_full}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg text-slate-900 leading-tight">
            {restaurant.name}
          </h3>
          <PriceLevel level={restaurant.price_level || 2} />
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-sm mb-3">
          <span>{restaurant.cuisine}</span>
          {restaurant.neighborhood && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {restaurant.neighborhood}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StarRating rating={restaurant.average_rating} count={restaurant.review_count} />
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-slate-800">
              {restaurant.available_seats} / {restaurant.total_seats}
            </span>
          </div>
        </div>

        {/* Last Updated */}
        {timeAgo && (
          <div className={cn(
            "flex items-center gap-1 text-xs mt-2 pt-2 border-t border-slate-100",
            isStale ? "text-amber-600" : isLive ? "text-emerald-600" : "text-slate-400"
          )}>
            <Clock className="w-3 h-3" />
            <span>Updated {timeAgo}</span>
            {isLive && <span className="ml-1">• Data is fresh</span>}
            {isStale && <span className="ml-1">• May be outdated</span>}
          </div>
        )}
      </div>
    </div>
  );
}
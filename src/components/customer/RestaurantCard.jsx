import React from 'react';
import { Heart, MapPin, Clock, Zap, AlertTriangle, Award } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import PriceLevel from "@/components/ui/PriceLevel";
import StarRating from "@/components/ui/StarRating";
import VibeBar from "@/components/restaurant/VibeBar";
import FreshnessIndicator, { getIsVerifiedLive, getIsStale } from "@/components/ui/FreshnessIndicator";
import InstantConfirmBadge from "@/components/customer/InstantConfirmBadge";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function RestaurantCard({ 
  restaurant, 
  isFavorite, 
  onFavoriteToggle, 
  onClick,
  compact = false,
  showBestMatch = false,
  distance = null
}) {
  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onFavoriteToggle?.(restaurant);
  };

  const isVerifiedLive = getIsVerifiedLive(restaurant.seating_updated_at);
  const isStale = getIsStale(restaurant.seating_updated_at);
  const isReliable = restaurant.reliability_score >= 80;

  return (
    <div 
      onClick={() => onClick?.(restaurant)}
      className={cn(
        "bg-white rounded-2xl border overflow-hidden cursor-pointer group",
        "hover:shadow-xl transition-all duration-300",
        isVerifiedLive ? "border-emerald-200 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img 
          src={restaurant.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80`}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Top Left Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <FreshnessIndicator lastUpdate={restaurant.seating_updated_at} showText={false} />
          {showBestMatch && !isVerifiedLive && (
            <Badge className="bg-purple-500 text-white border-0">
              ✨ Best for you
            </Badge>
          )}
          {restaurant.instant_confirm_enabled && (
            <InstantConfirmBadge />
          )}
          {isReliable && (
            <Badge className="bg-blue-600 text-white border-0 gap-1">
              <Award className="w-3 h-3" />
              Reliable
            </Badge>
          )}
        </div>
        
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
          {distance && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-blue-600">📍 {distance.toFixed(1)} mi</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={restaurant.average_rating} count={restaurant.review_count} />
        </div>

        {/* Seating Status */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {!isStale ? (
            <>
              <OccupancyBadge 
                available={restaurant.available_seats} 
                total={restaurant.total_seats}
                isFull={restaurant.is_full}
              />
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {restaurant.available_seats} / {restaurant.total_seats} free
                </p>
                <FreshnessIndicator lastUpdate={restaurant.seating_updated_at} showBadge={false} />
              </div>
            </>
          ) : (
            <div className="w-full text-center py-1">
              <p className="text-sm text-slate-500">Availability Unknown</p>
              <p className="text-xs text-slate-400">Choose Verified Live places for accurate info</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
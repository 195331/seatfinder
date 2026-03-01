import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Heart, MapPin, Clock, Zap, AlertTriangle, Award, ShoppingBag } from 'lucide-react';
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
  distance = null,
  reviews = []
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hoverTimerRef = useRef(null);
  const cycleTimerRef = useRef(null);

  const { data: images = [] } = useQuery({
    queryKey: ['restaurantImages', restaurant?.id],
    queryFn: () => base44.entities.RestaurantImage.filter({ restaurant_id: restaurant.id }, 'sort_order'),
    enabled: !!restaurant?.id && isHovering
  });

  const displayImages = images.length > 0 
    ? images 
    : [{ url: restaurant.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80`, is_cover: true }];

  useEffect(() => {
    if (isHovering && displayImages.length > 1) {
      cycleTimerRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
      }, 2000);
    }

    return () => {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
      if (!isHovering) setCurrentImageIndex(0);
    };
  }, [isHovering, displayImages.length]);

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
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "bg-white rounded-2xl border overflow-hidden cursor-pointer group",
        "hover:shadow-xl transition-all duration-300",
        isVerifiedLive ? "border-emerald-200 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"
      )}
    >
      {/* Image Carousel */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {displayImages.map((img, idx) => (
          <img 
            key={img.id || idx}
            src={img.url}
            alt={img.alt || `${restaurant.name} photo ${idx + 1}`}
            srcSet={`${img.url}?w=600 1x, ${img.url}?w=1200 2x`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-500",
              "group-hover:scale-105",
              idx === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
          />
        ))}

        {/* Image indicators */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {displayImages.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  idx === currentImageIndex 
                    ? "bg-white w-4" 
                    : "bg-white/60"
                )}
              />
            ))}
          </div>
        )}

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

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <StarRating rating={restaurant.average_rating} count={restaurant.review_count} />
          {reviews.length > 0 && (
            <div className="ml-2">
              <VibeBar reviews={reviews} />
            </div>
          )}
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
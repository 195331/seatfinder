import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function RestaurantHero({ restaurant }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: images = [] } = useQuery({
    queryKey: ['restaurantImages', restaurant?.id],
    queryFn: () => base44.entities.RestaurantImage.filter({ restaurant_id: restaurant.id }, 'sort_order'),
    enabled: !!restaurant?.id,
  });

  const displayImages = images.length > 0
    ? images.map(img => img.url || img.image_url)
    : [restaurant?.cover_image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80`];

  // Auto-cycle through images every 3 seconds
  useEffect(() => {
    if (displayImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % displayImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [displayImages.length]);

  return (
    <div className="relative w-full h-72 md:h-96 overflow-hidden bg-slate-900">
      {displayImages.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={`${restaurant?.name} photo ${idx + 1}`}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700",
            idx === currentIndex ? "opacity-100 scale-105" : "opacity-0 scale-100"
          )}
        />
      ))}

      {/* Dark gradient overlay for readability of overlaid buttons */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

      {/* Image indicators */}
      {displayImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {displayImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === currentIndex ? "bg-white w-6" : "bg-white/50 w-1.5"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import RestaurantCard from "@/components/customer/RestaurantCard";
import { cn } from "@/lib/utils";

export default function HorizontalRestaurantRow({ 
  title, 
  icon, 
  restaurants, 
  onRestaurantClick, 
  onFavoriteToggle,
  favoriteIds,
  allReviews = [],
  className 
}) {
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

  if (restaurants.length === 0) return null;

  return (
    <div className={cn("mb-12", className)}>
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-3xl"
          >
            {icon}
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
            {title}
          </h2>
        </div>
        <div className="hidden md:flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            className="rounded-full bg-white/20 backdrop-blur-xl border-white/30 text-white hover:bg-white/30"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('right')}
            className="rounded-full bg-white/20 backdrop-blur-xl border-white/30 text-white hover:bg-white/30"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 md:px-0"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {restaurants.map((restaurant, idx) => (
          <motion.div
            key={restaurant.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex-shrink-0 w-[300px] md:w-[340px] snap-start"
          >
            <div className="bg-purple-900/20 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
              <RestaurantCard
                restaurant={restaurant}
                isFavorite={favoriteIds?.has(restaurant.id)}
                onFavoriteToggle={onFavoriteToggle}
                onClick={onRestaurantClick}
                distance={restaurant.distance}
                reviews={allReviews.filter(r => r.restaurant_id === restaurant.id)}
              />
            </div>
          </motion.div>
        ))}
        {/* Peek element */}
        <div className="flex-shrink-0 w-20 snap-start" />
      </div>
    </div>
  );
}
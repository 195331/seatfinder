import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import RestaurantCard from './RestaurantCard';
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';

export default function RecentlyViewed({ currentUser, onFavoriteToggle, favoriteIds, onClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const recentIds = currentUser?.recently_viewed?.slice(0, 6) || [];

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['recentlyViewed', recentIds],
    queryFn: async () => {
      if (recentIds.length === 0) return [];
      const promises = recentIds.map(id => 
        base44.entities.Restaurant.filter({ id }).then(r => r[0])
      );
      return (await Promise.all(promises)).filter(Boolean);
    },
    enabled: recentIds.length > 0,
  });

  if (!currentUser || recentIds.length === 0) return null;

  return (
    <div className="mb-8 bg-white border-0 shadow-lg rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Recently Viewed</h2>
          <span className="text-sm text-slate-500">({restaurants.length})</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-600" />
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <Skeleton className="aspect-[16/10]" />
                      <div className="p-4 space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))
                ) : (
                  restaurants.map((restaurant) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      isFavorite={favoriteIds.has(restaurant.id)}
                      onFavoriteToggle={onFavoriteToggle}
                      onClick={onClick}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
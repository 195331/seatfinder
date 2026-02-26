import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, TrendingUp, Flame } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function NetflixTopRated({ restaurants, onRestaurantClick, favoriteIds }) {
  if (!restaurants || restaurants.length === 0) return null;

  const topRestaurants = restaurants.slice(0, 10);

  const getRankLabel = (rank) => {
    if (rank === 1) return '#1 Trending';
    if (rank === 2) return '#2 Trending';
    if (rank === 3) return '#3 Trending';
    if (rank <= 5) return `#${rank} Best Date Night`;
    if (rank <= 7) return `#${rank} Hidden Gem`;
    if (rank <= 9) return `#${rank} Local Favorite`;
    return `#${rank} Top Pick`;
  };

  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Top Rated Near You</h2>
          <p className="text-slate-600">Curated by popularity and ratings</p>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative -mx-4 px-4">
        <div 
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: '16px',
          }}
        >
          {topRestaurants.map((restaurant, index) => {
            const rank = index + 1;
            const isFavorite = favoriteIds?.has(restaurant.id);
            
            return (
              <motion.div
                key={restaurant.id}
                className="snap-start snap-always flex-shrink-0 first:ml-0 last:mr-4"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Number + Card Group */}
                <div className="relative flex items-center">
                  {/* Giant Rank Number - Behind Card, Centered */}
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-0 select-none pointer-events-none"
                    style={{
                      fontSize: '320px',
                      lineHeight: '1',
                      fontWeight: '900',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      WebkitTextStroke: '8px rgba(168, 85, 247, 0.5)',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 0 50px rgba(168, 85, 247, 0.4)',
                    }}
                  >
                    {rank}
                  </div>

                  {/* Restaurant Card - Portrait Style */}
                  <motion.div
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => onRestaurantClick(restaurant)}
                    className="relative w-[220px] cursor-pointer group z-10 ml-24"
                  >
                    {/* Main Card */}
                    <div className="relative bg-white rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all border border-slate-200">
                      {/* Image Container - Tall Portrait */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                        <img
                          src={restaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        {/* 3D Breaking Border Effect - Food Asset Placeholder */}
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />

                        {/* Rating Indicator */}
                        {restaurant.average_rating > 0 && (
                          <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-white text-xs font-bold">
                              {restaurant.average_rating.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Bottom Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-white font-bold text-lg mb-1 line-clamp-2 drop-shadow-lg">
                            {restaurant.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-white/90">
                            <span className="inline-flex items-center gap-1">
                              {'$'.repeat(restaurant.price_level || 2)}
                            </span>
                            <span>•</span>
                            <span className="line-clamp-1">{restaurant.cuisine}</span>
                          </div>
                          {restaurant.neighborhood && (
                            <div className="flex items-center gap-1 text-xs text-white/80 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="line-clamp-1">{restaurant.neighborhood}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Purple Glow Effect on Hover */}
                      <div className="absolute inset-0 border-2 border-purple-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" 
                           style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }} />
                    </div>

                    {/* Rank Badge - Popping Out at Top with Label */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white z-20 whitespace-nowrap">
                      <span className="text-white font-black text-sm">{getRankLabel(rank)}</span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}

          {/* Peek Gradient Indicator */}
          <div className="flex-shrink-0 w-12 flex items-center justify-center text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Custom Scrollbar Hint */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="h-1 w-20 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full" />
          </div>
          <span className="text-xs text-slate-400">Scroll for more →</span>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
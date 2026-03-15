import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Star, Sparkles, MapPin, Trophy, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RestaurantCard from './RestaurantCard';
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import PeopleSection from '@/components/discover/PeopleSection';

export default function DiscoverSection({ 
  currentUser, 
  onRestaurantClick, 
  onFavoriteToggle, 
  favoriteIds,
  userLocation 
}) {
  const [hoveredImage, setHoveredImage] = useState(null);

  // Fetch menu items with images
  const { data: allMenuItems = [] } = useQuery({
    queryKey: ['menuItemsForDiscover'],
    queryFn: () => base44.entities.MenuItem.list('-created_date', 200),
  });
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['allRestaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ status: 'approved' }),
  });

  // Get user achievements — must be before any early returns
  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', currentUser?.id],
    queryFn: () => base44.entities.Achievement.filter({ user_id: currentUser.id }, '-earned_at'),
    enabled: !!currentUser,
  });

  // Calculate distance
  const restaurantsWithDistance = (restaurants || []).map(r => ({
    ...r,
    distance: userLocation && r.latitude && r.longitude
      ? getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude)
      : null
  }));

  // New & Trending (recently added + high engagement)
  const newAndTrending = (restaurants || [])
    .filter(r => {
      const createdDate = new Date(r.created_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate > thirtyDaysAgo || (r.view_count || 0) > 100;
    })
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 6);

  // Top Rated Near You
  const topRatedNearby = (restaurantsWithDistance || [])
    .filter(r => r.distance !== null && r.distance < 10 && r.average_rating >= 4.0)
    .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
    .slice(0, 6);

  // Editor's Picks (high reliability + good ratings)
  const editorsPicks = (restaurants || [])
    .filter(r => (r.reliability_score || 0) >= 80 && (r.average_rating || 0) >= 4.2)
    .sort((a, b) => {
      const scoreA = (a.reliability_score || 0) + (a.average_rating || 0) * 10;
      const scoreB = (b.reliability_score || 0) + (b.average_rating || 0) * 10;
      return scoreB - scoreA;
    })
    .slice(0, 6);

  const sections = [
    {
      title: 'New & Trending',
      icon: TrendingUp,
      color: 'from-purple-600 to-pink-600',
      restaurants: newAndTrending || [],
      badge: 'Hot Right Now'
    },
    {
      title: 'Top Rated Near You',
      icon: MapPin,
      color: 'from-blue-600 to-cyan-600',
      restaurants: topRatedNearby || [],
      badge: userLocation && topRatedNearby?.length > 0 
        ? `Within ${Math.max(...topRatedNearby.map(r => r.distance || 0)).toFixed(1)} mi` 
        : 'Nearby'
    },
    {
      title: "Editor's Picks",
      icon: Sparkles,
      color: 'from-amber-600 to-orange-600',
      restaurants: editorsPicks || [],
      badge: 'Curated Selection'
    }
  ];

  // Define all possible badges
  const allBadgeDefinitions = [
    { type: 'first_review', name: 'First Review', icon: '✍️', color: 'from-yellow-400 to-amber-500' },
    { type: 'review_master_5', name: '5 Reviews', icon: '⭐', color: 'from-blue-400 to-cyan-500' },
    { type: 'review_master_10', name: '10 Reviews', icon: '🌟', color: 'from-purple-400 to-pink-500' },
    { type: 'frequent_diner_5', name: 'Regular', icon: '🍽️', color: 'from-green-400 to-emerald-500' },
    { type: 'frequent_diner_10', name: 'Foodie', icon: '🍕', color: 'from-orange-400 to-red-500' },
    { type: 'social_butterfly', name: 'Social', icon: '🦋', color: 'from-pink-400 to-rose-500' },
    { type: 'explorer', name: 'Explorer', icon: '🧭', color: 'from-teal-400 to-cyan-500' },
    { type: 'night_owl', name: 'Night Owl', icon: '🦉', color: 'from-indigo-400 to-purple-500' },
    { type: 'early_bird', name: 'Early Bird', icon: '🐦', color: 'from-yellow-400 to-orange-500' },
    { type: 'weekend_warrior', name: 'Weekend', icon: '🎉', color: 'from-purple-400 to-fuchsia-500' },
    { type: 'photo_enthusiast', name: 'Photographer', icon: '📸', color: 'from-blue-400 to-indigo-500' },
    { type: 'globe_trotter', name: 'Globe Trotter', icon: '✈️', color: 'from-sky-400 to-blue-500' },
    { type: 'cuisine_explorer', name: 'Cuisine Expert', icon: '🌮', color: 'from-lime-400 to-green-500' },
    { type: 'local_hero', name: 'Local Hero', icon: '🏆', color: 'from-amber-400 to-yellow-500' },
    { type: 'taste_maker', name: 'Taste Maker', icon: '👨‍🍳', color: 'from-red-400 to-pink-500' }
  ];

  // Select diverse menu items with images
  const featuredDishes = useMemo(() => {
    const itemsWithImages = allMenuItems.filter(item => item.image_url && item.is_available);
    
    // Group by category to ensure variety
    const byCategory = {};
    itemsWithImages.forEach(item => {
      const cat = item.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    // Pick one from each category
    const selected = [];
    const categories = Object.keys(byCategory).sort(() => Math.random() - 0.5);
    
    for (const cat of categories) {
      if (selected.length >= 6) break;
      const items = byCategory[cat];
      const randomItem = items[Math.floor(Math.random() * items.length)];
      selected.push(randomItem);
    }

    // If we don't have 6 yet, fill with random items
    while (selected.length < 6 && itemsWithImages.length > selected.length) {
      const remaining = itemsWithImages.filter(i => !selected.includes(i));
      if (remaining.length === 0) break;
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    return selected.slice(0, 6);
  }, [allMenuItems]);

  // Get restaurant data for featured dishes
  const restaurantIds = useMemo(() => 
    [...new Set(featuredDishes.map(d => d.restaurant_id))],
    [featuredDishes]
  );
  
  const { data: featuredRestaurants = [] } = useQuery({
    queryKey: ['featuredRestaurants', restaurantIds.join(',')],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const promises = restaurantIds.map(id => 
        base44.entities.Restaurant.filter({ id }).catch(() => [])
      );
      const results = await Promise.all(promises);
      return results.flat();
    },
    enabled: restaurantIds.length > 0,
  });

  // Get unique earned badge types
  const earnedBadgeTypes = new Set(userAchievements.map(a => a.badge_type));

  // Create badge display list with earned status
  const badgesDisplay = allBadgeDefinitions.map(badge => ({
    ...badge,
    earned: earnedBadgeTypes.has(badge.type),
    earnedDate: userAchievements.find(a => a.badge_type === badge.type)?.earned_at
  }));

  const getRestaurantForItem = (item) => {
    return featuredRestaurants.find(r => r.id === item.restaurant_id);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(j => (
                <Skeleton key={j} className="h-64 rounded-3xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Hero Food Gallery */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-1">
        <div className="bg-white rounded-[22px] p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Discover Culinary Excellence</h2>
            <p className="text-slate-600 text-lg">Explore flavors that inspire your next dining adventure</p>
          </div>
          
          {featuredDishes.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {featuredDishes.map((dish, idx) => {
                const restaurant = getRestaurantForItem(dish);
                
                return (
                  <motion.div
                    key={dish.id}
                    className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group"
                    onMouseEnter={() => setHoveredImage(idx)}
                    onMouseLeave={() => setHoveredImage(null)}
                    onClick={() => restaurant && onRestaurantClick(restaurant)}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  >
                    <img
                      src={dish.image_url}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300",
                      hoveredImage === idx ? "opacity-100" : "opacity-0"
                    )}>
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <h3 className="font-bold text-xl mb-2">{dish.name}</h3>
                        {dish.description && (
                          <p className="text-sm text-white/90 mb-2">{dish.description}</p>
                        )}
                        {restaurant && (
                          <div className="flex items-center gap-2 mt-3">
                            <Badge className="bg-white/20 text-white border-white/30">
                              {restaurant.name}
                            </Badge>
                            {dish.price && (
                              <Badge className="bg-white/20 text-white border-white/30">
                                ${dish.price.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : restaurants.length > 0 ? (
            /* Fallback: show restaurant cover images when no menu item photos exist */
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {restaurants.filter(r => r.cover_image).slice(0, 6).map((r, idx) => (
                <motion.div
                  key={r.id}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer"
                  onMouseEnter={() => setHoveredImage(idx)}
                  onMouseLeave={() => setHoveredImage(null)}
                  onClick={() => onRestaurantClick(r)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                >
                  <img src={r.cover_image} alt={r.name} className="w-full h-full object-cover" />
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
                    hoveredImage === idx ? "opacity-100" : "opacity-60"
                  )}>
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="font-bold text-lg">{r.name}</h3>
                      <p className="text-sm text-white/80">{r.cuisine} · {r.neighborhood}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Achievements Section */}
      {currentUser && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-1">
          <div className="bg-white rounded-[22px] p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Achievements ({earnedBadgeTypes.size})</h2>
                <p className="text-slate-600">Unlock {15 - earnedBadgeTypes.size} more by exploring and reviewing</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {badgesDisplay.map((badge) => (
                <motion.div
                  key={badge.type}
                  whileHover={{ scale: badge.earned ? 1.05 : 1.02 }}
                  className="relative group"
                >
                  <div className={cn(
                    "aspect-square rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all shadow-md",
                    badge.earned 
                      ? `bg-gradient-to-br ${badge.color} border-2 border-white hover:shadow-xl` 
                      : "bg-slate-100 border-2 border-slate-200 grayscale opacity-50"
                  )}>
                    <div className={cn(
                      "text-5xl mb-2",
                      badge.earned ? "" : "opacity-40"
                    )}>
                      {badge.icon}
                    </div>
                    <p className={cn(
                      "font-bold text-sm",
                      badge.earned ? "text-white" : "text-slate-400"
                    )}>
                      {badge.name}
                    </p>
                  </div>
                  {badge.earned && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* People / Social Section */}
      <PeopleSection currentUser={currentUser} />

      {/* Restaurant Sections */}
      {sections.map((section, idx) => {
        if (section.restaurants.length === 0) return null;
        
        const Icon = section.icon;
        
        return (
          <div key={idx}>
            <div className="flex items-center gap-4 mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                section.color
              )}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
                <Badge className="mt-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                  {section.badge}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(section.restaurants || []).map(restaurant => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  isFavorite={favoriteIds.has(restaurant.id)}
                  onFavoriteToggle={onFavoriteToggle}
                  onClick={onRestaurantClick}
                  distance={restaurant.distance}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper function
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
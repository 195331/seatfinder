import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Star, Sparkles, MapPin, Trophy, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RestaurantCard from './RestaurantCard';
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";

const FOOD_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c', title: 'Gourmet Salad', desc: 'Fresh, organic ingredients with premium dressings' },
  { url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38', title: 'Artisan Pizza', desc: 'Wood-fired perfection with authentic Italian flavors' },
  { url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187', title: 'Juicy Burger', desc: 'Grass-fed beef with signature house sauce' },
  { url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445', title: 'Creamy Pasta', desc: 'Handmade pasta in rich, savory sauce' },
  { url: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8', title: 'Seafood Platter', desc: 'Ocean-fresh catches prepared to perfection' },
  { url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe', title: 'Breakfast Bowl', desc: 'Energizing start with superfoods and proteins' }
];

export default function DiscoverSection({ 
  currentUser, 
  onRestaurantClick, 
  onFavoriteToggle, 
  favoriteIds,
  userLocation 
}) {
  const [hoveredImage, setHoveredImage] = useState(null);
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['allRestaurants'],
    queryFn: () => base44.entities.Restaurant.filter({ status: 'approved' }),
  });

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

  // Get unique achievements for the current user
  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', currentUser?.id],
    queryFn: () => base44.entities.Achievement.filter({ user_id: currentUser.id }, '-earned_at'),
    enabled: !!currentUser,
  });

  // Get unique badge types
  const uniqueBadges = Array.from(new Set(userAchievements.map(a => a.badge_type)))
    .map(type => userAchievements.find(a => a.badge_type === type));

  return (
    <div className="space-y-16">
      {/* Hero Food Gallery */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-1">
        <div className="bg-white rounded-[22px] p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Discover Culinary Excellence</h2>
            <p className="text-slate-600 text-lg">Explore flavors that inspire your next dining adventure</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FOOD_IMAGES.map((food, idx) => (
              <motion.div
                key={idx}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group"
                onMouseEnter={() => setHoveredImage(idx)}
                onMouseLeave={() => setHoveredImage(null)}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={food.url}
                  alt={food.title}
                  className="w-full h-full object-cover"
                />
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300",
                  hoveredImage === idx ? "opacity-100" : "opacity-0"
                )}>
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="font-bold text-xl mb-2">{food.title}</h3>
                    <p className="text-sm text-white/90">{food.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      {currentUser && uniqueBadges.length > 0 && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-1">
          <div className="bg-white rounded-[22px] p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Your Achievements</h2>
                <p className="text-slate-600">Unlock more badges by exploring and reviewing</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {uniqueBadges.map((achievement) => (
                <motion.div
                  key={achievement.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="relative group"
                >
                  <div className="aspect-square rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 p-4 flex flex-col items-center justify-center text-center hover:border-purple-400 transition-all shadow-md hover:shadow-xl">
                    <div className="text-5xl mb-2">{achievement.badge_icon}</div>
                    <p className="font-bold text-slate-900 text-sm">{achievement.badge_name}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

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
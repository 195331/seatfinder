import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Star, Sparkles, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RestaurantCard from './RestaurantCard';
import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverSection({ 
  currentUser, 
  onRestaurantClick, 
  onFavoriteToggle, 
  favoriteIds,
  userLocation 
}) {
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

  return (
    <div className="space-y-12">
      {sections.map((section, idx) => {
        if (section.restaurants.length === 0) return null;
        
        const Icon = section.icon;
        
        return (
          <div key={idx}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
                  <Badge variant="outline" className="mt-1">
                    {section.badge}
                  </Badge>
                </div>
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
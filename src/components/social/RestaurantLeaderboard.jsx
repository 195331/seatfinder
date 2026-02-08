import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Heart, TrendingUp, Award, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";

export default function RestaurantLeaderboard({ selectedCity }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [category, setCategory] = useState('ratings');

  // Fetch restaurants
  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants', selectedCity?.id],
    queryFn: () => base44.entities.Restaurant.filter({ 
      city_id: selectedCity.id, 
      status: 'approved' 
    }),
    enabled: !!selectedCity,
  });

  // Fetch reviews
  const { data: allReviews = [] } = useQuery({
    queryKey: ['cityReviews', selectedCity?.id],
    queryFn: async () => {
      if (!selectedCity) return [];
      const cityRestaurantIds = restaurants.map(r => r.id);
      if (cityRestaurantIds.length === 0) return [];
      
      const reviews = await base44.entities.Review.filter({ is_hidden: false }, '-created_date', 500);
      return reviews.filter(r => cityRestaurantIds.includes(r.restaurant_id));
    },
    enabled: !!selectedCity && restaurants.length > 0,
  });

  // Fetch loyalty data
  const { data: loyaltyData = [] } = useQuery({
    queryKey: ['loyaltyData', selectedCity?.id],
    queryFn: async () => {
      if (!selectedCity) return [];
      const cityRestaurantIds = restaurants.map(r => r.id);
      if (cityRestaurantIds.length === 0) return [];
      
      const data = await base44.entities.CustomerLoyalty.list();
      return data.filter(l => cityRestaurantIds.includes(l.restaurant_id));
    },
    enabled: !!selectedCity && restaurants.length > 0,
  });

  // Filter by time period
  const getFilteredData = (data, dateField = 'created_date') => {
    if (period === 'all-time') return data;
    
    const now = new Date();
    const cutoff = period === 'week' 
      ? new Date(now.setDate(now.getDate() - 7))
      : new Date(now.setMonth(now.getMonth() - 1));
    
    return data.filter(item => new Date(item[dateField]) >= cutoff);
  };

  // Calculate leaderboards
  const leaderboards = useMemo(() => {
    const filteredReviews = getFilteredData(allReviews);

    // By Ratings
    const byRatings = restaurants
      .map(r => {
        const restaurantReviews = filteredReviews.filter(rev => rev.restaurant_id === r.id);
        const avgRating = restaurantReviews.length > 0
          ? restaurantReviews.reduce((sum, rev) => sum + (rev.rating || 0), 0) / restaurantReviews.length
          : 0;
        
        return {
          ...r,
          avgRating,
          reviewCount: restaurantReviews.length
        };
      })
      .filter(r => r.reviewCount >= 3)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 10);

    // Most Reviewed
    const mostReviewed = restaurants
      .map(r => ({
        ...r,
        reviewCount: filteredReviews.filter(rev => rev.restaurant_id === r.id).length
      }))
      .filter(r => r.reviewCount > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 10);

    // Most Favorited
    const mostFavorited = restaurants
      .filter(r => r.favorite_count > 0)
      .sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0))
      .slice(0, 10);

    // By Loyalty Activity
    const byLoyalty = restaurants
      .map(r => {
        const restaurantLoyalty = loyaltyData.filter(l => l.restaurant_id === r.id);
        const totalPoints = restaurantLoyalty.reduce((sum, l) => sum + (l.points_balance || 0), 0);
        const activeMembers = restaurantLoyalty.filter(l => (l.points_balance || 0) > 0).length;
        
        return {
          ...r,
          totalPoints,
          activeMembers
        };
      })
      .filter(r => r.activeMembers > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10);

    // Trending (most reviewed this week vs last month)
    const weekReviews = getFilteredData(allReviews, 'created_date');
    const trending = restaurants
      .map(r => {
        const weekCount = weekReviews.filter(rev => rev.restaurant_id === r.id).length;
        return { ...r, weekCount };
      })
      .filter(r => r.weekCount > 0)
      .sort((a, b) => b.weekCount - a.weekCount)
      .slice(0, 10);

    return {
      byRatings,
      mostReviewed,
      mostFavorited,
      byLoyalty,
      trending
    };
  }, [restaurants, allReviews, loyaltyData, period]);

  const getMedalColor = (index) => {
    if (index === 0) return 'text-yellow-500';
    if (index === 1) return 'text-slate-400';
    if (index === 2) return 'text-amber-600';
    return 'text-slate-300';
  };

  const renderRestaurantRow = (restaurant, index, metric) => (
    <div
      key={restaurant.id}
      onClick={() => navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`)}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
    >
      <Trophy className={cn("w-6 h-6", getMedalColor(index))} />
      <span className="font-semibold text-slate-900">#{index + 1}</span>
      
      {restaurant.cover_image && (
        <img
          src={restaurant.cover_image}
          alt={restaurant.name}
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}

      <div className="flex-1">
        <h4 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
          {restaurant.name}
        </h4>
        <p className="text-sm text-slate-600">{restaurant.cuisine} • {restaurant.neighborhood}</p>
      </div>

      <div className="text-right">
        {metric === 'rating' && (
          <div className="flex items-center gap-1">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span className="font-bold text-lg text-slate-900">{restaurant.avgRating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({restaurant.reviewCount} reviews)</span>
          </div>
        )}
        {metric === 'reviews' && (
          <div>
            <p className="font-bold text-lg text-slate-900">{restaurant.reviewCount}</p>
            <p className="text-xs text-slate-500">reviews</p>
          </div>
        )}
        {metric === 'favorites' && (
          <div>
            <p className="font-bold text-lg text-slate-900">{restaurant.favorite_count}</p>
            <p className="text-xs text-slate-500">favorites</p>
          </div>
        )}
        {metric === 'loyalty' && (
          <div>
            <p className="font-bold text-lg text-slate-900">{restaurant.activeMembers}</p>
            <p className="text-xs text-slate-500">active members</p>
          </div>
        )}
        {metric === 'trending' && (
          <div>
            <p className="font-bold text-lg text-emerald-600">{restaurant.weekCount}</p>
            <p className="text-xs text-slate-500">reviews this week</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Restaurant Leaderboard
          </CardTitle>
          <Tabs value={period} onValueChange={setPeriod} className="w-auto">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="all-time" className="text-xs">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="w-full bg-slate-50 mb-4">
            <TabsTrigger value="ratings" className="flex-1 gap-1.5">
              <Star className="w-4 h-4" />
              Top Rated
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 gap-1.5">
              <Users className="w-4 h-4" />
              Most Reviewed
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex-1 gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex-1 gap-1.5">
              <Award className="w-4 h-4" />
              Loyalty
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ratings" className="space-y-2">
            {leaderboards.byRatings.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Not enough reviews yet
              </div>
            ) : (
              leaderboards.byRatings.map((r, idx) => renderRestaurantRow(r, idx, 'rating'))
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-2">
            {leaderboards.mostReviewed.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No reviews yet
              </div>
            ) : (
              leaderboards.mostReviewed.map((r, idx) => renderRestaurantRow(r, idx, 'reviews'))
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-2">
            {leaderboards.trending.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No trending restaurants this week
              </div>
            ) : (
              leaderboards.trending.map((r, idx) => renderRestaurantRow(r, idx, 'trending'))
            )}
          </TabsContent>

          <TabsContent value="loyalty" className="space-y-2">
            {leaderboards.byLoyalty.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No loyalty data available
              </div>
            ) : (
              leaderboards.byLoyalty.map((r, idx) => renderRestaurantRow(r, idx, 'loyalty'))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
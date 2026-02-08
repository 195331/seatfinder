import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Star, Heart, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FriendRecommendations({ currentUser, onRestaurantClick }) {
  const navigate = useNavigate();

  // Get users the current user is following
  const { data: following = [] } = useQuery({
    queryKey: ['following', currentUser?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const followingIds = following.map(f => f.following_id);

  // Get reviews from people user follows
  const { data: friendReviews = [] } = useQuery({
    queryKey: ['friendReviews', followingIds.join(',')],
    queryFn: async () => {
      if (followingIds.length === 0) return [];
      const reviews = await base44.entities.Review.filter({ is_hidden: false }, '-created_date', 100);
      return reviews.filter(r => followingIds.includes(r.user_id));
    },
    enabled: followingIds.length > 0,
  });

  // Get favorites from people user follows
  const { data: friendFavorites = [] } = useQuery({
    queryKey: ['friendFavorites', followingIds.join(',')],
    queryFn: async () => {
      if (followingIds.length === 0) return [];
      const favorites = await base44.entities.Favorite.list();
      return favorites.filter(f => followingIds.includes(f.user_id));
    },
    enabled: followingIds.length > 0,
  });

  // Aggregate restaurant recommendations
  const recommendations = React.useMemo(() => {
    const restaurantMap = {};

    // Add from reviews
    friendReviews.forEach(review => {
      if (!restaurantMap[review.restaurant_id]) {
        restaurantMap[review.restaurant_id] = {
          restaurantId: review.restaurant_id,
          reviewCount: 0,
          totalRating: 0,
          favoriteCount: 0,
          reviewers: new Set(),
          latestActivity: review.created_date
        };
      }
      const data = restaurantMap[review.restaurant_id];
      data.reviewCount++;
      data.totalRating += review.rating || 0;
      data.reviewers.add(review.user_name || 'Anonymous');
      if (new Date(review.created_date) > new Date(data.latestActivity)) {
        data.latestActivity = review.created_date;
      }
    });

    // Add from favorites
    friendFavorites.forEach(fav => {
      if (!restaurantMap[fav.restaurant_id]) {
        restaurantMap[fav.restaurant_id] = {
          restaurantId: fav.restaurant_id,
          reviewCount: 0,
          totalRating: 0,
          favoriteCount: 0,
          reviewers: new Set(),
          latestActivity: fav.created_date
        };
      }
      restaurantMap[fav.restaurant_id].favoriteCount++;
    });

    return Object.values(restaurantMap)
      .map(r => ({
        ...r,
        avgRating: r.reviewCount > 0 ? r.totalRating / r.reviewCount : 0,
        reviewers: Array.from(r.reviewers),
        score: (r.reviewCount * 3) + (r.favoriteCount * 2) + (r.avgRating * 5)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [friendReviews, friendFavorites]);

  // Fetch restaurant details
  const { data: restaurants = [] } = useQuery({
    queryKey: ['recommendedRestaurants', recommendations.map(r => r.restaurantId).join(',')],
    queryFn: async () => {
      if (recommendations.length === 0) return [];
      const restaurantPromises = recommendations.map(r =>
        base44.entities.Restaurant.filter({ id: r.restaurantId }).then(res => res[0])
      );
      return (await Promise.all(restaurantPromises)).filter(Boolean);
    },
    enabled: recommendations.length > 0,
  });

  if (!currentUser || followingIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2">Follow friends to see their recommendations</h3>
          <p className="text-slate-500 text-sm">
            Discover great restaurants through people you trust
          </p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600">
            Your friends haven't reviewed or favorited any restaurants yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          Friends' Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map(restaurant => {
            const recData = recommendations.find(r => r.restaurantId === restaurant.id);
            if (!recData) return null;

            return (
              <Card key={restaurant.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  {restaurant.cover_image && (
                    <img
                      src={restaurant.cover_image}
                      alt={restaurant.name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}
                  <h4 className="font-semibold text-slate-900 mb-1">{restaurant.name}</h4>
                  <p className="text-sm text-slate-600 mb-2">{restaurant.cuisine}</p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {recData.reviewCount > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {recData.avgRating.toFixed(1)}
                      </Badge>
                    )}
                    {recData.favoriteCount > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Heart className="w-3 h-3 text-red-500" />
                        {recData.favoriteCount}
                      </Badge>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-1">Recommended by:</p>
                    <p className="text-sm font-medium text-emerald-600">
                      {recData.reviewers.slice(0, 2).join(', ')}
                      {recData.reviewers.length > 2 && ` +${recData.reviewers.length - 2} more`}
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      if (onRestaurantClick) {
                        onRestaurantClick(restaurant);
                      } else {
                        navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                  >
                    View Details
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
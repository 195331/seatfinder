import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Heart, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import RestaurantCard from '@/components/customer/RestaurantCard';

export default function Favorites() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        } else {
          navigate(createPageUrl('Home'));
        }
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: favorites = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['favoriteRestaurants', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const restaurantPromises = favorites.map(f => 
        base44.entities.Restaurant.filter({ id: f.restaurant_id }).then(r => r[0])
      );
      return Promise.all(restaurantPromises);
    },
    enabled: favorites.length > 0,
  });

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.restaurant_id)), [favorites]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (restaurant) => {
      const existingFav = favorites.find(f => f.restaurant_id === restaurant.id);
      if (existingFav) {
        await base44.entities.Favorite.delete(existingFav.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
      queryClient.invalidateQueries(['favoriteRestaurants']);
    }
  });

  const filteredRestaurants = useMemo(() => {
    if (!search) return restaurants.filter(Boolean);
    const searchLower = search.toLowerCase();
    return restaurants.filter(r => 
      r && (
        r.name?.toLowerCase().includes(searchLower) ||
        r.cuisine?.toLowerCase().includes(searchLower)
      )
    );
  }, [restaurants, search]);

  const isLoading = loadingFavorites || loadingRestaurants;

  const handleRestaurantClick = (restaurant) => {
    navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Favorites</h1>
              <p className="text-sm text-slate-500">
                {favorites.length} saved restaurant{favorites.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {favorites.length > 0 && (
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search favorites..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-full border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden">
                <Skeleton className="aspect-[16/10]" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Heart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No favorites yet</h2>
            <p className="text-slate-500 mb-6">
              Start exploring and save your favorite restaurants
            </p>
            <Button 
              onClick={() => navigate(createPageUrl('Home'))}
              className="rounded-full"
            >
              Explore Restaurants
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={favoriteIds.has(restaurant.id)}
                onFavoriteToggle={(r) => toggleFavoriteMutation.mutate(r)}
                onClick={handleRestaurantClick}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
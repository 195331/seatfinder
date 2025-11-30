import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, List, Map, Heart } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';

import CitySelector from '@/components/customer/CitySelector';
import FilterPanel from '@/components/customer/FilterPanel';
import RestaurantCard from '@/components/customer/RestaurantCard';
import RestaurantMap from '@/components/customer/RestaurantMap';
import ProfileDrawer from '@/components/profile/ProfileDrawer';

const DEFAULT_PRESETS = [
  { id: 'date-night', name: 'Date Night', icon: '💕', filters: { priceLevel: 3, seatingLevel: 'chill' } },
  { id: 'quick-lunch', name: 'Quick Lunch', icon: '⚡', filters: { seatingLevel: 'chill', openNow: true } },
  { id: 'friends', name: 'Friends Hangout', icon: '👯', filters: { hasBarSeating: true } },
];

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [activePreset, setActivePreset] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedMapRestaurant, setSelectedMapRestaurant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        }
      } catch (e) {
        // Guest mode
      }
    };
    fetchUser();
  }, []);

  // Fetch cities
  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.filter({ is_active: true }),
  });

  // Set default city
  useEffect(() => {
    if (cities.length > 0 && !selectedCity) {
      const defaultCity = cities.find(c => c.slug === 'jersey-city') || cities[0];
      setSelectedCity(defaultCity);
    }
  }, [cities, selectedCity]);

  // Fetch restaurants
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['restaurants', selectedCity?.id],
    queryFn: () => base44.entities.Restaurant.filter({ 
      city_id: selectedCity.id,
      status: 'approved'
    }),
    enabled: !!selectedCity,
  });

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.restaurant_id)), [favorites]);

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (restaurant) => {
      if (!currentUser) {
        navigate(createPageUrl('Login'));
        return;
      }
      const existingFav = favorites.find(f => f.restaurant_id === restaurant.id);
      if (existingFav) {
        await base44.entities.Favorite.delete(existingFav.id);
        await base44.entities.Restaurant.update(restaurant.id, {
          favorite_count: Math.max(0, (restaurant.favorite_count || 1) - 1)
        });
      } else {
        await base44.entities.Favorite.create({
          user_id: currentUser.id,
          restaurant_id: restaurant.id
        });
        await base44.entities.Restaurant.update(restaurant.id, {
          favorite_count: (restaurant.favorite_count || 0) + 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
      queryClient.invalidateQueries(['restaurants']);
    }
  });

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(r => 
        r.name?.toLowerCase().includes(searchLower) ||
        r.cuisine?.toLowerCase().includes(searchLower) ||
        r.neighborhood?.toLowerCase().includes(searchLower)
      );
    }

    // Filters
    if (filters.priceLevel) {
      result = result.filter(r => r.price_level === filters.priceLevel);
    }
    if (filters.cuisines?.length > 0) {
      result = result.filter(r => filters.cuisines.includes(r.cuisine));
    }
    if (filters.seatingLevel && filters.seatingLevel !== 'any') {
      result = result.filter(r => {
        const occupancy = r.total_seats > 0 
          ? ((r.total_seats - r.available_seats) / r.total_seats) * 100 
          : 0;
        if (filters.seatingLevel === 'chill') return occupancy < 60;
        if (filters.seatingLevel === 'moderate') return occupancy < 85;
        return true;
      });
    }
    if (filters.hasOutdoor) result = result.filter(r => r.has_outdoor);
    if (filters.hasBarSeating) result = result.filter(r => r.has_bar_seating);
    if (filters.isKidFriendly) result = result.filter(r => r.is_kid_friendly);

    // Sort: restaurants with recent updates appear higher
    result.sort((a, b) => {
      const aTime = a.seating_updated_at ? new Date(a.seating_updated_at).getTime() : 0;
      const bTime = b.seating_updated_at ? new Date(b.seating_updated_at).getTime() : 0;
      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;
      
      // Prioritize "live" restaurants (updated within 15 min)
      const aIsLive = aTime > now - fifteenMinutes;
      const bIsLive = bTime > now - fifteenMinutes;
      
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;
      
      // Then sort by most recent update
      return bTime - aTime;
    });

    return result;
  }, [restaurants, search, filters]);

  const handlePresetSelect = (preset) => {
    if (activePreset?.id === preset.id) {
      setActivePreset(null);
      setFilters({});
    } else {
      setActivePreset(preset);
      setFilters(preset.filters);
    }
  };

  const handleRestaurantClick = (restaurant) => {
    navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`);
  };

  const mapCenter = selectedCity ? [selectedCity.latitude, selectedCity.longitude] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {currentUser ? (
                <ProfileDrawer 
                  currentUser={currentUser} 
                  onLogout={() => base44.auth.logout(createPageUrl('Home'))}
                />
              ) : (
                <button 
                  onClick={() => base44.auth.redirectToLogin(window.location.href)}
                  className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <span className="text-white font-bold text-lg">S</span>
                </button>
              )}
              <CitySelector 
                cities={cities}
                selectedCity={selectedCity}
                onCityChange={setSelectedCity}
              />
            </div>

            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by name or cuisine..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 rounded-full border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tabs value={view} onValueChange={setView}>
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="list" className="gap-1.5">
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">List</span>
                  </TabsTrigger>
                  <TabsTrigger value="map" className="gap-1.5">
                    <Map className="w-4 h-4" />
                    <span className="hidden sm:inline">Map</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {currentUser && (
                <Link to={createPageUrl('Favorites')}>
                  <button className="p-2 rounded-full hover:bg-slate-100 relative">
                    <Heart className="w-5 h-5 text-slate-600" />
                    {favorites.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {favorites.length}
                      </span>
                    )}
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Search */}
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name or cuisine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-full border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              presets={DEFAULT_PRESETS}
              activePreset={activePreset}
              onPresetSelect={handlePresetSelect}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loadingRestaurants ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden">
                <Skeleton className="aspect-[16/10]" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : view === 'list' ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-600">
                {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            {filteredRestaurants.length === 0 && (
              <div className="text-center py-16">
                <p className="text-slate-500 text-lg">No restaurants match your filters</p>
                <button 
                  onClick={() => setFilters({})}
                  className="mt-2 text-emerald-600 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="h-[calc(100vh-280px)] min-h-[500px]">
            <RestaurantMap
              restaurants={filteredRestaurants}
              center={mapCenter}
              selectedRestaurant={selectedMapRestaurant}
              onRestaurantSelect={setSelectedMapRestaurant}
              onRestaurantClick={handleRestaurantClick}
            />
          </div>
        )}
      </main>
    </div>
  );
}
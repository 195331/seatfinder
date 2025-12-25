import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Map, Heart, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";

import CitySelector from '@/components/customer/CitySelector';
import FilterPanel from '@/components/customer/FilterPanel';
import RestaurantCard from '@/components/customer/RestaurantCard';
import RestaurantMap from '@/components/customer/RestaurantMap';
import ProfileDrawer from '@/components/profile/ProfileDrawer';
import AISmartSearch from '@/components/ai/AISmartSearch';
import RecentlyViewed from '@/components/customer/RecentlyViewed';
import ExpressProfileSetup from '@/components/customer/ExpressProfileSetup';
import { getIsVerifiedLive, getIsStale } from '@/components/ui/FreshnessIndicator';
import { Switch } from "@/components/ui/switch";

const DEFAULT_PRESETS = [
  { id: 'date-night', name: 'Date Night', icon: '💕', filters: { priceLevel: 3, seatingLevel: 'chill' } },
  { id: 'quick-lunch', name: 'Quick Lunch', icon: '⚡', filters: { seatingLevel: 'chill', openNow: true } },
  { id: 'friends', name: 'Friends Hangout', icon: '👯', filters: { hasBarSeating: true } },
  { id: 'family', name: 'Family Dinner', icon: '👨‍👩‍👧‍👦', filters: { isKidFriendly: true, seatingLevel: 'moderate' } },
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
  const [showExpressSetup, setShowExpressSetup] = useState(false);
  const [onlyVerifiedLive, setOnlyVerifiedLive] = useState(false);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        } else {
          // Redirect to landing if not authenticated and not explicitly choosing to browse
          const hasSeenLanding = sessionStorage.getItem('browsing_as_guest');
          if (!hasSeenLanding) {
            navigate(createPageUrl('Landing'));
          }
        }
      } catch (e) {
        // Guest mode - check if they've explicitly chosen to browse
        const hasSeenLanding = sessionStorage.getItem('browsing_as_guest');
        if (!hasSeenLanding) {
          navigate(createPageUrl('Landing'));
        }
      }
    };
    fetchUser();
  }, [navigate]);

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
    
    // Only Verified Live filter
    if (onlyVerifiedLive) {
      result = result.filter(r => getIsVerifiedLive(r.seating_updated_at));
    }

    // Sort: verified live first, then reliable, then taste profile matches
    result.sort((a, b) => {
      // Priority 1: Verified Live
      const aVerified = getIsVerifiedLive(a.seating_updated_at);
      const bVerified = getIsVerifiedLive(b.seating_updated_at);
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      
      // Priority 2: Reliable restaurants
      const aReliable = a.reliability_score >= 80;
      const bReliable = b.reliability_score >= 80;
      if (aReliable && !bReliable) return -1;
      if (!aReliable && bReliable) return 1;
      
      // Priority 3: Taste profile match
      const tasteProfile = currentUser?.taste_profile || {};
      let aScore = 0;
      let bScore = 0;
      
      if (tasteProfile.outdoor_seating && a.has_outdoor) aScore += 2;
      if (tasteProfile.outdoor_seating && b.has_outdoor) bScore += 2;
      if (tasteProfile.kid_friendly && a.is_kid_friendly) aScore += 2;
      if (tasteProfile.kid_friendly && b.is_kid_friendly) bScore += 2;
      if (tasteProfile.bar_seating && a.has_bar_seating) aScore += 2;
      if (tasteProfile.bar_seating && b.has_bar_seating) bScore += 2;
      
      if (aScore !== bScore) return bScore - aScore;
      
      // Priority 4: Recent updates
      const aTime = a.seating_updated_at ? new Date(a.seating_updated_at).getTime() : 0;
      const bTime = b.seating_updated_at ? new Date(b.seating_updated_at).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [restaurants, search, filters, currentUser]);

  const handlePresetSelect = (preset) => {
    if (activePreset?.id === preset.id) {
      setActivePreset(null);
      setFilters({});
    } else {
      setActivePreset(preset);
      setFilters(preset.filters);
    }
  };

  const handleRestaurantClick = async (restaurant) => {
    // Track recently viewed
    if (currentUser) {
      const recent = currentUser.recently_viewed || [];
      const updated = [restaurant.id, ...recent.filter(id => id !== restaurant.id)].slice(0, 10);
      await base44.auth.updateMe({ recently_viewed: updated }).catch(() => {});
    }
    navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`);
  };

  const mapCenter = selectedCity ? [selectedCity.latitude, selectedCity.longitude] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Promise line */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
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
              <div>
                <p className="text-slate-900 font-medium">
                  See who has open tables right now in{' '}
                  <CitySelector 
                    cities={cities}
                    selectedCity={selectedCity}
                    onCityChange={setSelectedCity}
                  />
                </p>
              </div>
            </div>

            <div className="flex-1 max-w-lg hidden md:block">
              <AISmartSearch
                onSearchChange={setSearch}
                onFiltersExtracted={(data) => {
                  if (data?.filters) {
                    setFilters(prev => ({ ...prev, ...data.filters }));
                    setActivePreset(null);
                  } else if (data === null) {
                    // Clear AI filters when search is cleared
                  }
                }}
              />
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
            <AISmartSearch
              onSearchChange={setSearch}
              onFiltersExtracted={(data) => {
                if (data?.filters) {
                  setFilters(prev => ({ ...prev, ...data.filters }));
                  setActivePreset(null);
                }
              }}
            />
          </div>

          {/* Mood Presets + Verified Live Toggle */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {DEFAULT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "px-4 py-2 rounded-full border whitespace-nowrap transition-all flex items-center gap-2",
                  activePreset?.id === preset.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                <span>{preset.icon}</span>
                <span className="text-sm font-medium">{preset.name}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full ml-2">
              <Switch checked={onlyVerifiedLive} onCheckedChange={setOnlyVerifiedLive} />
              <span className="text-sm font-medium text-emerald-800 whitespace-nowrap">Verified Live Only</span>
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
        {/* Recently Viewed */}
        <RecentlyViewed
          currentUser={currentUser}
          onFavoriteToggle={(r) => toggleFavoriteMutation.mutate(r)}
          favoriteIds={favoriteIds}
          onClick={handleRestaurantClick}
        />

        {loadingRestaurants ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
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
              <p className="text-slate-600 text-sm">
                {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} 
                {onlyVerifiedLive && ' • Verified Live'}
              </p>
              {currentUser && !currentUser.express_profile?.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExpressSetup(true)}
                  className="gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Set up Express Profile
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((restaurant) => {
                const tasteProfile = currentUser?.taste_profile || {};
                const isBestMatch = (
                  (tasteProfile.outdoor_seating && restaurant.has_outdoor) ||
                  (tasteProfile.kid_friendly && restaurant.is_kid_friendly) ||
                  (tasteProfile.bar_seating && restaurant.has_bar_seating)
                );

                return (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    isFavorite={favoriteIds.has(restaurant.id)}
                    onFavoriteToggle={(r) => toggleFavoriteMutation.mutate(r)}
                    onClick={handleRestaurantClick}
                    showBestMatch={isBestMatch}
                  />
                );
              })}
            </div>
            {filteredRestaurants.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔍</span>
                </div>
                <p className="text-slate-900 font-semibold text-lg mb-2">No restaurants found</p>
                <p className="text-slate-500 mb-6">Try adjusting your filters or exploring a different vibe</p>
                <button 
                  onClick={() => {
                    setFilters({});
                    setActivePreset(null);
                  }}
                  className="px-6 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
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

        {/* Express Profile Setup Dialog */}
        <ExpressProfileSetup
        open={showExpressSetup}
        onOpenChange={setShowExpressSetup}
        currentUser={currentUser}
        />
        </div>
        );
        }
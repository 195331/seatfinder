import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Map, Heart, Zap, ChefHat, MapPin, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import CitySelector from '@/components/customer/CitySelector';
import FilterPanel from '@/components/customer/FilterPanel';
import RestaurantCard from '@/components/customer/RestaurantCard';
import RestaurantMap from '@/components/customer/RestaurantMap';
import ProfileDrawer from '@/components/profile/ProfileDrawer';
import AISmartSearch from '@/components/ai/AISmartSearch';
import DinerAI from '@/components/ai/DinerAI';
import AISearchSuggestions from '@/components/ai/AISearchSuggestions';
import RecentlyViewed from '@/components/customer/RecentlyViewed';
import ExpressProfileSetup from '@/components/customer/ExpressProfileSetup';
import MoodBoardManager from '@/components/customer/MoodBoardManager';
import NotificationBell from '@/components/notifications/NotificationBell';
import SurpriseMe from '@/components/ai/SurpriseMe';
import DiscoverSection from '@/components/customer/DiscoverSection';
import PersonalizedRecommendations from '@/components/customer/PersonalizedRecommendations';
import AIConcierge from '@/components/ai/AIConcierge';
import NetflixCollections from '@/components/home/NetflixCollections';
import NetflixTopRated from '@/components/home/NetflixTopRated';
import Leaderboard from '@/components/social/Leaderboard';
import MoodBoardCreator from '@/components/social/MoodBoardCreator';
import FriendRecommendations from '@/components/social/FriendRecommendations';
import SocialFeed from '@/components/social/SocialFeed';
import RestaurantLeaderboard from '@/components/social/RestaurantLeaderboard';
import FoodDiscoveryGrid from '@/components/home/FoodDiscoveryGrid';
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
  const [showAISearch, setShowAISearch] = useState(false);
  const [aiSearchQuery, setAISearchQuery] = useState('');
  const [aiTrigger, setAITrigger] = useState(0);
  const aiResultsRef = useRef(null);
  const [activeSection, setActiveSection] = useState('explore');
  const [exploreView, setExploreView] = useState('all'); // 'all', 'discover', 'foryou'
  const [userLocation, setUserLocation] = useState(null);
  const [sortBy, setSortBy] = useState('verified'); // 'verified', 'distance', 'rating'
  const [showSurpriseMe, setShowSurpriseMe] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const mapRef = useRef(null);

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

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied');
        }
      );
    }
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

  // Fetch restaurants with real-time polling
  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['restaurants', selectedCity?.id],
    queryFn: () => base44.entities.Restaurant.filter({ 
      city_id: selectedCity.id,
      status: 'approved'
    }),
    enabled: !!selectedCity,
    refetchInterval: 30000, // Refresh every 30 seconds for live availability
  });

  // Fetch reviews for vibe meter
  const { data: allReviews = [] } = useQuery({
    queryKey: ['cityReviews', selectedCity?.id],
    queryFn: async () => {
      if (!selectedCity?.id) return [];
      const cityRestaurants = restaurants.map(r => r.id);
      if (cityRestaurants.length === 0) return [];
      // Fetch reviews for visible restaurants
      const reviewPromises = cityRestaurants.slice(0, 20).map(id =>
        base44.entities.Review.filter({ restaurant_id: id, is_hidden: false }).catch(() => [])
      );
      const reviewArrays = await Promise.all(reviewPromises);
      return reviewArrays.flat();
    },
    enabled: !!selectedCity && restaurants.length > 0,
  });

  // Fetch past reservations for "Dine Again"
  const { data: pastReservations = [] } = useQuery({
    queryKey: ['pastReservations', currentUser?.id],
    queryFn: () => base44.entities.Reservation.filter({ user_id: currentUser.id, status: 'checked_in' }),
    enabled: !!currentUser,
  });
  const pastReservationRestaurantIds = useMemo(() => [...new Set(pastReservations.map(r => r.restaurant_id))], [pastReservations]);

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
        try {
          await base44.entities.Favorite.delete(existingFav.id);
          await base44.entities.Restaurant.update(restaurant.id, {
            favorite_count: Math.max(0, (restaurant.favorite_count || 1) - 1)
          });
        } catch (error) {
          // Favorite might already be deleted, just refresh the list
          console.log('Favorite already removed');
        }
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

  // Calculate distance helper
  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter and sort restaurants
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];

    // Add distance to each restaurant
    if (userLocation) {
      result = result.map(r => ({
        ...r,
        distance: r.latitude && r.longitude 
          ? getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude)
          : null
      }));
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(r => 
        r.name?.toLowerCase().includes(searchLower) ||
        r.cuisine?.toLowerCase().includes(searchLower) ||
        r.neighborhood?.toLowerCase().includes(searchLower)
      );
    }

    // Apply user preferences from settings
    const userPreferences = currentUser?.preferences || {};
    if (userPreferences.dietary_restrictions?.length > 0) {
      // Filter based on dietary restrictions (would need menu/dietary info on restaurants)
      // For now, just track for AI recommendations
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
    
    // Advanced amenity filters
    if (filters.liveMusic) result = result.filter(r => r.has_live_music);
    if (filters.parking) result = result.filter(r => r.has_parking);
    if (filters.wifi) result = result.filter(r => r.has_wifi);
    
    // Only Verified Live filter
    if (onlyVerifiedLive) {
      result = result.filter(r => getIsVerifiedLive(r.seating_updated_at));
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'distance' && userLocation) {
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      }
      
      if (sortBy === 'rating') {
        return (b.average_rating || 0) - (a.average_rating || 0);
      }
      
      // Default: verified live first, then reliable, then taste profile
      const aVerified = getIsVerifiedLive(a.seating_updated_at);
      const bVerified = getIsVerifiedLive(b.seating_updated_at);
      if (aVerified && !bVerified) return -1;
      if (!aVerified && bVerified) return 1;
      
      const aReliable = a.reliability_score >= 80;
      const bReliable = b.reliability_score >= 80;
      if (aReliable && !bReliable) return -1;
      if (!aReliable && bReliable) return 1;
      
      const tasteProfile = currentUser?.taste_profile || {};
      const preferences = currentUser?.preferences || {};
      let aScore = 0;
      let bScore = 0;
      
      // Taste profile matching
      if (tasteProfile.outdoor_seating && a.has_outdoor) aScore += 2;
      if (tasteProfile.outdoor_seating && b.has_outdoor) bScore += 2;
      if (tasteProfile.kid_friendly && a.is_kid_friendly) aScore += 2;
      if (tasteProfile.kid_friendly && b.is_kid_friendly) bScore += 2;
      if (tasteProfile.bar_seating && a.has_bar_seating) aScore += 2;
      if (tasteProfile.bar_seating && b.has_bar_seating) bScore += 2;
      
      // Cuisine preferences
      if (preferences.favorite_cuisines?.includes(a.cuisine)) aScore += 3;
      if (preferences.favorite_cuisines?.includes(b.cuisine)) bScore += 3;
      
      // Amenity preferences
      if (preferences.preferred_amenities?.includes('outdoor') && a.has_outdoor) aScore += 1;
      if (preferences.preferred_amenities?.includes('outdoor') && b.has_outdoor) bScore += 1;
      if (preferences.preferred_amenities?.includes('bar') && a.has_bar_seating) aScore += 1;
      if (preferences.preferred_amenities?.includes('bar') && b.has_bar_seating) bScore += 1;
      
      if (aScore !== bScore) return bScore - aScore;
      
      const aTime = a.seating_updated_at ? new Date(a.seating_updated_at).getTime() : 0;
      const bTime = b.seating_updated_at ? new Date(b.seating_updated_at).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [restaurants, search, filters, onlyVerifiedLive, currentUser, userLocation, sortBy]);

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
    
    // Track click event
    await base44.entities.AnalyticsEvent.create({
      restaurant_id: restaurant.id,
      event_type: 'restaurant_card_click',
      user_id: currentUser?.id,
      metadata: { source: 'home_page', view_type: view }
    }).catch(() => {});
    
    navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`);
  };

  const handleFavoriteClick = async (restaurant) => {
    await toggleFavoriteMutation.mutateAsync(restaurant);
    
    // Track favorite event
    await base44.entities.AnalyticsEvent.create({
      restaurant_id: restaurant.id,
      event_type: favoriteIds.has(restaurant.id) ? 'unfavorite' : 'favorite',
      user_id: currentUser?.id
    }).catch(() => {});
  };

  const mapCenter = selectedCity ? [selectedCity.latitude, selectedCity.longitude] : null;

  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // Single source of truth for filter chips
  const filterChips = React.useMemo(() => {
    const chips = [
      ...(DEFAULT_PRESETS || []).map(preset => ({
        id: preset.id,
        type: 'preset',
        icon: preset.icon,
        label: preset.name,
        active: activePreset?.id === preset.id,
        onClick: () => handlePresetSelect(preset)
      })),
      {
        id: 'verified-live',
        type: 'toggle',
        icon: '✓',
        label: 'Verified Live',
        active: onlyVerifiedLive,
        onClick: () => setOnlyVerifiedLive(!onlyVerifiedLive)
      }
    ];

    if (userLocation) {
      chips.push({
        id: 'near-me',
        type: 'toggle',
        icon: '📍',
        label: 'Near Me',
        active: filters.nearMe,
        onClick: () => {
          setFilters(prev => ({ ...prev, nearMe: !prev.nearMe }));
          if (!filters.nearMe) setSortBy('distance');
        }
      });
    }

    return chips;
  }, [activePreset, onlyVerifiedLive, userLocation, sortBy]);

  return (
    <div className="min-h-screen bg-white">
      {/* Announcement Banner */}
      {showAnnouncement && (
        <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white py-3 px-4 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold text-sm md:text-base">New Feature Alert!</p>
                <p className="text-xs md:text-sm opacity-90">Restaurants are beginning to add pre-order menus - reserve your table and order ahead!</p>
              </div>
            </div>
            <button
              onClick={() => setShowAnnouncement(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0"
              aria-label="Close announcement"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Premium Header with Aurora Glow */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
        {/* Aurora glow background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-orange-500/5 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 py-4 relative">
          {/* Row 1: Logo + Search + Actions */}
          <div className="flex items-center gap-4 mb-3">
            {/* Left: Logo + Location */}
            <div className="flex items-center gap-3">
              {currentUser ? (
                <ProfileDrawer 
                  currentUser={currentUser} 
                  onLogout={() => base44.auth.logout(createPageUrl('Home'))}
                />
              ) : (
                <button 
                  onClick={() => base44.auth.redirectToLogin(window.location.href)}
                  className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center hover:opacity-90 transition-all hover:shadow-lg hover:shadow-purple-500/30"
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

            {/* Center: Hero Search */}
            <div className="flex-1 max-w-2xl mx-auto">
              <div className="relative">
                {showAISearch ? (
                  <>
                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
                    <input
                      type="text"
                      value={aiSearchQuery}
                      onChange={(e) => setAISearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aiSearchQuery.trim()) { setAITrigger(t => t + 1); setTimeout(() => aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
                      }}
                      placeholder="Ask AI: 'romantic Italian spot' or 'kid-friendly brunch'…"
                      autoFocus
                      className="w-full h-12 px-6 pl-10 pr-28 rounded-full bg-purple-50 border-2 border-purple-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-sm text-slate-900 placeholder:text-purple-300"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        onClick={() => { if (aiSearchQuery.trim()) { setAITrigger(t => t + 1); setTimeout(() => aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } }}
                        disabled={!aiSearchQuery.trim()}
                        className="h-8 px-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-40"
                      >
                        Search
                      </button>
                      <button 
                        onClick={() => { setShowAISearch(false); setAISearchQuery(''); }}
                        className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-all text-slate-600 text-xs"
                        title="Close AI search"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={() => setShowAISuggestions(true)}
                      placeholder="Search restaurants, cuisine, vibe…"
                      className="w-full h-12 px-6 pr-12 rounded-full bg-white border-2 border-slate-200 hover:border-purple-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-sm text-slate-900 placeholder:text-slate-400"
                    />
                    <button 
                      onClick={() => { setShowAISearch(true); setSearch(''); setShowAISuggestions(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                    >
                      <Zap className="w-4 h-4 text-white" />
                    </button>
                    {/* AI Search Suggestions */}
                    {showAISuggestions && (
                      <AISearchSuggestions
                        searchQuery={search}
                        onSuggestionClick={(suggestion) => {
                          setSearch(suggestion);
                          setShowAISuggestions(false);
                        }}
                        onClose={() => setShowAISuggestions(false)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* List/Map Toggle */}
              <div className="hidden sm:flex items-center bg-slate-100 rounded-full p-1">
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    view === 'list' ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setView('map');
                    setTimeout(() => {
                      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    view === 'map' ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Map className="w-4 h-4" />
                </button>
              </div>

              {currentUser && (
                <>
                  <NotificationBell currentUser={currentUser} />
                  <Link to={createPageUrl('Favorites')}>
                    <button className="p-2 rounded-full hover:bg-slate-100 relative transition-colors">
                      <Heart className="w-5 h-5 text-slate-600" />
                      {favorites.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {favorites.length}
                        </span>
                      )}
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Filter Chips + AI Actions */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
            {/* Filters Button - Left Side */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all shrink-0 gap-2 flex items-center",
                showFilterPanel 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-500 shadow-md" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:shadow-md"
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {(filterChips || []).map((chip) => (
                <button
                  key={chip.id}
                  onClick={chip.onClick}
                  className={cn(
                    "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-all shrink-0",
                    chip.active
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg shadow-purple-500/30"
                      : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:shadow-md"
                  )}
                >
                  <span className="mr-1.5">{chip.icon}</span>
                  {chip.label}
                </button>
              ))}
            </div>

            {/* AI Actions */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <Link to={createPageUrl('MealPlanner')}>
                <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-orange-300 text-sm font-medium text-slate-700 hover:text-orange-600 transition-all hover:shadow-md">
                  <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 whitespace-nowrap">New Beta Feature</span>
                  <ChefHat className="w-4 h-4" />
                  Meal Planner
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Background Watermark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.02] select-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] font-black text-slate-900 whitespace-nowrap">
          SEATFINDER
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Recently Viewed - Always at top */}
        <RecentlyViewed
          currentUser={currentUser}
          onFavoriteToggle={handleFavoriteClick}
          favoriteIds={favoriteIds}
          onClick={handleRestaurantClick}
        />

        {/* First 6 Restaurant Cards - Always shown */}
        {!loadingRestaurants && filteredRestaurants.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Top Picks for You
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRestaurants.slice(0, 6).map((restaurant) => {
                const tasteProfile = currentUser?.taste_profile || {};
                const isBestMatch = (
                  (tasteProfile.outdoor_seating && restaurant.has_outdoor) ||
                  (tasteProfile.kid_friendly && restaurant.is_kid_friendly) ||
                  (tasteProfile.bar_seating && restaurant.has_bar_seating)
                );

                return (
                  <motion.div
                    key={restaurant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RestaurantCard
                      restaurant={restaurant}
                      isFavorite={favoriteIds.has(restaurant.id)}
                      onFavoriteToggle={handleFavoriteClick}
                      onClick={handleRestaurantClick}
                      showBestMatch={isBestMatch}
                      distance={restaurant.distance}
                      reviews={allReviews.filter(r => r.restaurant_id === restaurant.id)}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Premium Segmented Toggle for Explore / Mood Boards */}
        {currentUser && (
          <div className="mb-8">
            <div className="inline-flex bg-white rounded-full p-1.5 border border-slate-200 shadow-sm">
              <button
                onClick={() => setActiveSection('explore')}
                className={cn(
                  "relative px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                  activeSection === 'explore'
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {activeSection === 'explore' && (
                  <motion.div
                    layoutId="activeSection"
                    className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg shadow-purple-500/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Explore
                </span>
              </button>
              <button
                onClick={() => setActiveSection('moodboards')}
                className={cn(
                  "relative px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                  activeSection === 'moodboards'
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {activeSection === 'moodboards' && (
                  <motion.div
                    layoutId="activeSection"
                    className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg shadow-purple-500/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Mood Boards
                </span>
              </button>
            </div>
          </div>
        )}

        {currentUser && activeSection === 'moodboards' && (
          <MoodBoardManager 
            currentUser={currentUser}
            allRestaurants={restaurants}
            onRestaurantClick={handleRestaurantClick}
          />
        )}

        {(!currentUser || activeSection === 'explore') && (
          <>
            {/* Explore View Tabs */}
            {currentUser && (
              <div className="mb-8">
                <div className="inline-flex bg-white rounded-full p-1.5 border border-slate-200 shadow-sm">
                  <button
                    onClick={() => setExploreView('all')}
                    className={cn(
                      "px-6 py-2 rounded-full text-sm font-medium transition-all",
                      exploreView === 'all' 
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    All Restaurants
                  </button>
                  <button
                    onClick={() => setExploreView('foryou')}
                    className={cn(
                      "px-6 py-2 rounded-full text-sm font-medium transition-all",
                      exploreView === 'foryou' 
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    For You
                  </button>
                  <button
                    onClick={() => setExploreView('discover')}
                    className={cn(
                      "px-6 py-2 rounded-full text-sm font-medium transition-all",
                      exploreView === 'discover' 
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Discover
                  </button>
                </div>
              </div>
            )}

            {/* Personalized For You */}
            {currentUser && exploreView === 'foryou' && (
              <PersonalizedRecommendations
                currentUser={currentUser}
                onRestaurantClick={handleRestaurantClick}
                onFavoriteToggle={handleFavoriteClick}
                favoriteIds={favoriteIds}
              />
            )}

            {/* Discover Section */}
            {currentUser && exploreView === 'discover' && (
              <>
                {/* Social Feed */}
                <div className="mt-8">
                  <SocialFeed currentUser={currentUser} />
                </div>

                {/* Friend Recommendations */}
                <div className="mt-8">
                  <FriendRecommendations 
                    currentUser={currentUser}
                    onRestaurantClick={handleRestaurantClick}
                  />
                </div>

                {/* Restaurant Leaderboard */}
                <div className="mt-8">
                  <RestaurantLeaderboard selectedCity={selectedCity} />
                </div>

                <div className="mt-12 flex justify-end">
                  <MoodBoardCreator
                    currentUser={currentUser}
                    allRestaurants={restaurants}
                  />
                </div>
                <div className="mt-6">
                  <Leaderboard currentUser={currentUser} />
                </div>
                <div className="mt-12">
                  <DiscoverSection
                    currentUser={currentUser}
                    onRestaurantClick={handleRestaurantClick}
                    onFavoriteToggle={handleFavoriteClick}
                    favoriteIds={favoriteIds}
                    userLocation={userLocation}
                  />
                </div>
              </>
            )}

            {/* AI Search - Always at Top when Active */}
            <div ref={aiResultsRef} className={showAISearch ? "mb-8" : "hidden"}>
              <DinerAI
                restaurants={filteredRestaurants}
                currentUser={currentUser}
                onResultsClick={handleRestaurantClick}
                onFiltersApply={(filters) => setFilters(prev => ({ ...prev, ...filters }))}
                onResultsReady={() => aiResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                embeddedMode={true}
                externalQuery={aiSearchQuery}
                externalTrigger={aiTrigger}
              />
            </div>

            {/* Netflix-style Top Rated Section */}
            {exploreView === 'all' && !loadingRestaurants && filteredRestaurants.length > 0 && (
              <NetflixTopRated
                restaurants={filteredRestaurants.filter(r => r.average_rating >= 4.0).sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))}
                onRestaurantClick={handleRestaurantClick}
                favoriteIds={favoriteIds}
              />
            )}

            {/* Food Discovery Grid - replaces SmartFilters */}
            {exploreView === 'all' && !loadingRestaurants && filteredRestaurants.length > 0 && (
              <FoodDiscoveryGrid restaurants={filteredRestaurants} />
            )}

            {/* Netflix-style Collections - Always shown on All view */}
            {exploreView === 'all' && !loadingRestaurants && filteredRestaurants.length > 6 && (
              <div className="mb-12">
                <NetflixCollections
                  restaurants={filteredRestaurants}
                  userLocation={userLocation}
                  onRestaurantClick={handleRestaurantClick}
                  onFavoriteToggle={handleFavoriteClick}
                  favoriteIds={favoriteIds}
                  allReviews={allReviews}
                  pastReservationRestaurantIds={pastReservationRestaurantIds}
                />
              </div>
            )}

            {/* All Restaurants View */}
            {exploreView === 'all' && (
              <>
                {loadingRestaurants ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-md">
                        <Skeleton className="aspect-[4/3]" />
                        <div className="p-5 space-y-3">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : view === 'list' ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-slate-900">
                        {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
                      </h2>
                      <div className="flex items-center gap-2">
                        {/* Active Filter Sticker */}
                        {(sortBy !== 'verified' || Object.keys(filters).length > 0 || activePreset) && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-lg">
                            {sortBy === 'distance' ? '📍 Nearest First' : 
                             sortBy === 'rating' ? '⭐ Top Rated' :
                             activePreset ? activePreset.icon + ' ' + activePreset.name :
                             Object.keys(filters).length > 0 ? '🔍 Filtered' :
                             '✨ Best Match'}
                          </Badge>
                        )}
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="px-4 py-2 text-sm border border-slate-200 rounded-full bg-white hover:border-slate-300 transition-colors shadow-sm font-medium text-slate-700"
                        >
                          <option value="verified">✨ Best Match</option>
                          <option value="rating">⭐ Top Rated</option>
                          {userLocation && <option value="distance">📍 Nearest</option>}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {filteredRestaurants.slice(6).map((restaurant, index) => {
                        const actualIndex = index + 6; // Account for first 6 already shown
                        const tasteProfile = currentUser?.taste_profile || {};
                        const isBestMatch = (
                          (tasteProfile.outdoor_seating && restaurant.has_outdoor) ||
                          (tasteProfile.kid_friendly && restaurant.is_kid_friendly) ||
                          (tasteProfile.bar_seating && restaurant.has_bar_seating)
                        );

                        // Insert Smart Filters after first card (position 7) if more than 6 restaurants
                        const shouldShowSmartFilters = false; // replaced by FoodDiscoveryGrid

                        // Randomly insert "Feeling adventurous" card AFTER position 6
                        const randomInsertPosition = Math.floor((filteredRestaurants.length - 6) / 3) + 2;
                        const shouldShowAdventurous = currentUser && index === randomInsertPosition;

                        return (
                          <div key={restaurant.id} className="contents">
                            {shouldShowSmartFilters && (
                              <div className="md:col-span-2 lg:col-span-3">
                                <SmartFilters
                                  restaurants={restaurants}
                                  onFilteredResults={(filtered) => {}}
                                  currentUser={currentUser}
                                />
                              </div>
                            )}
                            
                            {shouldShowAdventurous && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="md:col-span-2 lg:col-span-3"
                              >
                                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-[2px] hover:shadow-2xl hover:shadow-purple-500/30 transition-all group">
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                                  <div className="relative bg-white rounded-[22px] p-8 md:p-10">
                                    <div className="flex items-start justify-between gap-6">
                                      <div className="flex-1">
                                        <motion.div
                                          animate={{ rotate: [0, 10, -10, 0] }}
                                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                          className="inline-block mb-4"
                                        >
                                          <Sparkles className="w-10 h-10 text-purple-600" />
                                        </motion.div>
                                        <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                                          Feeling adventurous?
                                        </h3>
                                        <p className="text-slate-600 text-base md:text-lg mb-6">
                                          Let AI find your perfect hidden gem right now
                                        </p>
                                        <Button
                                          onClick={() => setShowSurpriseMe(true)}
                                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all rounded-full px-8 h-12"
                                        >
                                          <Sparkles className="w-5 h-5 mr-2" />
                                          Surprise Me
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={{ y: -4 }}
                              transition={{ duration: 0.2 }}
                            >
                              <RestaurantCard
                                restaurant={restaurant}
                                isFavorite={favoriteIds.has(restaurant.id)}
                                onFavoriteToggle={handleFavoriteClick}
                                onClick={handleRestaurantClick}
                                showBestMatch={isBestMatch}
                                distance={restaurant.distance}
                                reviews={allReviews.filter(r => r.restaurant_id === restaurant.id)}
                              />
                            </motion.div>
                          </div>
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
                  <div ref={mapRef} className="h-[calc(100vh-280px)] min-h-[500px]">
                    <RestaurantMap
                      restaurants={filteredRestaurants}
                      center={mapCenter}
                      selectedRestaurant={selectedMapRestaurant}
                      onRestaurantSelect={setSelectedMapRestaurant}
                      onRestaurantClick={handleRestaurantClick}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Express Profile Setup Dialog */}
      <ExpressProfileSetup
        open={showExpressSetup}
        onOpenChange={setShowExpressSetup}
        currentUser={currentUser}
      />

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onOpenChange={setShowFilterPanel}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Surprise Me Dialog */}
      {showSurpriseMe && (
        <Dialog open={showSurpriseMe} onOpenChange={setShowSurpriseMe}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Surprise Recommendation
              </DialogTitle>
            </DialogHeader>
            <SurpriseMe
              restaurants={restaurants}
              currentUser={currentUser}
              onRestaurantClick={(r) => {
                setShowSurpriseMe(false);
                handleRestaurantClick(r);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* AI Concierge */}
      <AIConcierge
        restaurants={restaurants}
        currentUser={currentUser}
        onRestaurantClick={handleRestaurantClick}
      />
    </div>
  );
}
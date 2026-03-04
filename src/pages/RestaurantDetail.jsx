import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Heart, Share2, Phone, Navigation, Globe, Menu, 
  MapPin, Clock, DollarSign, Users, Star, Calendar, ShoppingBag,
  MessageCircle, Sparkles, Award, TrendingUp, ChefHat
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

import PhotoGallery from '@/components/customer/PhotoGallery';
import MenuView from '@/components/customer/MenuView';
import FloorPlanViewPremium from '@/components/customer/FloorPlanViewPremium';
import ReviewsTab from '@/components/restaurant/ReviewsTab';
import VibeDial from '@/components/restaurant/VibeDial';
import VibeBar from '@/components/restaurant/VibeBar';
import MenuHighlights from '@/components/restaurant/MenuHighlights';
import PreOrderCart from '@/components/customer/PreOrderCart';
import ReservationConcierge from '@/components/ai/ReservationConcierge';
import PromotionBanner from '@/components/customer/PromotionBanner';
import ReservationSuccess from '@/components/customer/ReservationSuccess';
import LoyaltyCard from '@/components/customer/LoyaltyCard';
import InstantConfirmBadge from '@/components/customer/InstantConfirmBadge';
import SocialShare from '@/components/customer/SocialShare';
import OccupancyBadge from '@/components/ui/OccupancyBadge';
import FreshnessIndicator from '@/components/ui/FreshnessIndicator';
import PriceLevel from '@/components/ui/PriceLevel';
import StarRating from '@/components/ui/StarRating';
import { trackReservationCreated } from '@/components/gamification/PointsTracker';

export default function RestaurantDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id') || urlParams.get('restaurantId');

  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Fetch restaurant
  const { data: restaurant, isLoading: restaurantLoading, error: restaurantError } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Missing restaurant id");
      const rows = await base44.entities.Restaurant.filter({ id: restaurantId });
      const r = Array.isArray(rows) ? rows[0] : rows?.data?.[0];
      if (!r) throw new Error(`Restaurant not found for id=${restaurantId}`);
      
      // Track view
      await base44.entities.Restaurant.update(restaurantId, {
        view_count: (r.view_count || 0) + 1
      }).catch(() => {});
      
      await base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        event_type: 'view'
      }).catch(() => {});
      
      return r;
    },
    enabled: !!restaurantId
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }),
    enabled: !!restaurantId
  });

  // Fetch tables — poll every 5s so status updates are near real-time
  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    refetchInterval: 5000
  });

  // "Table already taken" conflict dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Fetch menu items
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId && restaurant?.enable_preorder
  });

  // Fetch active promotions
  const { data: promotions = [] } = useQuery({
    queryKey: ['promotions', restaurantId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const promos = await base44.entities.Promotion.filter({ restaurant_id: restaurantId, is_active: true });
      return (Array.isArray(promos) ? promos : []).filter(p => {
        if (!p.valid_until) return true;
        return p.valid_until >= today;
      });
    },
    enabled: !!restaurantId
  });

  // Check if favorited
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser
  });

  const isFavorite = useMemo(() => 
    favorites.some(f => f.restaurant_id === restaurantId), 
    [favorites, restaurantId]
  );

  // Toggle favorite
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const existingFav = favorites.find(f => f.restaurant_id === restaurantId);
      if (existingFav) {
        await base44.entities.Favorite.delete(existingFav.id);
        await base44.entities.Restaurant.update(restaurantId, {
          favorite_count: Math.max(0, (restaurant.favorite_count || 1) - 1)
        });
      } else {
        await base44.entities.Favorite.create({
          user_id: currentUser.id,
          restaurant_id: restaurantId
        });
        await base44.entities.Restaurant.update(restaurantId, {
          favorite_count: (restaurant.favorite_count || 0) + 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
      queryClient.invalidateQueries(['restaurant', restaurantId]);
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    }
  });

  // State for pre-order flow
  const [showPreOrderFlow, setShowPreOrderFlow] = useState(false);
  const [pendingReservation, setPendingReservation] = useState(null);
  const [cart, setCart] = useState([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [completedReservation, setCompletedReservation] = useState(null);

  // Reserve table mutation
  const reserveMutation = useMutation({
    mutationFn: async (payload) => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      // --- Race condition guard: re-fetch table status before proceeding ---
      if (payload.table_id) {
        const freshTables = await base44.entities.Table.filter({ restaurant_id: restaurantId });
        const freshTable = freshTables.find(t => t.id === payload.table_id);
        if (freshTable && freshTable.status !== 'free') {
          // Invalidate local cache so UI reflects reality instantly
          queryClient.setQueryData(['tables', restaurantId], freshTables);
          return { conflict: true };
        }
        // Also mark table as reserved immediately so others see it
        await base44.entities.Table.update(payload.table_id, { status: 'reserved' }).catch(() => {});
        queryClient.setQueryData(['tables', restaurantId], (old = []) =>
          old.map(t => t.id === payload.table_id ? { ...t, status: 'reserved' } : t)
        );
      }

      // If pre-order enabled and user opted in, show pre-order flow first
      if (restaurant?.enable_preorder && !payload.skipPreOrder && payload.wants_pre_order !== false) {
        setPendingReservation(payload);
        setShowPreOrderFlow(true);
        return { skipToast: true };
      }

      // Check reservation rules to determine auto-status
      let autoStatus = restaurant?.instant_confirm_enabled ? 'approved' : 'pending';
      
      try {
        const rules = await base44.entities.ReservationRule.filter({ restaurant_id: restaurantId, is_active: true });
        if (rules.length > 0 && payload.reservation_date && payload.reservation_time) {
          const reservationDate = new Date(payload.reservation_date);
          const dayOfWeek = reservationDate.getDay(); // 0=Sun
          const reservationTime = payload.reservation_time;
          const partySize = payload.party_size || 2;
          const advanceHours = (reservationDate - new Date()) / (1000 * 60 * 60);
          const advanceDays = advanceHours / 24;

          // Sort rules by priority descending (higher priority first)
          const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
          
          const matchedRule = sortedRules.find(rule => {
            const c = rule.conditions || {};
            if (c.days_of_week?.length > 0 && !c.days_of_week.includes(dayOfWeek)) return false;
            if (c.time_slots?.length > 0) {
              const inSlot = c.time_slots.some(slot => {
                const [start, end] = slot.split('-');
                return reservationTime >= start && reservationTime <= end;
              });
              if (!inSlot) return false;
            }
            if (c.min_party_size && partySize < c.min_party_size) return false;
            if (c.max_party_size && partySize > c.max_party_size) return false;
            if (c.min_advance_hours && advanceHours < c.min_advance_hours) return false;
            if (c.max_advance_days && advanceDays > c.max_advance_days) return false;
            return true;
          });

          if (matchedRule) {
            if (matchedRule.action === 'auto_approve') autoStatus = 'approved';
            else if (matchedRule.action === 'auto_decline') autoStatus = 'declined';
            else autoStatus = 'pending'; // flag_review
          }
        }
      } catch {}

      // Create reservation with pre-order if cart has items
      const reservationData = {
        restaurant_id: restaurantId,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email,
        status: autoStatus,
        ...payload
      };

      // Generate a unique check-in token
      const checkInToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      reservationData.check_in_token = checkInToken;

      const reservation = await base44.entities.Reservation.create(reservationData);

      // Create pre-order if cart has items
      if (cart.length > 0) {
        await base44.entities.PreOrder.create({
          reservation_id: reservation.id,
          restaurant_id: restaurantId,
          user_id: currentUser.id,
          items: cart,
          special_instructions: payload.preOrderInstructions || '',
          total_amount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: 'pending'
        });
      }

      return reservation;
    },
    onSuccess: (result) => {
      if (result?.conflict) {
        setShowConflictDialog(true);
        refetchTables();
        return;
      }
      if (result?.skipToast) return;
      
      setCompletedReservation(result);
      setShowSuccessDialog(true);
      refetchTables();
      setCart([]);
      setShowPreOrderFlow(false);
      setPendingReservation(null);
      
      // Track points
      if (currentUser) {
        trackReservationCreated(currentUser.id);
      }
    },
    onError: (e) => toast.error(e?.message || 'Reservation failed')
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      return await base44.entities.Message.create({
        restaurant_id: restaurantId,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name,
        sender_email: currentUser.email,
        message,
        is_from_restaurant: false
      });
    },
    onSuccess: () => toast.success('Message sent to restaurant')
  });

  const floorPlanData = restaurant?.floor_plan_data || restaurant?.floorPlanData || null;

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-red-600 mb-2">Missing Restaurant ID</h2>
          <p className="text-slate-600">The restaurant page requires an ID parameter in the URL.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))} className="mt-4">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (restaurantLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-96 bg-slate-200 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (restaurantError || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-red-600 mb-2">Restaurant Not Found</h2>
          <p className="text-slate-600 mb-4">
            {restaurantError?.message || "The restaurant you're looking for doesn't exist."}
          </p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const occupancyPercent = restaurant.total_seats > 0 
    ? ((restaurant.total_seats - restaurant.available_seats) / restaurant.total_seats) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section with Photo Gallery */}
      <div className="relative bg-slate-900">
        <PhotoGallery restaurant={restaurant} />
        
        {/* Floating Back Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm hover:bg-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Floating Action Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowShareDialog(true)}
            className="bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleFavoriteMutation.mutate()}
            className={cn(
              "bg-white/90 backdrop-blur-sm hover:bg-white",
              isFavorite && "text-red-500"
            )}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-10 pb-12">
        {/* Restaurant Header Card */}
        <Card className="mb-8 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                      {restaurant.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{restaurant.neighborhood || restaurant.address}</span>
                      </div>
                      <PriceLevel level={restaurant.price_level} />
                      <Badge variant="outline">{restaurant.cuisine}</Badge>
                    </div>
                  </div>
                </div>

                {/* Rating & Stats */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <StarRating rating={restaurant.average_rating} size="lg" showNumber />
                  <span className="text-sm text-slate-600">
                    {restaurant.review_count || 0} reviews
                  </span>
                  <OccupancyBadge 
                    occupancyPercent={occupancyPercent}
                    isFull={restaurant.is_full}
                  />
                  <FreshnessIndicator updatedAt={restaurant.seating_updated_at} />
                  {restaurant.instant_confirm_enabled && <InstantConfirmBadge />}
                  {restaurant.reliability_score >= 80 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      <Award className="w-3 h-3 mr-1" />
                      Reliable
                    </Badge>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  {restaurant.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.href = `tel:${restaurant.phone}`;
                        base44.entities.AnalyticsEvent.create({
                          restaurant_id: restaurantId,
                          user_id: currentUser?.id,
                          event_type: 'call_click'
                        }).catch(() => {});
                      }}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                  )}
                  {restaurant.latitude && restaurant.longitude && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`https://maps.google.com/?q=${restaurant.latitude},${restaurant.longitude}`, '_blank');
                        base44.entities.AnalyticsEvent.create({
                          restaurant_id: restaurantId,
                          user_id: currentUser?.id,
                          event_type: 'directions_click'
                        }).catch(() => {});
                      }}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Directions
                    </Button>
                  )}
                  {restaurant.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(restaurant.website, '_blank');
                        base44.entities.AnalyticsEvent.create({
                          restaurant_id: restaurantId,
                          user_id: currentUser?.id,
                          event_type: 'website_click'
                        }).catch(() => {});
                      }}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Website
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!currentUser) {
                        base44.auth.redirectToLogin(window.location.href);
                        return;
                      }
                      navigate(createPageUrl('Inbox') + `?restaurant=${restaurantId}`);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              </div>

              {/* Loyalty Card (if applicable) */}
              {currentUser && (
                <LoyaltyCard 
                  restaurantId={restaurantId}
                  currentUser={currentUser}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Promotions */}
        {promotions.length > 0 && (
          <div className="mb-8">
            {promotions.map(promo => (
              <PromotionBanner key={promo.id} promotion={promo} />
            ))}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="reserve">Reserve</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* About & Hours */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {restaurant.has_outdoor && (
                      <Badge variant="outline">🌳 Outdoor Seating</Badge>
                    )}
                    {restaurant.has_bar_seating && (
                      <Badge variant="outline">🍸 Bar Seating</Badge>
                    )}
                    {restaurant.is_kid_friendly && (
                      <Badge variant="outline">👨‍👩‍👧 Kid Friendly</Badge>
                    )}
                    {restaurant.enable_preorder && (
                      <Badge variant="outline">
                        <ShoppingBag className="w-3 h-3 mr-1" />
                        Pre-Order Available
                      </Badge>
                    )}
                  </div>

                  {restaurant.opening_hours && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Hours
                      </h3>
                      <div className="text-sm space-y-1 text-slate-600">
                        {Object.entries(restaurant.opening_hours).map(([day, hours]) => (
                          <div key={day} className="flex justify-between">
                            <span className="capitalize">{day}</span>
                            <span>
                              {typeof hours === 'object' && hours?.open && hours?.close
                                ? `${hours.open} - ${hours.close}`
                                : hours || 'Closed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vibe Meter */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Restaurant Vibe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <VibeDial reviews={reviews} />
                  <VibeBar reviews={reviews} className="mt-4" />
                </CardContent>
              </Card>
            </div>

            {/* Menu Highlights */}
            {menuItems.length > 0 && (
              <MenuHighlights 
                menuItems={menuItems}
                onViewFullMenu={() => setActiveTab('menu')}
              />
            )}

            {/* Review Preview — no AI summary here, just a quick button */}
            {reviews.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">
                  <Star className="w-4 h-4 inline text-yellow-400 fill-yellow-400 mr-1" />
                  {restaurant.average_rating?.toFixed(1) || 0} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                </span>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('reviews')}>
                  View All Reviews
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <MenuView
                  items={menuItems}
                  restaurantName={restaurant.name}
                />
              </CardContent>
            </Card>
            
            <MenuHighlights 
              menuItems={menuItems}
              onViewFullMenu={() => {}}
            />
          </TabsContent>

          {/* Reserve Tab */}
          <TabsContent value="reserve" className="space-y-6">
            {/* AI Reservation Concierge */}
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Smart Reservation Assistant</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Let AI find the perfect time, handle your special requests, and suggest alternatives if needed.
                    </p>
                    <ReservationConcierge
                      restaurant={restaurant}
                      tables={tables}
                      currentUser={currentUser}
                      onReservationComplete={() => refetchTables()}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Manual Floor Plan Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Or Select a Table Manually
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FloorPlanViewPremium
                  restaurantId={restaurantId}
                  floorPlanData={floorPlanData}
                  tables={tables}
                  isSubmitting={reserveMutation.isPending}
                  onReserveTable={(payload) => {
                    if (payload.wants_pre_order && restaurant?.enable_preorder) {
                      // trigger pre-order flow
                      reserveMutation.mutate(payload);
                    } else {
                      reserveMutation.mutate({ ...payload, skipPreOrder: true });
                    }
                  }}
                  currentUser={currentUser}
                  restaurant={restaurant}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <ReviewsTab
              restaurant={restaurant}
              reviews={reviews}
              currentUser={currentUser}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Pre-Order Flow Dialog */}
      {showPreOrderFlow && restaurant?.enable_preorder && (
        <Dialog open={showPreOrderFlow} onOpenChange={(open) => {
          if (!open) {
            setShowPreOrderFlow(false);
            setPendingReservation(null);
          }
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Pre-Order to Your Reservation (Optional)</DialogTitle>
            </DialogHeader>
            <PreOrderCart 
              menuItems={menuItems}
              cart={cart}
              userDietaryNeeds={pendingReservation?.dietary_needs || currentUser?.dietary_needs || []}
              onAddToCart={(item) => {
                setCart(prev => [...prev, { 
                  menu_item_id: item.id, 
                  name: item.name, 
                  price: item.price, 
                  quantity: 1 
                }]);
              }}
              onUpdateQuantity={(itemId, newQty) => {
                if (newQty === 0) {
                  setCart(prev => prev.filter(c => c.menu_item_id !== itemId));
                } else {
                  setCart(prev => prev.map(c => 
                    c.menu_item_id === itemId ? { ...c, quantity: newQty } : c
                  ));
                }
              }}
              onRemoveFromCart={(itemId) => {
                setCart(prev => prev.filter(c => c.menu_item_id !== itemId));
              }}
              onComplete={(data) => {
                reserveMutation.mutate({
                  ...pendingReservation,
                  skipPreOrder: true,
                  preOrderInstructions: data.specialInstructions
                });
              }}
              onBack={() => {
                setShowPreOrderFlow(false);
                setPendingReservation(null);
              }}
              isSubmitting={reserveMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Share Dialog */}
      {showShareDialog && (
        <SocialShare
          restaurant={restaurant}
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
        />
      )}

      {/* Success Dialog */}
      <ReservationSuccess
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        reservation={completedReservation}
        restaurantName={restaurant?.name}
        instantConfirmed={restaurant?.instant_confirm_enabled}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Heart, Phone, Navigation, Globe, Clock, Users, 
  Star, MapPin, Minus, Plus, LayoutGrid, Award, Gift, UtensilsCrossed,
  CalendarDays
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import SeatingBar from "@/components/ui/SeatingBar";
import PriceLevel from "@/components/ui/PriceLevel";
import StarRating from "@/components/ui/StarRating";
import FloorPlanViewPremium from "@/components/customer/FloorPlanViewPremium";
import AIWaitTimePredictor from "@/components/ai/AIWaitTimePredictor";
import MenuView from "@/components/customer/MenuView";
import PromotionBanner from "@/components/customer/PromotionBanner";
import MenuHighlights from "@/components/restaurant/MenuHighlights";
import ReviewSummary from "@/components/restaurant/ReviewSummary";
import LoyaltyCard from "@/components/customer/LoyaltyCard";
import { OpeningHoursDisplay } from "@/components/owner/OpeningHoursEditor";
import PhotoGallery from "@/components/customer/PhotoGallery";
import PreOrderCart from "@/components/customer/PreOrderCart";
import moment from 'moment';
import { cn } from "@/lib/utils";

export default function RestaurantDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');

  const [currentUser, setCurrentUser] = useState(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState([]);
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [reviewVibeRating, setReviewVibeRating] = useState(3);
  const [reviewNoiseLevel, setReviewNoiseLevel] = useState(3);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [userWaitlistPosition, setUserWaitlistPosition] = useState(null);
  const [reservationStep, setReservationStep] = useState('select'); // 'select' or 'preorder'
  const [pendingReservation, setPendingReservation] = useState(null);
  const [preorderCart, setPreorderCart] = useState([]);
  const [vibeData, setVibeData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
          setGuestName(user.full_name || '');
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Track view event
  useEffect(() => {
    if (restaurantId) {
      base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        event_type: 'view',
        user_id: currentUser?.id
      }).catch(() => {});
    }
  }, [restaurantId, currentUser]);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas', restaurantId],
    queryFn: () => base44.entities.RestaurantArea.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }),
    enabled: !!restaurantId,
  });

  // Calculate vibe data from reviews
  useEffect(() => {
    if (reviews.length > 0) {
      const vibeReviews = reviews.filter(r => r.vibe_rating);
      if (vibeReviews.length > 0) {
        const avgVibe = vibeReviews.reduce((sum, r) => sum + r.vibe_rating, 0) / vibeReviews.length;
        
        // Calculate recent (90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const recentVibeReviews = vibeReviews.filter(r => new Date(r.created_date) > ninetyDaysAgo);
        const recentAvgVibe = recentVibeReviews.length > 0 
          ? recentVibeReviews.reduce((sum, r) => sum + r.vibe_rating, 0) / recentVibeReviews.length 
          : null;

        setVibeData({
          score: avgVibe,
          reviewCount: vibeReviews.length,
          recentScore: recentAvgVibe,
          recentReviewCount: recentVibeReviews.length
        });
      }
    }
  }, [reviews]);

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurantId, 
      status: 'waiting' 
    }),
    enabled: !!restaurantId,
  });

  // Fetch menu items
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId, is_available: true }),
    enabled: !!restaurantId,
  });

  // Fetch promotions
  const { data: promotions = [] } = useQuery({
    queryKey: ['promotions', restaurantId],
    queryFn: () => base44.entities.Promotion.filter({ restaurant_id: restaurantId, is_active: true }),
    enabled: !!restaurantId,
  });

  // Fetch loyalty program and user's membership
  const { data: loyaltyProgram } = useQuery({
    queryKey: ['loyaltyProgram', restaurantId],
    queryFn: async () => {
      const programs = await base44.entities.LoyaltyProgram.filter({ restaurant_id: restaurantId, is_active: true });
      return programs[0];
    },
    enabled: !!restaurantId,
  });

  const { data: userLoyalty } = useQuery({
    queryKey: ['userLoyalty', restaurantId, currentUser?.id],
    queryFn: async () => {
      const memberships = await base44.entities.CustomerLoyalty.filter({ 
        restaurant_id: restaurantId, 
        user_id: currentUser.id 
      });
      return memberships[0];
    },
    enabled: !!restaurantId && !!currentUser,
  });

  // Join loyalty program mutation
  const joinLoyaltyMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.CustomerLoyalty.create({
        user_id: currentUser.id,
        restaurant_id: restaurantId,
        program_id: loyaltyProgram.id,
        total_points: loyaltyProgram.signup_bonus || 0,
        available_points: loyaltyProgram.signup_bonus || 0,
        lifetime_points: loyaltyProgram.signup_bonus || 0,
        current_tier: loyaltyProgram.tiers?.[0]?.name || 'Bronze',
        visits: 0,
        total_spent: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userLoyalty']);
      toast.success(`Welcome! You earned ${loyaltyProgram?.signup_bonus || 0} bonus points!`);
    }
  });

  const isFavorite = favorites.some(f => f.restaurant_id === restaurantId);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const existingFav = favorites.find(f => f.restaurant_id === restaurantId);
      if (existingFav) {
        await base44.entities.Favorite.delete(existingFav.id);
      } else {
        await base44.entities.Favorite.create({
          user_id: currentUser.id,
          restaurant_id: restaurantId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
    }
  });

  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      const entry = await base44.entities.WaitlistEntry.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        guest_name: guestName,
        guest_phone: guestPhone,
        party_size: partySize,
        status: 'waiting',
        estimated_wait_minutes: waitlist.length * 15
      });
      return entry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries(['waitlist']);
      setShowWaitlistDialog(false);
      const position = waitlist.length + 1;
      setUserWaitlistPosition(position);
      toast.success(`You're #${position} on the waitlist! Est. wait: ${15 * position} min`, { duration: 6000 });
    }
  });

  const reserveTableMutation = useMutation({
    mutationFn: async (data) => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      
      // Check if restaurant has pre-order enabled and handle accordingly
      if (restaurant.enable_preorder && !data.skipPreorder) {
        // Store pending reservation and move to pre-order step
        setPendingReservation(data);
        setReservationStep('preorder');
        return { shouldShowPreorder: true };
      }
      
      // Fetch reservation rules
      const rules = await base44.entities.ReservationRule.filter({ 
        restaurant_id: restaurantId,
        is_active: true 
      }, 'priority');
      
      // Apply rules to determine status
      let status = 'pending';
      let matchedRule = null;
      
      for (const rule of rules) {
        const conditions = rule.conditions || {};
        let matches = true;
        
        // Check day of week
        if (conditions.days_of_week) {
          const resDate = new Date(data.reservation_date);
          const dayOfWeek = resDate.getDay();
          if (!conditions.days_of_week.includes(dayOfWeek)) {
            matches = false;
          }
        }
        
        // Check time slot
        if (matches && conditions.time_slots) {
          const matchesTimeSlot = conditions.time_slots.some(slot => {
            const [start, end] = slot.split('-');
            return data.reservation_time >= start && data.reservation_time <= end;
          });
          if (!matchesTimeSlot) matches = false;
        }
        
        // Check party size
        if (matches && conditions.min_party_size && data.party_size < conditions.min_party_size) {
          matches = false;
        }
        if (matches && conditions.max_party_size && data.party_size > conditions.max_party_size) {
          matches = false;
        }
        
        // Check lead time
        if (matches && (conditions.min_advance_hours || conditions.max_advance_days)) {
          const now = new Date();
          const resDateTime = new Date(`${data.reservation_date}T${data.reservation_time}`);
          const hoursDiff = (resDateTime - now) / (1000 * 60 * 60);
          
          if (conditions.min_advance_hours && hoursDiff < conditions.min_advance_hours) {
            matches = false;
          }
          if (conditions.max_advance_days && hoursDiff > conditions.max_advance_days * 24) {
            matches = false;
          }
        }
        
        if (matches) {
          matchedRule = rule;
          if (rule.action === 'auto_approve') status = 'approved';
          else if (rule.action === 'auto_decline') status = 'declined';
          break;
        }
      }
      
      const reservation = await base44.entities.Reservation.create({
        restaurant_id: restaurantId,
        table_id: data.table_id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email,
        party_size: data.party_size,
        reservation_date: data.reservation_date,
        reservation_time: data.reservation_time,
        notes: data.notes,
        status
      });

      // Create pre-order if items exist
      if (data.preorder && data.preorder.items.length > 0) {
        await base44.entities.PreOrder.create({
          reservation_id: reservation.id,
          restaurant_id: restaurantId,
          user_id: currentUser.id,
          items: data.preorder.items,
          special_instructions: data.preorder.specialInstructions,
          total_amount: data.preorder.total,
          payment_status: 'pay_at_restaurant'
        });
      }
      
      return { reservation, status, matchedRule };
    },
    onSuccess: (result) => {
      if (result?.shouldShowPreorder) {
        // Don't show toast, just transition to pre-order step
        return;
      }
      
      if (result.status === 'approved') {
        toast.success("🎉 Reservation confirmed! You're all set.", { duration: 5000 });
      } else if (result.status === 'declined') {
        toast.error("This time slot is not available. Please try a different time or contact the restaurant.", { duration: 5000 });
      } else {
        toast.success("Reservation request sent! Waiting for confirmation. You'll get a notification within 30 minutes.", { duration: 5000 });
      }
      
      // Reset states
      setReservationStep('select');
      setPendingReservation(null);
      setPreorderCart([]);
      
      queryClient.invalidateQueries(['tables']);
      queryClient.invalidateQueries(['myReservations']);
    },
    onError: (error) => {
      toast.error("Failed to submit reservation: " + error.message);
    }
  });

  const handlePreorderComplete = (preorderData) => {
    // Submit reservation with pre-order data
    reserveTableMutation.mutate({
      ...pendingReservation,
      preorder: preorderData,
      skipPreorder: true
    });
  };

  const handleAddToCart = (menuItem) => {
    setPreorderCart([...preorderCart, {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1
    }]);
  };

  const handleUpdateQuantity = (menuItemId, quantity) => {
    if (quantity <= 0) {
      setPreorderCart(preorderCart.filter(item => item.menu_item_id !== menuItemId));
    } else {
      setPreorderCart(preorderCart.map(item =>
        item.menu_item_id === menuItemId ? { ...item, quantity } : item
      ));
    }
  };

  const handleRemoveFromCart = (menuItemId) => {
    setPreorderCart(preorderCart.filter(item => item.menu_item_id !== menuItemId));
  };

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Review.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || 'Anonymous',
        rating: reviewRating,
        comment: reviewComment,
        tags: reviewTags,
        photos: reviewPhotos,
        vibe_rating: reviewVibeRating,
        noise_level: reviewNoiseLevel
      });
      const allReviews = [...reviews, { rating: reviewRating }];
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await base44.entities.Restaurant.update(restaurantId, {
        average_rating: avgRating,
        review_count: allReviews.length
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews']);
      queryClient.invalidateQueries(['restaurant']);
      setShowReviewDialog(false);
      setReviewComment('');
      setReviewRating(5);
      setReviewTags([]);
      setReviewPhotos([]);
      setReviewVibeRating(3);
      setReviewNoiseLevel(3);
      toast.success("Review submitted!");
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setReviewPhotos([...reviewPhotos, file_url]);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const REVIEW_TAGS = ['Kid-friendly', 'Outdoor seating', 'Great service', 'Quiet', 'Romantic', 'Group-friendly'];
  
  const toggleTag = (tag) => {
    setReviewTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const trackClick = async (eventType) => {
    await base44.entities.AnalyticsEvent.create({
      restaurant_id: restaurantId,
      event_type: eventType,
      user_id: currentUser?.id
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Skeleton className="h-64 w-full" />
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Restaurant not found</h2>
          <Button onClick={() => navigate(createPageUrl('Home'))} className="mt-4">
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  // AI-enhanced wait time will be shown in the component
  const estimatedWait = waitlist.length * 10;

  // Get floor plan data from restaurant
  const floorPlanData = restaurant?.floor_plan_data;

  // Use floor plan data if available, otherwise construct from areas
  const floorPlanAreas = floorPlanData?.areas || areas.map(a => ({
    id: a.id,
    name: a.name,
    color: '#3B82F6',
    x: 40,
    y: 40,
    width: 400,
    height: 300
  }));

  // Merge table data - use stored positions from floor plan if available
  const displayTables = tables.map(t => {
    const fpTable = floorPlanData?.tables?.find(fp => fp.label === t.label);
    return {
      ...t,
      x: t.position_x || fpTable?.x || 100,
      y: t.position_y || fpTable?.y || 100,
      seats: t.capacity,
      width: fpTable?.width || 50,
      height: fpTable?.height || 50,
      shape: t.shape || fpTable?.shape || 'square'
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero */}
      <div className="relative h-64 md:h-80">
        <img
          src={restaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavoriteMutation.mutate()}
            className={cn(
              "rounded-full backdrop-blur-sm",
              isFavorite 
                ? "bg-red-500/90 text-white hover:bg-red-600" 
                : "bg-white/90 hover:bg-white"
            )}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </Button>
        </div>

        <div className="absolute bottom-6 left-4 right-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {restaurant.name}
          </h1>
          <div className="flex items-center gap-3 text-white/90">
            <span>{restaurant.cuisine}</span>
            <span className="w-1 h-1 rounded-full bg-white/60" />
            <PriceLevel level={restaurant.price_level || 2} size="md" />
            <span className="w-1 h-1 rounded-full bg-white/60" />
            <StarRating 
              rating={restaurant.average_rating} 
              count={restaurant.review_count}
              showCount={true}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white shadow-sm rounded-full p-1">
            <TabsTrigger value="overview" className="flex-1 rounded-full">
              Overview
            </TabsTrigger>
            <TabsTrigger value="menu" className="flex-1 rounded-full gap-1.5">
              <UtensilsCrossed className="w-4 h-4" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="floorplan" className="flex-1 rounded-full gap-1.5">
              <LayoutGrid className="w-4 h-4" />
              Reserve
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 rounded-full">
              Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Promotions */}
            {promotions.length > 0 && (
              <PromotionBanner promotions={promotions} />
            )}

            {/* Loyalty Program */}
            {loyaltyProgram && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  {userLoyalty ? (
                    <LoyaltyCard 
                      loyalty={userLoyalty} 
                      program={loyaltyProgram}
                      onClick={() => navigate(createPageUrl('MyLoyalty'))}
                    />
                  ) : (
                    <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      <div className="flex items-center gap-3 mb-3">
                        <Award className="w-8 h-8" />
                        <div>
                          <h3 className="font-bold text-lg">{loyaltyProgram.name}</h3>
                          <p className="text-sm opacity-90">
                            Earn {loyaltyProgram.points_per_dollar} point per dollar spent
                          </p>
                        </div>
                      </div>
                      {loyaltyProgram.signup_bonus > 0 && (
                        <p className="text-sm mb-4 bg-white/20 inline-block px-3 py-1 rounded-full">
                          🎁 Get {loyaltyProgram.signup_bonus} bonus points on signup!
                        </p>
                      )}
                      <Button 
                        onClick={() => currentUser ? joinLoyaltyMutation.mutate() : base44.auth.redirectToLogin(window.location.href)}
                        disabled={joinLoyaltyMutation.isPending}
                        className="w-full bg-white text-amber-600 hover:bg-amber-50"
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        {joinLoyaltyMutation.isPending ? 'Joining...' : 'Join Rewards Program'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Live Seating Card */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Live Seating</h3>
                      <p className="text-slate-500 text-sm">
                        Updated {restaurant.seating_updated_at 
                          ? moment(restaurant.seating_updated_at).fromNow() 
                          : 'recently'}
                      </p>
                    </div>
                  </div>
                  <OccupancyBadge
                    available={restaurant.available_seats}
                    total={restaurant.total_seats}
                    isFull={restaurant.is_full}
                    size="lg"
                  />
                </div>
                <SeatingBar 
                  available={restaurant.available_seats} 
                  total={restaurant.total_seats}
                  height="h-3"
                />

                {areas.length > 0 && (
                  <div className="mt-6 pt-6 border-t space-y-3">
                    <h4 className="font-medium text-slate-700">Seating Areas</h4>
                    {areas.filter(a => a.is_open).map((area) => (
                      <div key={area.id} className="flex items-center justify-between">
                        <span className="text-slate-600">{area.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-500">
                            {area.available_seats} / {area.max_seats} seats
                          </span>
                          <Badge variant={area.available_seats > 0 ? "default" : "secondary"}>
                            {area.available_seats > 0 ? 'Open' : 'Full'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vibe Dial */}
            {vibeData && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 flex items-center justify-center">
                  <VibeDial 
                    score={vibeData.score}
                    reviewCount={vibeData.reviewCount}
                    recentScore={vibeData.recentScore}
                    recentReviewCount={vibeData.recentReviewCount}
                  />
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <a 
                href={`tel:${restaurant.phone}`}
                onClick={() => trackClick('call_click')}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Call</span>
              </a>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick('directions_click')}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Directions</span>
              </a>
              <a 
                href={restaurant.website || restaurant.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick('website_click')}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Website</span>
              </a>
            </div>

            {/* Waitlist */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {restaurant.available_seats > 5 ? 'Walk-in Welcome' : 'Join Waitlist'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                      {restaurant.available_seats > 5 
                        ? 'Plenty of seats available now'
                        : `${waitlist.length} ahead • Expect ${Math.max(15, waitlist.length * 15)}-${waitlist.length * 15 + 10} min wait for ${partySize} people`
                      }
                    </p>
                  </div>
                  <Clock className="w-6 h-6 text-slate-400" />
                </div>
                
                {userWaitlistPosition && (
                  <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-emerald-800 font-semibold">You're #{userWaitlistPosition} on the waitlist</p>
                    <p className="text-sm text-emerald-600 mt-1">
                      Est. wait: {15 * userWaitlistPosition} minutes
                    </p>
                  </div>
                )}
                
                {/* AI Wait Time Prediction */}
                {restaurantId && (
                  <div className="mb-4">
                    <AIWaitTimePredictor
                      restaurantId={restaurantId}
                      partySize={partySize}
                      currentWaitlistLength={waitlist.length}
                    />
                  </div>
                )}
                
                {!userWaitlistPosition && (
                  <Dialog open={showWaitlistDialog} onOpenChange={setShowWaitlistDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full rounded-full h-12 text-base gap-2 bg-slate-800 hover:bg-slate-900">
                        <Users className="w-5 h-5" />
                        Join Waitlist
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Join Waitlist</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Party Size</label>
                          <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => setPartySize(Math.max(1, partySize - 1))}>
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="text-2xl font-semibold w-12 text-center">{partySize}</span>
                            <Button variant="outline" size="icon" onClick={() => setPartySize(partySize + 1)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Name</label>
                          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Phone</label>
                          <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="For SMS updates" />
                          <p className="text-xs text-slate-500 mt-1">We'll text you when your table is almost ready</p>
                        </div>
                        <Button 
                          className="w-full rounded-full h-12 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => joinWaitlistMutation.mutate()}
                          disabled={!guestName || joinWaitlistMutation.isPending}
                        >
                          {joinWaitlistMutation.isPending ? 'Joining...' : 'Confirm'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>

            {/* Opening Hours */}
            {restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="w-5 h-5" />
                    Opening Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <OpeningHoursDisplay hours={restaurant.opening_hours} />
                </CardContent>
              </Card>
            )}

            {/* Location */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{restaurant.address}</h3>
                    <p className="text-slate-500 text-sm">{restaurant.neighborhood}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu" className="mt-6 space-y-6">
            {/* AI-Generated Menu Highlights */}
            {menuItems.length > 0 && (
              <MenuHighlights
                restaurantId={restaurantId}
                menuItems={menuItems}
                restaurantName={restaurant.name}
                cuisine={restaurant.cuisine}
              />
            )}

            {/* Full Menu */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  Full Menu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MenuView items={menuItems} restaurantName={restaurant.name} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="floorplan" className="mt-6">
            {reservationStep === 'select' ? (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5" />
                    Select a Table to Reserve
                  </CardTitle>
                  {!restaurant.enable_preorder && menuItems.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Coming soon:</strong> This restaurant doesn't accept menu pre-orders in advance (yet).
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {restaurant.floor_plan_data?.items ? (
                    <FloorPlanViewPremium
                      floorPlanData={restaurant.floor_plan_data}
                      tables={tables}
                      onReserveTable={(data) => reserveTableMutation.mutate(data)}
                      isSubmitting={reserveTableMutation.isPending}
                      currentUser={currentUser}
                    />
                  ) : displayTables.length > 0 ? (
                    <div className="text-center py-12">
                      <LayoutGrid className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500">This restaurant hasn't set up their floor plan yet</p>
                      <p className="text-sm text-slate-400 mt-1">Try joining the waitlist instead</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <LayoutGrid className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500">No floor plan available for this restaurant</p>
                      <p className="text-sm text-slate-400 mt-1">Try joining the waitlist instead</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <PreOrderCart
                menuItems={menuItems}
                cart={preorderCart}
                onAddToCart={handleAddToCart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveFromCart={handleRemoveFromCart}
                onComplete={handlePreorderComplete}
                onBack={() => {
                  setReservationStep('select');
                  setPendingReservation(null);
                  setPreorderCart([]);
                }}
                isSubmitting={reserveTableMutation.isPending}
              />
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-6 space-y-6">
            {/* AI Review Summary */}
            <ReviewSummary reviews={reviews} restaurantName={restaurant.name} />

            {/* Photo Gallery */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <PhotoGallery restaurantId={restaurantId} currentUser={currentUser} />
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Reviews</CardTitle>
                {currentUser && (
                  <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full">
                        Write a Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Write a Review</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => setReviewRating(star)} className="p-1">
                                <Star className={cn(
                                  "w-8 h-8 transition-colors",
                                  star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                )} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Comment</label>
                          <Textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Share your experience..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Ambience (Optional)</label>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-xs text-slate-600 mb-2">
                                <span>Vibe</span>
                                <span className="font-medium">{reviewVibeRating === 1 ? 'Cozy' : reviewVibeRating === 2 ? 'Chill' : reviewVibeRating === 3 ? 'Moderate' : reviewVibeRating === 4 ? 'Lively' : 'Energetic'}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={reviewVibeRating}
                                onChange={(e) => setReviewVibeRating(Number(e.target.value))}
                                className="w-full h-2 bg-gradient-to-r from-indigo-200 via-green-200 to-pink-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                              <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>Cozy</span>
                                <span>Energetic</span>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-slate-600 mb-2">
                                <span>Noise Level</span>
                                <span className="font-medium">{reviewNoiseLevel === 1 ? 'Quiet' : reviewNoiseLevel === 2 ? 'Low' : reviewNoiseLevel === 3 ? 'Moderate' : reviewNoiseLevel === 4 ? 'Loud' : 'Very Loud'}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={reviewNoiseLevel}
                                onChange={(e) => setReviewNoiseLevel(Number(e.target.value))}
                                className="w-full h-2 bg-gradient-to-r from-blue-200 to-red-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                              <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>Quiet</span>
                                <span>Loud</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Tags</label>
                          <div className="flex flex-wrap gap-2">
                            {REVIEW_TAGS.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full border text-sm transition-all",
                                  reviewTags.includes(tag)
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-600 border-slate-200"
                                )}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-2 block">Photos</label>
                          <div className="space-y-2">
                            {reviewPhotos.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {reviewPhotos.map((url, i) => (
                                  <img key={i} src={url} alt="Review" className="w-20 h-20 object-cover rounded-lg" />
                                ))}
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="review-photo-upload"
                              disabled={uploadingPhoto}
                            />
                            <label htmlFor="review-photo-upload">
                              <Button asChild variant="outline" size="sm" disabled={uploadingPhoto}>
                                <span>
                                  {uploadingPhoto ? 'Uploading...' : '+ Add Photo'}
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>
                        <Button 
                          className="w-full rounded-full h-12"
                          onClick={() => submitReviewMutation.mutate()}
                          disabled={submitReviewMutation.isPending}
                        >
                          {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No reviews yet. Be the first!</p>
                ) : (
                  reviews.slice(0, 10).map((review) => (
                    <div key={review.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{review.user_name}</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-medium">{review.rating}</span>
                        </div>
                      </div>
                      {review.tags?.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {review.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {review.comment && <p className="text-slate-600 text-sm mb-2">{review.comment}</p>}
                      {review.photos?.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {review.photos.slice(0, 3).map((photo, i) => (
                            <img key={i} src={photo} alt="Review" className="w-16 h-16 object-cover rounded-lg" />
                          ))}
                        </div>
                      )}
                      <p className="text-slate-400 text-xs">{moment(review.created_date).fromNow()}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
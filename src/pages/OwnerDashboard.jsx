import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Store, Users, BarChart3, Settings, Plus,
  Eye, Heart, MousePointerClick, LayoutGrid
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import LiveSeating from '@/components/owner/LiveSeating';
import WaitlistManager from '@/components/owner/WaitlistManager';
import ReservationManagerPremium from '@/components/owner/ReservationManagerPremium';
import FloorPlanBuilderPremium from '@/components/owner/FloorPlanBuilderPremium';
import AITableAssigner from '@/components/ai/AITableAssigner';
import OccupancyForecaster from '@/components/ai/OccupancyForecaster';
import AIRecommendations from '@/components/ai/AIRecommendations';
import AIReviewAnalyzer from '@/components/ai/AIReviewAnalyzer';
import AIReservationManager from '@/components/ai/AIReservationManager';
import AIFloorPlanOptimizer from '@/components/ai/AIFloorPlanOptimizer';
import AutoReservationRules from '@/components/owner/AutoReservationRules';
import ReservationCalendar from '@/components/owner/ReservationCalendar';
import WaitlistSMSManager from '@/components/owner/WaitlistSMSManager';
import PredictiveAnalytics from '@/components/analytics/PredictiveAnalytics';
import SeatingHeatmap from '@/components/analytics/SeatingHeatmap';
import ABTestingSuggestions from '@/components/analytics/ABTestingSuggestions';
import FeatureGate from '@/components/subscription/FeatureGate';
import { useFeatureAccess } from '@/components/subscription/SubscriptionPlans';
import LoyaltyProgramManager from '@/components/owner/LoyaltyProgramManager';
import MenuBuilder from '@/components/owner/MenuBuilder';
import OfferManager from '@/components/owner/OfferManager';
import AIPersonalizedOffers from '@/components/ai/AIPersonalizedOffers';
import AIDynamicPricing from '@/components/ai/AIDynamicPricing';
import ShiftModePanel from '@/components/owner/ShiftModePanel';
import OwnerAI from '@/components/ai/OwnerAI';
import NotificationBell from '@/components/notifications/NotificationBell';
import { cn } from "@/lib/utils";

const asArray = (v) => (Array.isArray(v) ? v : []);

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [activeTab, setActiveTab] = useState('seating');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
          return;
        }
        const user = await base44.auth.me();
        if (user.user_type !== 'owner' && user.user_type !== 'admin' && user.role !== 'admin') {
          navigate(createPageUrl('Home'));
          return;
        }
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  // --- Restaurants (Owned) ---
  const ownedRestaurantsQuery = useQuery({
    queryKey: ['ownedRestaurants', currentUser?.id],
    queryFn: async () => {
      const res = await base44.entities.Restaurant.filter({ owner_id: currentUser.id });
      return asArray(res);
    },
    enabled: !!currentUser?.id,
  });
  const ownedRestaurants = asArray(ownedRestaurantsQuery.data);

  // --- Staff assignments ---
  const staffAssignmentsQuery = useQuery({
    queryKey: ['staffAssignments', currentUser?.email],
    queryFn: async () => {
      const res = await base44.entities.RestaurantStaff.filter({
        user_email: currentUser.email,
        is_active: true
      });
      return asArray(res);
    },
    enabled: !!currentUser?.email,
  });
  const staffAssignments = asArray(staffAssignmentsQuery.data);

  // --- Staff restaurants ---
  const staffRestaurantsQuery = useQuery({
    queryKey: ['staffRestaurants', staffAssignments.map(s => s.restaurant_id).join('|')], // stable key
    queryFn: async () => {
      if (staffAssignments.length === 0) return [];
      const promises = staffAssignments.map(async (s) => {
        const r = await base44.entities.Restaurant.filter({ id: s.restaurant_id });
        const arr = asArray(r);
        return arr[0] || null;
      });
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    },
    enabled: staffAssignments.length > 0,
  });
  const staffRestaurants = asArray(staffRestaurantsQuery.data);

  const allRestaurants = useMemo(() => {
    const merged = [...ownedRestaurants, ...staffRestaurants].filter(Boolean);
    // optional: de-dupe
    const seen = new Set();
    return merged.filter(r => {
      if (!r?.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [ownedRestaurants, staffRestaurants]);

  // Set default selected restaurant (and keep it valid)
  useEffect(() => {
    if (allRestaurants.length === 0) {
      if (selectedRestaurant) setSelectedRestaurant(null);
      return;
    }
    if (!selectedRestaurant) {
      setSelectedRestaurant(allRestaurants[0]);
      return;
    }
    const stillExists = allRestaurants.some(r => r.id === selectedRestaurant.id);
    if (!stillExists) setSelectedRestaurant(allRestaurants[0]);
  }, [allRestaurants, selectedRestaurant]);

  const restaurantId = selectedRestaurant?.id;

  // Fetch tables
  const tablesQuery = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: async () => asArray(await base44.entities.Table.filter({ restaurant_id: restaurantId })),
    enabled: !!restaurantId,
  });
  const tables = asArray(tablesQuery.data);

  // Fetch waitlist
  const waitlistQuery = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: async () => asArray(await base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date')),
    enabled: !!restaurantId,
  });
  const waitlist = asArray(waitlistQuery.data);

  // Fetch events
  const recentEventsQuery = useQuery({
    queryKey: ['events', restaurantId],
    queryFn: async () => asArray(await base44.entities.AnalyticsEvent.filter({ restaurant_id: restaurantId }, '-created_date', 100)),
    enabled: !!restaurantId,
  });
  const recentEvents = asArray(recentEventsQuery.data);

  // Fetch reservations
  const reservationsQuery = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: async () => asArray(await base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date')),
    enabled: !!restaurantId,
  });
  const reservations = asArray(reservationsQuery.data);

  // Update seating mutation
  const updateSeatingMutation = useMutation({
    mutationFn: async (newAvailable) => {
      if (!selectedRestaurant?.id) return;
      await base44.entities.Restaurant.update(selectedRestaurant.id, {
        available_seats: newAvailable,
        seating_updated_at: new Date().toISOString()
      });
      if (selectedRestaurant.total_seats) {
        await base44.entities.SeatingHistory.create({
          restaurant_id: selectedRestaurant.id,
          available_seats: newAvailable,
          total_seats: selectedRestaurant.total_seats,
          occupancy_percent: ((selectedRestaurant.total_seats - newAvailable) / selectedRestaurant.total_seats) * 100,
          recorded_at: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['staffRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  // Toggle full status mutation
  const toggleFullMutation = useMutation({
    mutationFn: async (isFull) => {
      if (!selectedRestaurant?.id) return;
      await base44.entities.Restaurant.update(selectedRestaurant.id, {
        is_full: isFull,
        seating_updated_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['staffRestaurants'] });
    }
  });

  // Waitlist mutations
  const seatEntryMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'seated',
      seated_at: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist', restaurantId] })
  });

  const cancelEntryMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'cancelled'
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist', restaurantId] })
  });

  const viewCount = recentEvents.filter(e => e?.event_type === 'view').length;
  const clickCount = recentEvents.filter(e =>
    ['call_click', 'directions_click', 'website_click'].includes(e?.event_type)
  ).length;
  const waitlistWaitingCount = waitlist.filter(w => w?.status === 'waiting').length;

  const currentRestaurant =
    allRestaurants.find(r => r?.id === selectedRestaurant?.id) || selectedRestaurant;

  const featureAccess = useFeatureAccess(restaurantId);

  const isLoadingDashboard =
    !currentUser ||
    ownedRestaurantsQuery.isLoading ||
    staffAssignmentsQuery.isLoading ||
    staffRestaurantsQuery.isLoading;

  if (isLoadingDashboard) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Owner Dashboard</h1>
                <p className="text-sm text-slate-500">
                  {allRestaurants.length} restaurant{allRestaurants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentUser && <NotificationBell currentUser={currentUser} />}
              <Link to={createPageUrl('RestaurantSettings') + `?id=${restaurantId || ''}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <Link to={createPageUrl('OwnerAnalytics') + `?id=${restaurantId || ''}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Button>
              </Link>
            </div>
          </div>

          {/* Restaurant Selector */}
          {allRestaurants.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {allRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => setSelectedRestaurant(restaurant)}
                  className={cn(
                    "px-4 py-2 rounded-full border whitespace-nowrap transition-all",
                    selectedRestaurant?.id === restaurant.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {restaurant.name}
                  {restaurant.status !== 'approved' && (
                    <Badge variant="secondary" className="ml-2">
                      {restaurant.status}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {allRestaurants.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <Store className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No restaurants yet</h2>
              <p className="text-slate-500 mb-6">Create your first restaurant to start managing seating</p>
              <Link to={createPageUrl('CreateRestaurant')}>
                <Button className="rounded-full gap-2">
                  <Plus className="w-4 h-4" />
                  Add Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : currentRestaurant ? (
          <>
            <ShiftModePanel restaurant={currentRestaurant} />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{viewCount}</p>
                      <p className="text-sm text-slate-500">Views today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <MousePointerClick className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{clickCount}</p>
                      <p className="text-sm text-slate-500">Clicks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{waitlistWaitingCount}</p>
                      <p className="text-sm text-slate-500">On waitlist</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{currentRestaurant.favorite_count || 0}</p>
                      <p className="text-sm text-slate-500">Favorites</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 bg-white shadow-sm rounded-full p-1 flex-wrap">
                <TabsTrigger value="seating" className="rounded-full gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  Live Seating
                </TabsTrigger>

                <TabsTrigger value="floorplan" className="rounded-full gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  Floor Plan Builder
                </TabsTrigger>

                <TabsTrigger value="waitlist" className="rounded-full">
                  Waitlist
                  {waitlistWaitingCount > 0 && (
                    <Badge className="ml-2 bg-emerald-600">{waitlistWaitingCount}</Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger value="reservations" className="rounded-full">
                  Reservations
                  {reservations.filter(r => r?.status === 'pending').length > 0 && (
                    <Badge className="ml-2 bg-amber-500">
                      {reservations.filter(r => r?.status === 'pending').length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger value="calendar" className="rounded-full gap-1.5">Calendar</TabsTrigger>
                <TabsTrigger value="ai" className="rounded-full gap-1.5">AI Insights</TabsTrigger>
                <TabsTrigger value="loyalty" className="rounded-full">Loyalty</TabsTrigger>
                <TabsTrigger value="menu" className="rounded-full">Menu</TabsTrigger>
                <TabsTrigger value="offers" className="rounded-full gap-1.5">Offers & Pricing</TabsTrigger>
              </TabsList>

              <TabsContent value="seating">
                <LiveSeating restaurant={currentRestaurant} />
              </TabsContent>

              <TabsContent value="floorplan">
                <FloorPlanBuilderPremium
                  restaurant={currentRestaurant}
                  onPublish={() => queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] })}
                />
              </TabsContent>

              <TabsContent value="waitlist">
                <FeatureGate
                  restaurantId={restaurantId}
                  feature="waitlist"
                  requiredPlan="pro"
                  title="Waitlist Management"
                  description="Upgrade to Pro to manage your waitlist with AI-powered features."
                >
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <WaitlistManager
                        entries={waitlist}
                        onSeat={(entry) => seatEntryMutation.mutate(entry)}
                        onCancel={(entry) => cancelEntryMutation.mutate(entry)}
                        isUpdating={seatEntryMutation.isPending || cancelEntryMutation.isPending}
                        restaurantId={restaurantId}
                      />

                      {featureAccess?.isPlus && waitlistWaitingCount > 0 && (
                        <AITableAssigner
                          restaurantId={restaurantId}
                          waitlistEntries={waitlist}
                          tables={tables}
                          onAssignmentMade={() => queryClient.invalidateQueries({ queryKey: ['waitlist', restaurantId] })}
                        />
                      )}
                    </div>

                    <WaitlistSMSManager
                      restaurantId={restaurantId}
                      restaurantName={currentRestaurant?.name}
                    />
                  </div>
                </FeatureGate>
              </TabsContent>

              <TabsContent value="reservations">
                <div className="space-y-6">
                  <AutoReservationRules restaurantId={restaurantId} />

                  <div className="grid lg:grid-cols-2 gap-6">
                    <ReservationManagerPremium
                      reservations={reservations}
                      restaurantId={restaurantId}
                      restaurantName={currentRestaurant?.name}
                    />

                    <FeatureGate
                      restaurantId={restaurantId}
                      feature="aiReservations"
                      requiredPlan="plus"
                      title="AI Reservation Manager"
                      description="Let AI automatically handle reservations based on your rules."
                    >
                      <AIReservationManager
                        restaurantId={restaurantId}
                        restaurantName={currentRestaurant?.name}
                        reservations={reservations}
                        tables={tables}
                      />
                    </FeatureGate>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="calendar">
                <ReservationCalendar
                  restaurantId={restaurantId}
                  restaurantName={currentRestaurant?.name}
                />
              </TabsContent>

              <TabsContent value="ai">
                <FeatureGate
                  restaurantId={restaurantId}
                  feature="ai"
                  requiredPlan="plus"
                  title="AI Insights & Analytics"
                  description="Get powerful AI-driven insights, occupancy forecasting, and review analysis."
                >
                  <div className="space-y-6">
                    <OwnerAI restaurant={currentRestaurant} />

                    <div className="grid lg:grid-cols-2 gap-6">
                      <OccupancyForecaster restaurantId={restaurantId} />
                      <AIRecommendations restaurantId={restaurantId} restaurant={currentRestaurant} />
                    </div>

                    <PredictiveAnalytics restaurantId={restaurantId} />

                    <div className="grid lg:grid-cols-2 gap-6">
                      <SeatingHeatmap restaurantId={restaurantId} floorPlanData={currentRestaurant?.floor_plan_data} />
                      <ABTestingSuggestions restaurantId={restaurantId} />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                      <AIFloorPlanOptimizer restaurantId={restaurantId} currentLayout={currentRestaurant?.floor_plan_data} />
                      <AIReviewAnalyzer restaurantId={restaurantId} />
                    </div>
                  </div>
                </FeatureGate>
              </TabsContent>

              <TabsContent value="loyalty">
                <FeatureGate
                  restaurantId={restaurantId}
                  feature="loyalty"
                  requiredPlan="pro"
                  title="Customer Loyalty Program"
                  description="Create and manage your own loyalty program to reward repeat customers."
                >
                  <LoyaltyProgramManager restaurantId={restaurantId} restaurantName={currentRestaurant?.name} />
                </FeatureGate>
              </TabsContent>

              <TabsContent value="menu">
                <FeatureGate
                  restaurantId={restaurantId}
                  feature="menu"
                  requiredPlan="pro"
                  title="Menu Management"
                  description="Create and manage your restaurant's menu with categories, items, and dietary info."
                >
                  <MenuBuilder restaurantId={restaurantId} />
                </FeatureGate>
              </TabsContent>

              <TabsContent value="offers">
                <div className="space-y-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <OfferManager restaurantId={restaurantId} />
                    <AIPersonalizedOffers
                      restaurantId={restaurantId}
                      restaurantName={currentRestaurant?.name}
                      cuisine={currentRestaurant?.cuisine}
                    />
                  </div>
                  <AIDynamicPricing restaurantId={restaurantId} />
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Store, Users, BarChart3, Settings, Plus, 
  Eye, Heart, MousePointerClick, LayoutGrid
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import AISMSNotifications from '@/components/ai/AISMSNotifications';
import AIReservationRules from '@/components/ai/AIReservationRules';
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

  // Fetch owner's restaurants
  const { data: ownedRestaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['ownedRestaurants', currentUser?.id],
    queryFn: () => base44.entities.Restaurant.filter({ owner_id: currentUser.id }),
    enabled: !!currentUser,
  });

  // Also check staff assignments
  const { data: staffAssignments = [] } = useQuery({
    queryKey: ['staffAssignments', currentUser?.email],
    queryFn: () => base44.entities.RestaurantStaff.filter({ 
      user_email: currentUser.email,
      is_active: true 
    }),
    enabled: !!currentUser,
  });

  // Fetch staff-assigned restaurants
  const { data: staffRestaurants = [] } = useQuery({
    queryKey: ['staffRestaurants', staffAssignments],
    queryFn: async () => {
      if (staffAssignments.length === 0) return [];
      const promises = staffAssignments.map(s => 
        base44.entities.Restaurant.filter({ id: s.restaurant_id }).then(r => r[0])
      );
      return Promise.all(promises);
    },
    enabled: staffAssignments.length > 0,
  });

  const allRestaurants = [...ownedRestaurants, ...staffRestaurants.filter(Boolean)];

  // Set default selected restaurant
  useEffect(() => {
    if (allRestaurants.length > 0 && !selectedRestaurant) {
      setSelectedRestaurant(allRestaurants[0]);
    }
  }, [allRestaurants, selectedRestaurant]);

  // Fetch areas for selected restaurant
  const { data: areas = [] } = useQuery({
    queryKey: ['areas', selectedRestaurant?.id],
    queryFn: () => base44.entities.RestaurantArea.filter({ 
      restaurant_id: selectedRestaurant.id 
    }),
    enabled: !!selectedRestaurant,
  });

  // Fetch tables for selected restaurant
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', selectedRestaurant?.id],
    queryFn: () => base44.entities.Table.filter({ 
      restaurant_id: selectedRestaurant.id 
    }),
    enabled: !!selectedRestaurant,
  });

  // Fetch waitlist for selected restaurant
  const { data: waitlist = [] } = useQuery({
    queryKey: ['waitlist', selectedRestaurant?.id],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: selectedRestaurant.id 
    }, '-created_date'),
    enabled: !!selectedRestaurant,
  });

  // Fetch analytics events (last 24 hours)
  const { data: recentEvents = [] } = useQuery({
    queryKey: ['events', selectedRestaurant?.id],
    queryFn: () => base44.entities.AnalyticsEvent.filter({ 
      restaurant_id: selectedRestaurant.id 
    }, '-created_date', 100),
    enabled: !!selectedRestaurant,
  });

  // Fetch reservations
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', selectedRestaurant?.id],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: selectedRestaurant.id 
    }, '-created_date'),
    enabled: !!selectedRestaurant,
  });

  // Update seating mutation
  const updateSeatingMutation = useMutation({
    mutationFn: async (newAvailable) => {
      await base44.entities.Restaurant.update(selectedRestaurant.id, {
        available_seats: newAvailable,
        seating_updated_at: new Date().toISOString()
      });
      // Log to history
      await base44.entities.SeatingHistory.create({
        restaurant_id: selectedRestaurant.id,
        available_seats: newAvailable,
        total_seats: selectedRestaurant.total_seats,
        occupancy_percent: ((selectedRestaurant.total_seats - newAvailable) / selectedRestaurant.total_seats) * 100,
        recorded_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ownedRestaurants']);
      queryClient.invalidateQueries(['staffRestaurants']);
    }
  });

  // Toggle full status mutation
  const toggleFullMutation = useMutation({
    mutationFn: async (isFull) => {
      await base44.entities.Restaurant.update(selectedRestaurant.id, {
        is_full: isFull,
        seating_updated_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ownedRestaurants']);
      queryClient.invalidateQueries(['staffRestaurants']);
    }
  });

  // Area mutations
  const createAreaMutation = useMutation({
    mutationFn: (areaData) => base44.entities.RestaurantArea.create({
      ...areaData,
      restaurant_id: selectedRestaurant.id
    }),
    onSuccess: () => queryClient.invalidateQueries(['areas'])
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RestaurantArea.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['areas'])
  });

  const deleteAreaMutation = useMutation({
    mutationFn: (id) => base44.entities.RestaurantArea.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['areas'])
  });

  // Waitlist mutations
  const seatEntryMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'seated',
      seated_at: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries(['waitlist'])
  });

  const cancelEntryMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'cancelled'
    }),
    onSuccess: () => queryClient.invalidateQueries(['waitlist'])
  });

  // Calculate analytics
  const viewCount = recentEvents.filter(e => e.event_type === 'view').length;
  const clickCount = recentEvents.filter(e => 
    ['call_click', 'directions_click', 'website_click'].includes(e.event_type)
  ).length;
  const waitlistJoins = recentEvents.filter(e => e.event_type === 'waitlist_join').length;

  const currentRestaurant = allRestaurants.find(r => r.id === selectedRestaurant?.id) || selectedRestaurant;
  const featureAccess = useFeatureAccess(selectedRestaurant?.id);

  if (!currentUser || loadingRestaurants) {
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
              <Link to={createPageUrl('RestaurantSettings') + `?id=${selectedRestaurant?.id}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <Link to={createPageUrl('OwnerAnalytics') + `?id=${selectedRestaurant?.id}`}>
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
            {/* Shift Mode Panel */}
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
                      <p className="text-2xl font-bold text-slate-900">
                        {waitlist.filter(w => w.status === 'waiting').length}
                      </p>
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
                      <p className="text-2xl font-bold text-slate-900">
                        {currentRestaurant.favorite_count || 0}
                      </p>
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
                  {waitlist.filter(w => w.status === 'waiting').length > 0 && (
                    <Badge className="ml-2 bg-emerald-600">
                      {waitlist.filter(w => w.status === 'waiting').length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reservations" className="rounded-full">
                        Reservations
                        {reservations.filter(r => r.status === 'pending').length > 0 && (
                          <Badge className="ml-2 bg-amber-500">
                            {reservations.filter(r => r.status === 'pending').length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="calendar" className="rounded-full gap-1.5">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Calendar
                      </TabsTrigger>
                      <TabsTrigger value="ai" className="rounded-full gap-1.5">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                              </svg>
                              AI Insights
                            </TabsTrigger>
                            <TabsTrigger value="loyalty" className="rounded-full">
                                  Loyalty
                                </TabsTrigger>
                                <TabsTrigger value="menu" className="rounded-full">
                                  Menu
                                </TabsTrigger>
                                <TabsTrigger value="offers" className="rounded-full gap-1.5">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 12v10H4V12M2 7h20v5H2z"/>
                                  </svg>
                                  Offers & Pricing
                                </TabsTrigger>
                                </TabsList>

              <TabsContent value="seating">
                <LiveSeating restaurant={currentRestaurant} />
              </TabsContent>

              <TabsContent value="floorplan">
                <FloorPlanBuilderPremium
                  restaurant={currentRestaurant}
                  onPublish={() => queryClient.invalidateQueries(['ownedRestaurants'])}
                />
              </TabsContent>

              <TabsContent value="waitlist">
                    <FeatureGate
                      restaurantId={selectedRestaurant?.id}
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
                            restaurantId={selectedRestaurant?.id}
                          />

                          {/* AI Table Assigner */}
                          {featureAccess.isPlus && waitlist.filter(e => e.status === 'waiting').length > 0 && (
                            <AITableAssigner
                              restaurantId={selectedRestaurant?.id}
                              waitlistEntries={waitlist}
                              tables={tables || []}
                              onAssignmentMade={() => queryClient.invalidateQueries(['waitlist'])}
                            />
                          )}
                        </div>

                        {/* Waitlist SMS Manager */}
                        <WaitlistSMSManager
                          restaurantId={selectedRestaurant?.id}
                          restaurantName={currentRestaurant?.name}
                        />
                      </div>
                    </FeatureGate>
                  </TabsContent>

              <TabsContent value="reservations">
                    <div className="space-y-6">
                      {/* Auto Reservation Rules */}
                      <AutoReservationRules restaurantId={selectedRestaurant?.id} />

                      <div className="grid lg:grid-cols-2 gap-6">
                        <ReservationManagerPremium
                          reservations={reservations || []}
                          restaurantId={selectedRestaurant?.id}
                          restaurantName={currentRestaurant?.name}
                        />
                        <FeatureGate
                          restaurantId={selectedRestaurant?.id}
                          feature="aiReservations"
                          requiredPlan="plus"
                          title="AI Reservation Manager"
                          description="Let AI automatically handle reservations based on your rules."
                        >
                          <AIReservationManager
                            restaurantId={selectedRestaurant?.id}
                            restaurantName={currentRestaurant?.name}
                            reservations={reservations}
                            tables={tables || []}
                          />
                        </FeatureGate>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ai">
                    <FeatureGate
                      restaurantId={selectedRestaurant?.id}
                      feature="ai"
                      requiredPlan="plus"
                      title="AI Insights & Analytics"
                      description="Get powerful AI-driven insights, occupancy forecasting, and review analysis."
                    >
                      <div className="space-y-6">
                        <OwnerAI restaurant={currentRestaurant} />
                        <div className="grid lg:grid-cols-2 gap-6">
                          <OccupancyForecaster restaurantId={selectedRestaurant?.id} />
                          <AIRecommendations 
                            restaurantId={selectedRestaurant?.id} 
                            restaurant={currentRestaurant}
                          />
                        </div>
                        <PredictiveAnalytics restaurantId={selectedRestaurant?.id} />
                        <div className="grid lg:grid-cols-2 gap-6">
                          <SeatingHeatmap 
                            restaurantId={selectedRestaurant?.id}
                            floorPlanData={currentRestaurant?.floor_plan_data}
                          />
                          <ABTestingSuggestions restaurantId={selectedRestaurant?.id} />
                        </div>
                        <div className="grid lg:grid-cols-2 gap-6">
                          <AIFloorPlanOptimizer
                            restaurantId={selectedRestaurant?.id}
                            currentLayout={currentRestaurant?.floor_plan_data}
                          />
                          <AIReviewAnalyzer restaurantId={selectedRestaurant?.id} />
                        </div>
                      </div>
                    </FeatureGate>
                  </TabsContent>

                  <TabsContent value="loyalty">
                    <FeatureGate
                      restaurantId={selectedRestaurant?.id}
                      feature="loyalty"
                      requiredPlan="pro"
                      title="Customer Loyalty Program"
                      description="Create and manage your own loyalty program to reward repeat customers."
                    >
                      <LoyaltyProgramManager 
                        restaurantId={selectedRestaurant?.id}
                        restaurantName={currentRestaurant?.name}
                      />
                    </FeatureGate>
                  </TabsContent>

                  <TabsContent value="menu">
                    <FeatureGate
                      restaurantId={selectedRestaurant?.id}
                      feature="menu"
                      requiredPlan="pro"
                      title="Menu Management"
                      description="Create and manage your restaurant's menu with categories, items, and dietary info."
                    >
                      <MenuBuilder restaurantId={selectedRestaurant?.id} />
                    </FeatureGate>
                  </TabsContent>

                  <TabsContent value="offers">
                    <div className="space-y-6">
                      <div className="grid lg:grid-cols-2 gap-6">
                        <OfferManager restaurantId={selectedRestaurant?.id} />
                        <AIPersonalizedOffers 
                          restaurantId={selectedRestaurant?.id}
                          restaurantName={currentRestaurant?.name}
                          cuisine={currentRestaurant?.cuisine}
                        />
                      </div>
                      <AIDynamicPricing restaurantId={selectedRestaurant?.id} />
                    </div>
                  </TabsContent>

                  <TabsContent value="calendar">
                    <ReservationCalendar
                      restaurantId={selectedRestaurant?.id}
                      restaurantName={currentRestaurant?.name}
                    />
                  </TabsContent>
                  </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
// /app/src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Store,
  Users,
  BarChart3,
  Settings,
  Plus,
  Eye,
  Heart,
  MousePointerClick,
  LayoutGrid,
  ChefHat,
  Home,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import LiveSeating from "@/components/owner/LiveSeating";
import WaitlistManager from "@/components/owner/WaitlistManager";
import ReservationManagerPremium from "@/components/owner/ReservationManagerPremium";
import FloorPlanBuilderPremium from "@/components/owner/FloorPlanBuilderPremium";

import AITableAssigner from "@/components/ai/AITableAssigner";
import OccupancyForecaster from "@/components/ai/OccupancyForecaster";
import AIRecommendations from "@/components/ai/AIRecommendations";
import AIReviewAnalyzer from "@/components/ai/AIReviewAnalyzer";
import AIReservationManager from "@/components/ai/AIReservationManager";
import AIFloorPlanOptimizer from "@/components/ai/AIFloorPlanOptimizer";

import AutoReservationRules from "@/components/owner/AutoReservationRules";
import AdvancedReservationRules from "@/components/owner/AdvancedReservationRules";
import ReservationCalendar from "@/components/owner/ReservationCalendar";
import WaitlistSMSManager from "@/components/owner/WaitlistSMSManager";

import PredictiveAnalytics from "@/components/analytics/PredictiveAnalytics";
import SeatingHeatmap from "@/components/analytics/SeatingHeatmap";
import ABTestingSuggestions from "@/components/analytics/ABTestingSuggestions";

import FeatureGate from "@/components/subscription/FeatureGate";
import { useFeatureAccess } from "@/components/subscription/SubscriptionPlans";

import LoyaltyProgramManager from "@/components/owner/LoyaltyProgramManager";
import MenuBuilder from "@/components/owner/MenuBuilder";
import OfferManager from "@/components/owner/OfferManager";
import AIPersonalizedOffers from "@/components/ai/AIPersonalizedOffers";
import AIDynamicPricing from "@/components/ai/AIDynamicPricing";
import AIMenuOptimizer from "@/components/ai/AIMenuOptimizer";

import ShiftModePanel from "@/components/owner/ShiftModePanel";
import OwnerAI from "@/components/ai/OwnerAI";
import NotificationBell from "@/components/notifications/NotificationBell";

import AIStaffScheduler from "@/components/ai/AIStaffScheduler";
import InventoryManager from "@/components/owner/InventoryManager";
import AIInventoryInsights from "@/components/ai/AIInventoryInsights";
import CustomerProfileManager from "@/components/owner/CustomerProfileManager";
import AITableOptimizer from "@/components/ai/AITableOptimizer";
import AICustomerInsights from "@/components/analytics/AICustomerInsights";
import AIMenuSuggestions from "@/components/ai/AIMenuSuggestions";
import OwnerMessages from "@/components/messaging/OwnerMessages";
import MenuOptimizationEngine from "@/components/ai/MenuOptimizationEngine";
import StaffNotifications from '@/components/owner/StaffNotifications';
import ProfileDrawer from '@/components/profile/ProfileDrawer';
import StaleReservationAlert from '@/components/owner/StaleReservationAlert';

/**
 * Normalize anything into an array (prevents undefined.map crashes)
 */
const norm = (v) => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.items)) return v.items;
  return [];
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [activeTab, setActiveTab] = useState("seating");
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // ---- Auth / role check ----
  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl("Home"));
          return;
        }

        const user = await base44.auth.me();
        const isOwnerOrAdmin =
          user?.user_type === "owner" ||
          user?.user_type === "admin" ||
          user?.role === "admin";

        if (!isOwnerOrAdmin) {
          navigate(createPageUrl("Home"));
          return;
        }

        if (mounted) setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl("Home"));
      }
    };

    fetchUser();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ---- Queries ----

  // Owned restaurants
  const {
    data: ownedRestaurantsRaw,
    isLoading: loadingRestaurants,
    isFetching: fetchingRestaurants,
  } = useQuery({
    queryKey: ["ownedRestaurants", currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      // Base44 filter can return [] or {data: []} depending on backend
      return base44.entities.Restaurant.filter({ owner_id: currentUser.id });
    },
  });

  const ownedRestaurants = useMemo(
    () => norm(ownedRestaurantsRaw),
    [ownedRestaurantsRaw]
  );

  // Staff assignments (optional)
  const { data: staffAssignmentsRaw } = useQuery({
    queryKey: ["staffAssignments", currentUser?.email],
    enabled: !!currentUser?.email,
    queryFn: async () => {
      return base44.entities.RestaurantStaff.filter({
        user_email: currentUser.email,
        is_active: true,
      });
    },
  });

  const staffAssignments = useMemo(
    () => norm(staffAssignmentsRaw),
    [staffAssignmentsRaw]
  );

  // Staff restaurants
  const staffRestaurantIdsKey = useMemo(() => {
    const ids = staffAssignments.map((s) => s?.restaurant_id).filter(Boolean);
    return ids.join("|");
  }, [staffAssignments]);

  const { data: staffRestaurantsRaw } = useQuery({
    queryKey: ["staffRestaurants", staffRestaurantIdsKey],
    enabled: staffAssignments.length > 0,
    queryFn: async () => {
      // Fetch each restaurant by id; tolerate any weird return shape
      const ids = staffAssignments.map((s) => s?.restaurant_id).filter(Boolean);
      const results = await Promise.all(
        ids.map(async (id) => {
          const r = await base44.entities.Restaurant.filter({ id });
          return norm(r)[0] || null;
        })
      );
      return results.filter(Boolean);
    },
  });

  const staffRestaurants = useMemo(
    () => norm(staffRestaurantsRaw),
    [staffRestaurantsRaw]
  );

  const allRestaurants = useMemo(() => {
    // Avoid nulls + avoid duplicates by id
    const combined = [...ownedRestaurants, ...staffRestaurants].filter(Boolean);
    const seen = new Set();
    return combined.filter((r) => {
      if (!r?.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [ownedRestaurants, staffRestaurants]);

  // Default selected restaurant
  useEffect(() => {
    if (allRestaurants.length > 0 && !selectedRestaurant) {
      setSelectedRestaurant(allRestaurants[0]);
    }
  }, [allRestaurants, selectedRestaurant]);

  const selectedRestaurantId = selectedRestaurant?.id || null;

  // Tables — poll every 3s for real-time check-in status updates
  const { data: tablesRaw } = useQuery({
    queryKey: ["tables", selectedRestaurantId],
    enabled: !!selectedRestaurantId,
    refetchInterval: 30000,
    queryFn: async () => {
      return base44.entities.Table.filter({ restaurant_id: selectedRestaurantId });
    },
  });
  const tables = useMemo(() => norm(tablesRaw), [tablesRaw]);

  // Waitlist
  const { data: waitlistRaw } = useQuery({
    queryKey: ["waitlist", selectedRestaurantId],
    enabled: !!selectedRestaurantId,
    queryFn: async () => {
      return base44.entities.WaitlistEntry.filter(
        { restaurant_id: selectedRestaurantId },
        "-created_date"
      );
    },
  });
  const waitlist = useMemo(() => norm(waitlistRaw), [waitlistRaw]);

  // Recent events
  const { data: recentEventsRaw } = useQuery({
    queryKey: ["events", selectedRestaurantId],
    enabled: !!selectedRestaurantId,
    queryFn: async () => {
      return base44.entities.AnalyticsEvent.filter(
        { restaurant_id: selectedRestaurantId },
        "-created_date",
        100
      );
    },
  });
  const recentEvents = useMemo(() => norm(recentEventsRaw), [recentEventsRaw]);

  // Reservations — poll every 30s
  const { data: reservationsRaw } = useQuery({
    queryKey: ["reservations", selectedRestaurantId],
    enabled: !!selectedRestaurantId,
    refetchInterval: 30000,
    queryFn: async () => {
      return base44.entities.Reservation.filter(
        { restaurant_id: selectedRestaurantId },
        "-created_date"
      );
    },
  });
  const reservations = useMemo(() => norm(reservationsRaw), [reservationsRaw]);

  // Areas (optional prefetch; not used directly here)
  useQuery({
    queryKey: ["areas", selectedRestaurantId],
    enabled: !!selectedRestaurantId,
    queryFn: async () => {
      return base44.entities.RestaurantArea.filter({
        restaurant_id: selectedRestaurantId,
      });
    },
  });

  // Pick current restaurant object from list (keeps it fresh)
  const currentRestaurant = useMemo(() => {
    if (!selectedRestaurantId) return null;
    return (
      allRestaurants.find((r) => r?.id === selectedRestaurantId) ||
      selectedRestaurant ||
      null
    );
  }, [allRestaurants, selectedRestaurant, selectedRestaurantId]);

  const featureAccess = useFeatureAccess(selectedRestaurantId);

  // ---- Mutations ----

  const updateSeatingMutation = useMutation({
    mutationFn: async (newAvailable) => {
      if (!currentRestaurant?.id) return;

      const totalSeats = Number(currentRestaurant.total_seats || 0);
      const safeAvailable = Number(newAvailable || 0);

      await base44.entities.Restaurant.update(currentRestaurant.id, {
        available_seats: safeAvailable,
        seating_updated_at: new Date().toISOString(),
      });

      if (totalSeats > 0) {
        await base44.entities.SeatingHistory.create({
          restaurant_id: currentRestaurant.id,
          available_seats: safeAvailable,
          total_seats: totalSeats,
          occupancy_percent: ((totalSeats - safeAvailable) / totalSeats) * 100,
          recorded_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedRestaurants"] });
      queryClient.invalidateQueries({ queryKey: ["staffRestaurants"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const toggleFullMutation = useMutation({
    mutationFn: async (isFull) => {
      if (!currentRestaurant?.id) return;
      await base44.entities.Restaurant.update(currentRestaurant.id, {
        is_full: !!isFull,
        seating_updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownedRestaurants"] });
      queryClient.invalidateQueries({ queryKey: ["staffRestaurants"] });
    },
  });

  const seatEntryMutation = useMutation({
    mutationFn: async (entry) => {
      if (!entry?.id) return;
      return base44.entities.WaitlistEntry.update(entry.id, {
        status: "seated",
        seated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist"] }),
  });

  const cancelEntryMutation = useMutation({
    mutationFn: async (entry) => {
      if (!entry?.id) return;
      return base44.entities.WaitlistEntry.update(entry.id, {
        status: "cancelled",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist"] }),
  });

  // ---- Analytics (safe) ----
  const viewCount = useMemo(
    () => recentEvents.filter((e) => e?.event_type === "view").length,
    [recentEvents]
  );

  const clickCount = useMemo(
    () =>
      recentEvents.filter((e) =>
        ["call_click", "directions_click", "website_click"].includes(e?.event_type)
      ).length,
    [recentEvents]
  );

  const waitlistJoins = useMemo(
    () => recentEvents.filter((e) => e?.event_type === "waitlist_join").length,
    [recentEvents]
  );

  const waitingCount = useMemo(
    () => waitlist.filter((w) => w?.status === "waiting").length,
    [waitlist]
  );

  const pendingReservationsCount = useMemo(
    () => reservations.filter((r) => r?.status === "pending").length,
    [reservations]
  );

  // ---- Loading state ----
  if (!currentUser || loadingRestaurants || fetchingRestaurants) {
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

  // ---- Render ----
  return (
    <div className="min-h-screen bg-slate-50">
      <StaffNotifications restaurant={selectedRestaurant} />

      {/* Profile Drawer */}
      {currentUser && (
        <ProfileDrawer
          currentUser={currentUser}
          onLogout={() => base44.auth.logout(createPageUrl('Home'))}
          open={showProfileDrawer}
          onOpenChange={setShowProfileDrawer}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfileDrawer(true)}
                className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <Store className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Owner Dashboard</h1>
                <p className="text-sm text-slate-500">
                  {allRestaurants.length} restaurant{allRestaurants.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!!currentUser && <NotificationBell currentUser={currentUser} />}
              <Link to={createPageUrl("Home")}>
                <Button variant="outline" className="rounded-full gap-2">
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
              <Link to={createPageUrl("RestaurantSettings") + `?id=${selectedRestaurantId || ""}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <Link to={createPageUrl("OwnerAnalytics") + `?id=${selectedRestaurantId || ""}`}>
                <Button variant="outline" className="rounded-full gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Button>
              </Link>
              <Link to={createPageUrl("CommandCenter") + `?restaurant_id=${selectedRestaurantId || ""}`}>
                <Button className="rounded-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0">
                  <Zap className="w-4 h-4" />
                  Command Center
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
                    selectedRestaurantId === restaurant.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {restaurant.name}
                  {restaurant.status && restaurant.status !== "approved" && (
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

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {allRestaurants.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <Store className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No restaurants yet</h2>
              <p className="text-slate-500 mb-6">
                Create your first restaurant to start managing seating
              </p>
              <Link to={createPageUrl("CreateRestaurant")}>
                <Button className="rounded-full gap-2">
                  <Plus className="w-4 h-4" />
                  Add Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : currentRestaurant ? (
          <>
            {/* Shift Mode */}
            <ShiftModePanel restaurant={currentRestaurant} />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 mt-6">
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
                      <p className="text-2xl font-bold text-slate-900">{waitingCount}</p>
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
                        {Number(currentRestaurant.favorite_count || 0)}
                      </p>
                      <p className="text-sm text-slate-500">Favorites</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 bg-white shadow-sm rounded-full p-1 flex-wrap min-h-fit">
                <TabsTrigger value="seating" className="rounded-full gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  Live Seating
                </TabsTrigger>

                <TabsTrigger value="floorplan" className="rounded-full gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  Floor Plan Builder
                </TabsTrigger>

                <TabsTrigger value="guests" className="rounded-full gap-1.5">
                  <Users className="w-4 h-4" />
                  Guest Management
                  {(waitingCount + pendingReservationsCount) > 0 && (
                    <Badge className="ml-2 bg-amber-500">{waitingCount + pendingReservationsCount}</Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger value="ai" className="rounded-full gap-1.5">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  AI Insights
                </TabsTrigger>

                <TabsTrigger value="loyalty" className="rounded-full">
                  Loyalty
                </TabsTrigger>

                <TabsTrigger value="menu" className="rounded-full">
                  Menu
                </TabsTrigger>

                <TabsTrigger value="kitchen" className="rounded-full gap-1.5">
                  <ChefHat className="w-4 h-4" />
                  Kitchen
                </TabsTrigger>

                <TabsTrigger value="offers" className="rounded-full gap-1.5">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 12v10H4V12M2 7h20v5H2z" />
                  </svg>
                  Offers & Pricing
                </TabsTrigger>

                <TabsTrigger value="staff" className="rounded-full gap-1.5">
                  <Users className="w-4 h-4" />
                  Staff
                </TabsTrigger>

                <TabsTrigger value="inventory" className="rounded-full gap-1.5">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  Inventory
                </TabsTrigger>

                <TabsTrigger value="customers" className="rounded-full gap-1.5">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Customers
                </TabsTrigger>

                <TabsTrigger value="messages" className="rounded-full gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Messages
                </TabsTrigger>
              </TabsList>

              <TabsContent value="seating">
                <StaleReservationAlert restaurantId={selectedRestaurantId} />
                {/* Table Status Legend */}
                <div className="flex flex-wrap gap-3 mb-4 px-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#10B981' }} />
                    Available
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#F59E0B' }} />
                    Arrived Early
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#EF4444' }} />
                    Occupied / Checked In
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#3B82F6' }} />
                    Reserved
                  </div>
                </div>
                <LiveSeating restaurant={currentRestaurant} />
              </TabsContent>

              <TabsContent value="floorplan">
                <FloorPlanBuilderPremium
                  restaurant={currentRestaurant}
                  onPublish={() => queryClient.invalidateQueries({ queryKey: ["ownedRestaurants"] })}
                />
              </TabsContent>

              <TabsContent value="guests">
                <div className="space-y-8">
                  {/* Reservations Section */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Reservations
                      {pendingReservationsCount > 0 && (
                        <Badge className="bg-amber-500">{pendingReservationsCount} pending</Badge>
                      )}
                    </h3>
                    <div className="space-y-4">
                      <AdvancedReservationRules restaurantId={selectedRestaurantId} />
                      <div className="grid lg:grid-cols-2 gap-6">
                        <ReservationManagerPremium
                          reservations={reservations}
                          restaurantId={selectedRestaurantId}
                          restaurantName={currentRestaurant?.name}
                        />
                        <FeatureGate
                          restaurantId={selectedRestaurantId}
                          feature="aiReservations"
                          requiredPlan="plus"
                          title="AI Reservation Manager"
                          description="Let AI automatically handle reservations based on your rules."
                        >
                          <AIReservationManager
                            restaurantId={selectedRestaurantId}
                            restaurantName={currentRestaurant?.name}
                            reservations={reservations}
                            tables={tables}
                          />
                        </FeatureGate>
                      </div>
                    </div>
                  </div>

                  {/* Calendar Section */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Calendar View
                    </h3>
                    <ReservationCalendar
                      restaurantId={selectedRestaurantId}
                      restaurantName={currentRestaurant?.name}
                    />
                  </div>

                  {/* Waitlist Section */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" />
                      Waitlist
                      {waitingCount > 0 && (
                        <Badge className="bg-emerald-600">{waitingCount} waiting</Badge>
                      )}
                    </h3>
                    <FeatureGate
                      restaurantId={selectedRestaurantId}
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
                            restaurantId={selectedRestaurantId}
                          />
                          {featureAccess?.isPlus && waitingCount > 0 && (
                            <AITableAssigner
                              restaurantId={selectedRestaurantId}
                              waitlistEntries={waitlist}
                              tables={tables}
                              onAssignmentMade={() =>
                                queryClient.invalidateQueries({ queryKey: ["waitlist"] })
                              }
                            />
                          )}
                        </div>
                        <WaitlistSMSManager
                          restaurantId={selectedRestaurantId}
                          restaurantName={currentRestaurant?.name}
                        />
                      </div>
                    </FeatureGate>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ai">
                <FeatureGate
                  restaurantId={selectedRestaurantId}
                  feature="ai"
                  requiredPlan="plus"
                  title="AI Insights & Analytics"
                  description="Get powerful AI-driven insights, occupancy forecasting, and review analysis."
                >
                  <div className="space-y-6">
                    <OwnerAI restaurant={currentRestaurant} />

                    <AITableOptimizer restaurantId={selectedRestaurantId} />

                    <AICustomerInsights restaurantId={selectedRestaurantId} />

                    <div className="grid lg:grid-cols-2 gap-6">
                      <OccupancyForecaster restaurantId={selectedRestaurantId} />
                      <AIRecommendations restaurantId={selectedRestaurantId} restaurant={currentRestaurant} />
                    </div>

                    <PredictiveAnalytics restaurantId={selectedRestaurantId} />

                    <div className="grid lg:grid-cols-2 gap-6">
                      <SeatingHeatmap
                        restaurantId={selectedRestaurantId}
                        floorPlanData={currentRestaurant?.floor_plan_data}
                      />
                      <ABTestingSuggestions restaurantId={selectedRestaurantId} />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                      <AIFloorPlanOptimizer
                        restaurantId={selectedRestaurantId}
                        currentLayout={currentRestaurant?.floor_plan_data}
                      />
                      <AIReviewAnalyzer restaurantId={selectedRestaurantId} />
                    </div>
                  </div>
                </FeatureGate>
              </TabsContent>

              <TabsContent value="loyalty">
                <FeatureGate
                  restaurantId={selectedRestaurantId}
                  feature="loyalty"
                  requiredPlan="pro"
                  title="Customer Loyalty Program"
                  description="Create and manage your own loyalty program to reward repeat customers."
                >
                  <LoyaltyProgramManager
                    restaurantId={selectedRestaurantId}
                    restaurantName={currentRestaurant?.name}
                  />
                </FeatureGate>
              </TabsContent>

              <TabsContent value="menu">
                <FeatureGate
                  restaurantId={selectedRestaurantId}
                  feature="menu"
                  requiredPlan="pro"
                  title="Menu Management"
                  description="Create and manage your restaurant's menu with categories, items, and dietary info."
                >
                  <div className="space-y-6">
                    <MenuOptimizationEngine
                      restaurantId={selectedRestaurantId}
                      cuisine={currentRestaurant?.cuisine}
                    />
                    <AIMenuSuggestions
                      restaurantId={selectedRestaurantId}
                      cuisine={currentRestaurant?.cuisine}
                      onAddItem={(item) => {
                        // Add via MenuBuilder
                        queryClient.invalidateQueries(['menuItems']);
                      }}
                    />
                    <MenuBuilder restaurantId={selectedRestaurantId} />
                  </div>
                </FeatureGate>
              </TabsContent>

              <TabsContent value="kitchen">
                <div className="text-center py-8">
                  <Link to={createPageUrl('KitchenView') + `?restaurant_id=${selectedRestaurantId}`}>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <ChefHat className="w-5 h-5" />
                      Open Kitchen View
                    </Button>
                  </Link>
                  <p className="text-sm text-slate-500 mt-3">
                    View and manage pre-orders for reservations
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="offers">
                <div className="space-y-6">
                  <AIMenuOptimizer restaurantId={selectedRestaurantId} />
                  <div className="grid lg:grid-cols-2 gap-6">
                    <OfferManager restaurantId={selectedRestaurantId} />
                    <AIPersonalizedOffers
                      restaurantId={selectedRestaurantId}
                      restaurantName={currentRestaurant?.name}
                      cuisine={currentRestaurant?.cuisine}
                    />
                  </div>
                  <AIDynamicPricing restaurantId={selectedRestaurantId} />
                </div>
              </TabsContent>

              <TabsContent value="staff">
                <AIStaffScheduler restaurantId={selectedRestaurantId} />
              </TabsContent>

              <TabsContent value="inventory">
                <div className="grid lg:grid-cols-2 gap-6">
                  <InventoryManager restaurantId={selectedRestaurantId} />
                  <AIInventoryInsights restaurantId={selectedRestaurantId} />
                </div>
              </TabsContent>

              <TabsContent value="customers">
                <CustomerProfileManager restaurantId={selectedRestaurantId} />
              </TabsContent>

              <TabsContent value="messages">
                <OwnerMessages restaurantId={selectedRestaurantId} currentUser={currentUser} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
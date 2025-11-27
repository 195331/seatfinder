import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Store, Users, Clock, BarChart3, Settings, Plus, 
  ChevronRight, Eye, Heart, MousePointerClick
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SeatingControl from '@/components/owner/SeatingControl';
import WaitlistManager from '@/components/owner/WaitlistManager';
import AreaManager from '@/components/owner/AreaManager';
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
              <TabsList className="mb-6 bg-white shadow-sm rounded-full p-1">
                <TabsTrigger value="seating" className="rounded-full">
                  Live Seating
                </TabsTrigger>
                <TabsTrigger value="areas" className="rounded-full">
                  Areas
                </TabsTrigger>
                <TabsTrigger value="waitlist" className="rounded-full">
                  Waitlist
                  {waitlist.filter(w => w.status === 'waiting').length > 0 && (
                    <Badge className="ml-2 bg-emerald-600">
                      {waitlist.filter(w => w.status === 'waiting').length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="seating">
                <SeatingControl
                  restaurant={currentRestaurant}
                  onSeatingChange={(value) => updateSeatingMutation.mutate(value)}
                  onFullToggle={(isFull) => toggleFullMutation.mutate(isFull)}
                  isUpdating={updateSeatingMutation.isPending || toggleFullMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="areas">
                <AreaManager
                  areas={areas}
                  onAreaCreate={(data) => createAreaMutation.mutate(data)}
                  onAreaUpdate={(id, data) => updateAreaMutation.mutate({ id, data })}
                  onAreaDelete={(id) => deleteAreaMutation.mutate(id)}
                  isUpdating={createAreaMutation.isPending || updateAreaMutation.isPending || deleteAreaMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="waitlist">
                <WaitlistManager
                  entries={waitlist}
                  onSeat={(entry) => seatEntryMutation.mutate(entry)}
                  onCancel={(entry) => cancelEntryMutation.mutate(entry)}
                  isUpdating={seatEntryMutation.isPending || cancelEntryMutation.isPending}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
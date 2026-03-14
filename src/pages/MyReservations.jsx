import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Calendar, Clock, Plus, LayoutGrid } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ReservationCard from '@/components/customer/ReservationCard';
import WaitlistStatus from '@/components/customer/WaitlistStatus';
import ReservationCalendar from '@/components/reservations/ReservationCalendar';
import { isAfter, parseISO } from 'date-fns';

export default function MyReservations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [cancelDialog, setCancelDialog] = useState({ open: false, reservation: null });
  const [confirmBanner, setConfirmBanner] = useState(null); // { type: 'confirm'|'cancel', resId }

  useEffect(() => {
    const fetchUser = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate(createPageUrl('Home'));
        return;
      }
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    fetchUser();
  }, [navigate]);

  // Handle confirm/cancel actions from email link (?action=confirm&id=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const resId  = params.get('id');
    if (action && resId) {
      setConfirmBanner({ type: action, resId });
      // Strip params from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch user's reservations
  const { data: reservations = [], isLoading: loadingReservations } = useQuery({
    queryKey: ['myReservations', currentUser?.id],
    queryFn: () => base44.entities.Reservation.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  // Fetch user's waitlist entries
  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['myWaitlist', currentUser?.id],
    queryFn: () => base44.entities.WaitlistEntry.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  // Fetch restaurants for reservations
  const restaurantIds = [...new Set([
    ...reservations.map(r => r.restaurant_id),
    ...waitlistEntries.map(w => w.restaurant_id)
  ])].filter(Boolean);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['reservationRestaurants', restaurantIds],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const results = await Promise.all(
        restaurantIds.map(id => base44.entities.Restaurant.filter({ id }).then(r => Array.isArray(r) ? r[0] : r))
      );
      return results.filter(Boolean);
    },
    enabled: restaurantIds.length > 0,
  });

  const restaurantMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

  // Cancel reservation mutation
  const cancelMutation = useMutation({
    mutationFn: (reservation) => base44.entities.Reservation.update(reservation.id, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myReservations']);
      toast.success("Reservation cancelled");
      setCancelDialog({ open: false, reservation: null });
      setConfirmBanner(null);
    }
  });

  // Handle email action banner once reservations are loaded
  useEffect(() => {
    if (!confirmBanner || reservations.length === 0) return;
    const res = reservations.find(r => r.id === confirmBanner.resId);
    if (!res) return;
    if (confirmBanner.type === 'cancel') {
      setCancelDialog({ open: true, reservation: res });
    } else if (confirmBanner.type === 'confirm') {
      toast.success(`✅ You're confirmed for ${res.reservation_time}! See you there.`);
      setConfirmBanner(null);
    }
  }, [confirmBanner, reservations]);

  // Leave waitlist mutation
  const leaveWaitlistMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myWaitlist']);
      toast.success("Left waitlist");
    }
  });

  // Separate upcoming, past, and cancelled reservations
  const now = new Date();
  const upcomingReservations = reservations.filter(r => {
    if (r.status === 'cancelled') return false;
    if (!r.reservation_date) return false;
    try {
      return isAfter(parseISO(r.reservation_date), now);
    } catch {
      return false;
    }
  });
  
  const pastReservations = reservations.filter(r => {
    if (r.status === 'cancelled') return false;
    if (!r.reservation_date) return true;
    try {
      return !isAfter(parseISO(r.reservation_date), now);
    } catch {
      return true;
    }
  });
  
  const cancelledReservations = reservations.filter(r => r.status === 'cancelled');

  // Deduplicate: one active entry per restaurant (keep the most recent)
  const activeWaitlistRaw = waitlistEntries.filter(w => ['waiting', 'notified'].includes(w.status));
  const activeWaitlist = Object.values(
    activeWaitlistRaw.reduce((acc, entry) => {
      if (!acc[entry.restaurant_id] || entry.created_date > acc[entry.restaurant_id].created_date) {
        acc[entry.restaurant_id] = entry;
      }
      return acc;
    }, {})
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">My Reservations</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Active Waitlist */}
        {activeWaitlist.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-500 mb-3">ACTIVE WAITLIST</h2>
            <div className="space-y-3">
              {activeWaitlist.map((entry) => {
                const allWaiting = waitlistEntries.filter(w => 
                  w.restaurant_id === entry.restaurant_id && w.status === 'waiting'
                );
                const position = allWaiting.findIndex(w => w.id === entry.id) + 1;
                
                return (
                  <div key={entry.id}>
                    <p className="text-xs text-slate-500 mb-1">
                      {restaurantMap[entry.restaurant_id]?.name}
                    </p>
                    <WaitlistStatus
                      entry={entry}
                      position={position}
                      totalWaiting={allWaiting.length}
                      onLeave={(e) => leaveWaitlistMutation.mutate(e)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reservations */}
        <Tabs defaultValue="calendar">
          <TabsList className="w-full bg-slate-100 rounded-full p-1 grid grid-cols-4">
            <TabsTrigger value="calendar" className="rounded-full gap-1 text-xs">
              <Calendar className="w-3.5 h-3.5" />Calendar
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-full text-xs">
              Upcoming ({upcomingReservations.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-full text-xs">
              Past ({pastReservations.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-full text-xs">
              Cancelled
            </TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-4">
            {loadingReservations ? (
              <div className="space-y-3">
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            ) : (
              <ReservationCalendar
                reservations={reservations.filter(r => r.status !== 'cancelled')}
                restaurantMap={restaurantMap}
                onCancel={(r) => setCancelDialog({ open: true, reservation: r })}
              />
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            {loadingReservations ? (
              <div className="space-y-3">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            ) : upcomingReservations.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 mb-4">No upcoming reservations</p>
                <Button onClick={() => navigate(createPageUrl('Home'))} className="rounded-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Make a Reservation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    restaurant={restaurantMap[reservation.restaurant_id]}
                    onCancel={(r) => setCancelDialog({ open: true, reservation: r })}
                    onModify={(r) => navigate(createPageUrl('RestaurantDetail') + `?id=${r.restaurant_id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {pastReservations.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">No past reservations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    restaurant={restaurantMap[reservation.restaurant_id]}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-4">
            {cancelledReservations.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">No cancelled reservations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cancelledReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    restaurant={restaurantMap[reservation.restaurant_id]}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your reservation. You can make a new reservation anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate(cancelDialog.reservation)}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Reservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
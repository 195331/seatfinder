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
    }
  });

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

  const activeWaitlist = waitlistEntries.filter(w => ['waiting', 'notified'].includes(w.status));

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
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full bg-slate-100 rounded-full p-1 grid grid-cols-3">
            <TabsTrigger value="upcoming" className="rounded-full">
              Upcoming ({upcomingReservations.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-full">
              Past ({pastReservations.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-full">
              Cancelled ({cancelledReservations.length})
            </TabsTrigger>
          </TabsList>

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
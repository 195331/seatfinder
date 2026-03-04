import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertCircle, Loader2, MapPin, Users, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

// Returns diff in minutes: positive = future, negative = past
function diffMinutes(reservationDate, reservationTime) {
  const [h, m] = (reservationTime || '12:00').split(':').map(Number);
  const resDateTime = new Date(reservationDate);
  resDateTime.setHours(h, m, 0, 0);
  const now = new Date();
  return (resDateTime - now) / 60000;
}

function getGateState(diffMin) {
  if (diffMin > 30) return 'too_early';
  if (diffMin > 15) return 'arrive_early';
  if (diffMin >= -15) return 'on_time';
  return 'late';
}

export default function CheckIn() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [now, setNow] = useState(new Date());
  const [actionDone, setActionDone] = useState(false);

  // Tick every 30s so the gate state refreshes
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Fetch reservation by token
  const { data: reservations = [], isLoading, error } = useQuery({
    queryKey: ['checkInReservation', token],
    queryFn: () => base44.entities.Reservation.filter({ check_in_token: token }),
    enabled: !!token,
    refetchInterval: 10000,
  });

  const reservation = reservations[0] || null;

  // Fetch restaurant info
  const { data: restaurantRows = [] } = useQuery({
    queryKey: ['checkInRestaurant', reservation?.restaurant_id],
    queryFn: () => base44.entities.Restaurant.filter({ id: reservation.restaurant_id }),
    enabled: !!reservation?.restaurant_id,
  });
  const restaurant = restaurantRows[0] || null;

  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: async (newStatus) => {
      await base44.entities.Reservation.update(reservation.id, {
        status: newStatus,
        checked_in_at: new Date().toISOString(),
      });
      if (reservation.table_id) {
        await base44.entities.Table.update(reservation.table_id, {
          status: newStatus === 'checked_in' ? 'occupied' : 'reserved',
          party_name: reservation.user_name,
          party_size: reservation.party_size,
          seated_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['checkInReservation', token]);
      setActionDone(true);
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-slate-500 mb-4">This check-in link is missing a token.</p>
            <Link to={createPageUrl('Home')}>
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Reservation Not Found</h2>
            <p className="text-slate-500">This check-in link is invalid or expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const diffMin = diffMinutes(reservation.reservation_date, reservation.reservation_time);
  const gate = getGateState(diffMin);

  const isAlreadyActioned = ['arrived_early', 'checked_in', 'cancelled', 'declined'].includes(reservation.status);

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Restaurant Header */}
        <div className="text-center text-white mb-2">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Check-In</p>
          <h1 className="text-2xl font-bold">{restaurant?.name || 'Your Reservation'}</h1>
          {restaurant?.address && (
            <p className="text-slate-400 text-sm flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {restaurant.neighborhood || restaurant.address}
            </p>
          )}
        </div>

        {/* Reservation Details Card */}
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                {reservation.reservation_date && format(parseISO(reservation.reservation_date), 'EEE, MMM d')}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                {formatTime(reservation.reservation_time)}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-4 h-4 text-slate-400" />
                {reservation.party_size} guests
              </div>
              <div>
                <Badge className={cn(
                  reservation.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  reservation.status === 'arrived_early' ? 'bg-amber-100 text-amber-700' :
                  reservation.status === 'checked_in' ? 'bg-green-600 text-white' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {reservation.status === 'arrived_early' ? 'Arrived Early' :
                   reservation.status === 'checked_in' ? 'Checked In' :
                   reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t">
              {/* Already actioned */}
              {isAlreadyActioned && reservation.status !== 'approved' ? (
                <div className={cn(
                  "rounded-xl p-4 text-center",
                  reservation.status === 'arrived_early' ? 'bg-amber-50' :
                  reservation.status === 'checked_in' ? 'bg-emerald-50' :
                  'bg-slate-50'
                )}>
                  {reservation.status === 'arrived_early' && (
                    <>
                      <Clock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-amber-800">You've logged your early arrival!</p>
                      <p className="text-sm text-amber-600 mt-1">The restaurant has been notified. Please wait to be seated.</p>
                    </>
                  )}
                  {reservation.status === 'checked_in' && (
                    <>
                      <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                      <p className="font-semibold text-emerald-800">You're checked in!</p>
                      <p className="text-sm text-emerald-600 mt-1">Welcome! Your table is ready.</p>
                    </>
                  )}
                  {['cancelled', 'declined'].includes(reservation.status) && (
                    <>
                      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                      <p className="font-semibold text-red-700">Reservation {reservation.status}</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Temporal gate messages */}
                  {gate === 'too_early' && (
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <Clock className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                      <p className="font-semibold text-blue-800">You're too early!</p>
                      <p className="text-sm text-blue-600 mt-1">
                        Check-in opens 30 minutes before your reservation at {formatTime(reservation.reservation_time)}.
                      </p>
                      <p className="text-xs text-blue-400 mt-2">
                        Come back in ~{Math.round(diffMin - 30)} more minutes.
                      </p>
                      <Button disabled className="mt-4 w-full opacity-40">Check-In Not Open Yet</Button>
                    </div>
                  )}

                  {gate === 'arrive_early' && (
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <Clock className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-amber-800">Arrive Early Status</p>
                      <p className="text-sm text-amber-600 mt-1">
                        You're early! Let the restaurant know you've arrived.
                      </p>
                      <Button
                        className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white"
                        disabled={checkInMutation.isPending || actionDone}
                        onClick={() => checkInMutation.mutate('arrived_early')}
                      >
                        {checkInMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                        Log Arrival
                      </Button>
                    </div>
                  )}

                  {gate === 'on_time' && (
                    <div className="bg-emerald-50 rounded-xl p-4 text-center">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-emerald-800">Time to check in!</p>
                      <p className="text-sm text-emerald-600 mt-1">
                        Perfect timing. Confirm your table seating below.
                      </p>
                      <Button
                        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={checkInMutation.isPending || actionDone}
                        onClick={() => checkInMutation.mutate('checked_in')}
                      >
                        {checkInMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Confirm Table Seating
                      </Button>
                    </div>
                  )}

                  {gate === 'late' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">Check-In Window Passed</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Your reservation time was {formatTime(reservation.reservation_time)}. Please speak with the host.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs">
          Need help? Contact {restaurant?.name} directly.
        </p>
      </div>
    </div>
  );
}
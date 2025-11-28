import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Users, Calendar, MessageSquare } from 'lucide-react';
import { toast } from "sonner";
import moment from 'moment';

export default function ReservationManager({ reservations, restaurantName }) {
  const queryClient = useQueryClient();

  const updateReservationMutation = useMutation({
    mutationFn: async ({ reservationId, status, userEmail, userName, userId, partySize, date, time }) => {
      await base44.entities.Reservation.update(reservationId, {
        status,
        owner_response_at: new Date().toISOString()
      });

      // Create in-app notification
      const notificationTitle = status === 'approved' 
        ? 'Reservation Confirmed!'
        : 'Reservation Update';
      
      const notificationMessage = status === 'approved'
        ? `Your reservation for ${partySize} guests on ${date} at ${time} has been confirmed. See you soon!`
        : `Unfortunately, your reservation request for ${date} at ${time} could not be confirmed. Please try a different time or contact the restaurant.`;

      await base44.entities.Notification.create({
        user_id: userId,
        user_email: userEmail,
        type: status === 'approved' ? 'reservation_approved' : 'reservation_declined',
        title: notificationTitle,
        message: notificationMessage,
        restaurant_name: restaurantName,
        reservation_id: reservationId
      });

      // Send email notification
      const subject = status === 'approved' 
        ? `Your reservation at ${restaurantName} is confirmed!`
        : `Reservation update from ${restaurantName}`;
      
      const body = status === 'approved'
        ? `Great news, ${userName}!\n\nYour reservation has been confirmed:\n- Restaurant: ${restaurantName}\n- Date: ${date}\n- Time: ${time}\n- Party Size: ${partySize} guests\n\nWe look forward to seeing you!`
        : `Hi ${userName},\n\nUnfortunately, we were unable to confirm your reservation at ${restaurantName} for ${date} at ${time}.\n\nPlease try a different time or contact us directly.`;

      await base44.integrations.Core.SendEmail({
        to: userEmail,
        subject,
        body
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries(['reservations']);
      toast.success(status === 'approved' ? 'Reservation approved! Customer notified.' : 'Reservation declined. Customer notified.');
    },
    onError: (error) => {
      toast.error("Failed to update reservation: " + error.message);
    }
  });

  const pendingReservations = reservations.filter(r => r.status === 'pending');
  const confirmedReservations = reservations.filter(r => r.status === 'approved');

  const handleApprove = (reservation) => {
    updateReservationMutation.mutate({
      reservationId: reservation.id,
      status: 'approved',
      userEmail: reservation.user_email,
      userName: reservation.user_name,
      userId: reservation.user_id,
      partySize: reservation.party_size,
      date: reservation.reservation_date,
      time: reservation.reservation_time
    });
  };

  const handleDecline = (reservation) => {
    updateReservationMutation.mutate({
      reservationId: reservation.id,
      status: 'declined',
      userEmail: reservation.user_email,
      userName: reservation.user_name,
      userId: reservation.user_id,
      partySize: reservation.party_size,
      date: reservation.reservation_date,
      time: reservation.reservation_time
    });
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Requests
            {pendingReservations.length > 0 && (
              <Badge className="bg-amber-500">{pendingReservations.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingReservations.length === 0 ? (
            <p className="text-slate-500 text-center py-6">No pending reservation requests</p>
          ) : (
            <div className="space-y-4">
              {pendingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{reservation.user_name}</h4>
                      <p className="text-sm text-slate-600">{reservation.user_email}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-400 text-amber-700">
                      Pending
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {moment(reservation.reservation_date).format('ddd, MMM D')} at {reservation.reservation_time}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-4 h-4" />
                      {reservation.party_size} guests
                    </div>
                  </div>

                  {reservation.notes && (
                    <div className="flex items-start gap-1.5 mb-4 text-sm text-slate-600">
                      <MessageSquare className="w-4 h-4 mt-0.5" />
                      {reservation.notes}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(reservation)}
                      disabled={updateReservationMutation.isPending}
                      className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDecline(reservation)}
                      disabled={updateReservationMutation.isPending}
                      className="flex-1 gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmed Reservations */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-500" />
            Confirmed Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confirmedReservations.length === 0 ? (
            <p className="text-slate-500 text-center py-6">No confirmed reservations for today</p>
          ) : (
            <div className="space-y-3">
              {confirmedReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
                >
                  <div>
                    <p className="font-medium text-slate-900">{reservation.user_name}</p>
                    <p className="text-sm text-slate-600">
                      {reservation.reservation_time} • {reservation.party_size} guests
                    </p>
                  </div>
                  <Badge className="bg-emerald-600">Confirmed</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
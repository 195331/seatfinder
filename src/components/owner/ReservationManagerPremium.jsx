import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SmartTableAssigner from '@/components/ai/SmartTableAssigner';
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Check, X, Clock, Users, Calendar as CalendarIcon, MessageSquare, 
  UtensilsCrossed, ChevronDown, ChevronUp, CalendarClock, Loader2 
} from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';
import moment from 'moment';
import { cn } from "@/lib/utils";

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

export default function ReservationManagerPremium({ reservations = [], restaurantId, restaurantName }) {
  const queryClient = useQueryClient();
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [rescheduleDialog, setRescheduleDialog] = useState({ open: false, reservation: null });
  const [newDate, setNewDate] = useState(null);
  const [newTime, setNewTime] = useState('');

  const TIME_SLOTS = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
  ];

  // Fetch pre-orders
  // Fetch pre-orders (with 5-second polling for dashboard awareness)
  const { data: preOrders = [] } = useQuery({
    queryKey: ['preOrders', (reservations || []).map(r => r.id)],
    queryFn: async () => {
      if (!reservations || reservations.length === 0) return [];
      const orders = await Promise.all(
        (reservations || []).map(r => 
          base44.entities.PreOrder.filter({ reservation_id: r.id }).then(o => o[0])
        )
      );
      return orders.filter(Boolean);
    },
    enabled: !!reservations && reservations.length > 0
  });

  // Fetch tables to update status
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      return await base44.entities.Table.filter({ restaurant_id: restaurantId });
    },
    enabled: !!restaurantId
  });

  const toggleOrderExpanded = (reservationId) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(reservationId)) {
      newExpanded.delete(reservationId);
    } else {
      newExpanded.add(reservationId);
    }
    setExpandedOrders(newExpanded);
  };

  const getPreOrderForReservation = (reservationId) => {
    return (preOrders || []).find(po => po?.reservation_id === reservationId);
  };

  const updateReservationMutation = useMutation({
    mutationFn: async ({ reservationId, status, userEmail, userName, userId, partySize, date, time, tableId }) => {
      await base44.entities.Reservation.update(reservationId, {
        status,
        owner_response_at: new Date().toISOString()
      });

      // Update table status automatically
      if (tableId && status === 'approved') {
        await base44.entities.Table.update(tableId, { status: 'reserved' });
      } else if (tableId && status === 'declined') {
        await base44.entities.Table.update(tableId, { status: 'free' });
      }

      // Notifications
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

      await base44.integrations.Core.SendEmail({
        to: userEmail,
        subject: status === 'approved' 
          ? `Your reservation at ${restaurantName} is confirmed!`
          : `Reservation update from ${restaurantName}`,
        body: notificationMessage
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries(['reservations']);
      queryClient.invalidateQueries(['tables']);

      // Send email notification to customer
      base44.integrations.Core.SendEmail({
        to: reservation.user_email,
        subject: status === 'approved' ? 'Reservation Confirmed! 🎉' : 'Reservation Update',
        body: status === 'approved' 
          ? `Great news! Your reservation at ${restaurant.name} has been confirmed.\n\nDetails:\n📅 ${reservation.reservation_date}\n⏰ ${reservation.reservation_time}\n👥 ${reservation.party_size} guests\n\nWe look forward to seeing you!`
          : `Thank you for your interest in ${restaurant.name}. Unfortunately, we cannot accommodate your reservation request at this time. Please try a different date/time or contact us directly.`
      }).catch(() => {});
      toast.success(status === 'approved' ? 'Reservation approved! Table marked as reserved.' : 'Reservation declined. Customer notified.');
    },
    onError: () => {
      toast.error("Failed to update reservation");
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ reservationId, newDate, newTime, userEmail, userName, partySize }) => {
      await base44.entities.Reservation.update(reservationId, {
        reservation_date: newDate,
        reservation_time: newTime,
        owner_response_at: new Date().toISOString()
      });

      await base44.entities.Notification.create({
        user_id: reservations.find(r => r.id === reservationId)?.user_id,
        user_email: userEmail,
        type: 'reservation_approved',
        title: 'Reservation Rescheduled',
        message: `Your reservation has been rescheduled to ${moment(newDate).format('MMM D')} at ${newTime}`,
        restaurant_name: restaurantName,
        reservation_id: reservationId
      });

      await base44.integrations.Core.SendEmail({
        to: userEmail,
        subject: `Reservation rescheduled at ${restaurantName}`,
        body: `Hi ${userName},\n\nYour reservation has been rescheduled:\n- New Date: ${moment(newDate).format('MMMM Do, YYYY')}\n- New Time: ${newTime}\n- Party Size: ${partySize} guests\n\nLooking forward to seeing you!`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
      setRescheduleDialog({ open: false, reservation: null });
      setNewDate(null);
      setNewTime('');
      toast.success('Reservation rescheduled! Customer notified.');
    }
  });

  const pendingReservations = (reservations || []).filter(r => r.status === 'pending');
  const confirmedReservations = (reservations || []).filter(r => r.status === 'approved');

  const handleApprove = (reservation) => {
    updateReservationMutation.mutate({
      reservationId: reservation.id,
      status: 'approved',
      userEmail: reservation.user_email,
      userName: reservation.user_name,
      userId: reservation.user_id,
      partySize: reservation.party_size,
      date: reservation.reservation_date,
      time: reservation.reservation_time,
      tableId: reservation.table_id
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
      time: reservation.reservation_time,
      tableId: reservation.table_id
    });
  };

  const handleReschedule = (reservation) => {
    setRescheduleDialog({ open: true, reservation });
    setNewDate(new Date(reservation.reservation_date));
    setNewTime(reservation.reservation_time);
  };

  const submitReschedule = () => {
    if (!newDate || !newTime) return;
    
    rescheduleMutation.mutate({
      reservationId: rescheduleDialog.reservation.id,
      newDate: format(newDate, 'yyyy-MM-dd'),
      newTime,
      userEmail: rescheduleDialog.reservation.user_email,
      userName: rescheduleDialog.reservation.user_name,
      partySize: rescheduleDialog.reservation.party_size
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
              {(pendingReservations || []).map((reservation) => {
                const preOrder = getPreOrderForReservation(reservation.id);
                const isExpanded = expandedOrders.has(reservation.id);
                
                return (
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
                        <CalendarIcon className="w-4 h-4" />
                        {moment(reservation.reservation_date).format('ddd, MMM D')} at {formatTime(reservation.reservation_time)}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                       <Users className="w-4 h-4" />
                       {reservation.party_size} guests • Table {(tables || []).find(t => t.id === reservation.table_id)?.label || '?'}
                      </div>
                    </div>

                    {reservation.notes && (
                      <div className="flex items-start gap-1.5 mb-4 text-sm text-slate-600 bg-white p-3 rounded-lg">
                        <MessageSquare className="w-4 h-4 mt-0.5" />
                        {reservation.notes}
                      </div>
                    )}

                    {preOrder && (
                      <div className="mb-4 bg-white border border-emerald-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleOrderExpanded(reservation.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-emerald-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium text-emerald-900">Pre-Order</span>
                            <Badge className="bg-emerald-600">{((preOrder?.items || []).length)} items</Badge>
                            <span className="text-sm text-emerald-700">${((preOrder?.total_amount || 0)).toFixed(2)}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isExpanded && (
                          <div className="p-3 pt-0 space-y-2">
                            {((preOrder?.items || [])).map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-slate-700">{item?.quantity}x {item?.name}</span>
                                <span className="text-slate-900 font-medium">${((item?.price || 0) * (item?.quantity || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                            {preOrder?.special_instructions && (
                              <div className="pt-2 mt-2 border-t text-xs text-slate-600">
                                <span className="font-medium">Instructions:</span> {preOrder.special_instructions}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <SmartTableAssigner 
                        reservation={reservation} 
                        restaurant={{ id: restaurantId }} 
                        onTableAssigned={() => queryClient.invalidateQueries(['reservations'])}
                      />
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
                          variant="outline"
                          onClick={() => handleReschedule(reservation)}
                          disabled={updateReservationMutation.isPending}
                          className="flex-1 gap-1.5"
                        >
                          <CalendarClock className="w-4 h-4" />
                          Reschedule
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
                  </div>
                );
              })}
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
            <p className="text-slate-500 text-center py-6">No confirmed reservations</p>
          ) : (
            <div className="space-y-3">
              {(confirmedReservations || []).map((reservation) => {
                const preOrder = getPreOrderForReservation(reservation.id);
                const tableLabel = (tables || []).find(t => t.id === reservation.table_id)?.label || '?';
                
                return (
                  <div
                    key={reservation.id}
                    className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{reservation.user_name}</p>
                      <p className="text-sm text-slate-600">
                       {moment(reservation.reservation_date).format('MMM D')} at {formatTime(reservation.reservation_time)} • {reservation.party_size} guests • Table {tableLabel}
                      </p>
                      <p className="text-xs text-slate-400">Reserved on {moment(reservation.created_date).format('MMM D, YYYY [at] h:mm A')}</p>
                      {preOrder && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-700">
                            <UtensilsCrossed className="w-3 h-3 mr-1" />
                            Pre-Order: ${((preOrder?.total_amount || 0)).toFixed(2)}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Badge className="bg-emerald-600">Confirmed</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      {rescheduleDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Reschedule Reservation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium">{rescheduleDialog.reservation?.user_name}</p>
                <p className="text-sm text-slate-600">
                  Originally: {moment(rescheduleDialog.reservation?.reservation_date).format('MMM D')} at {formatTime(rescheduleDialog.reservation?.reservation_time)}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1.5 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newDate ? format(newDate, 'PPP') : 'Select new date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-sm font-medium">New Time</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {(TIME_SLOTS || []).map(time => (
                    <Button
                      key={time}
                      variant={newTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewTime(time)}
                      className={cn(newTime === time && "bg-emerald-600")}
                    >
                      {formatTime(time)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setRescheduleDialog({ open: false, reservation: null });
                    setNewDate(null);
                    setNewTime('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={submitReschedule}
                  disabled={!newDate || !newTime || rescheduleMutation.isPending}
                >
                  {rescheduleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Confirm Reschedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
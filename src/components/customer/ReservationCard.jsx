import React, { useState } from 'react';
import { Calendar, Clock, Users, MapPin, X, CheckCircle, AlertCircle, Edit3, QrCode } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO, isAfter } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'Pending' },
  approved: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Confirmed' },
  declined: { color: 'bg-red-100 text-red-700', icon: X, label: 'Declined' },
  cancelled: { color: 'bg-slate-100 text-slate-500', icon: X, label: 'Cancelled' }
};

const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

export default function ReservationCard({ reservation, restaurant, onCancel, onModify }) {
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editPartySize, setEditPartySize] = useState(2);

  const status = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isUpcoming = reservation.reservation_date && isAfter(parseISO(reservation.reservation_date), new Date());
  const canModify = ['pending', 'approved'].includes(reservation.status) && isUpcoming;

  const updateReservationMutation = useMutation({
    mutationFn: async (updates) => {
      await base44.entities.Reservation.update(reservation.id, updates);
      
      // Send email notification
      await base44.integrations.Core.SendEmail({
        to: reservation.user_email,
        subject: 'Reservation Updated',
        body: `Your reservation at ${restaurant?.name} has been updated to ${format(parseISO(updates.reservation_date), 'PPP')} at ${updates.reservation_time} for ${updates.party_size} guests.`
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myReservations']);
      setShowEditDialog(false);
      toast.success('Reservation updated!');
    }
  });

  const handleOpenEdit = () => {
    setEditDate(parseISO(reservation.reservation_date));
    setEditTime(reservation.reservation_time);
    setEditPartySize(reservation.party_size);
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editDate || !editTime) return;
    
    updateReservationMutation.mutate({
      reservation_date: format(editDate, 'yyyy-MM-dd'),
      reservation_time: editTime,
      party_size: editPartySize
    });
  };

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all",
        !isUpcoming && reservation.status !== 'cancelled' && "opacity-60"
      )}>
        <CardContent className="p-0">
          <div className="flex">
            {/* Restaurant Image */}
            {restaurant?.cover_image && (
              <div className="w-24 h-full">
                <img 
                  src={restaurant.cover_image} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{restaurant?.name || 'Restaurant'}</h3>
                  <Badge className={cn("mt-1", status.color)}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-3">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {reservation.reservation_date && format(parseISO(reservation.reservation_date), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {reservation.reservation_time}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  {reservation.party_size} guests
                </div>
                {restaurant?.address && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{restaurant.neighborhood || restaurant.address}</span>
                  </div>
                )}
              </div>

              {reservation.notes && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                  Note: {reservation.notes}
                </p>
              )}

              {canModify && (
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs gap-2"
                    onClick={handleOpenEdit}
                  >
                    <Edit3 className="w-3 h-3" />
                    Modify
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                    onClick={() => onCancel?.(reservation)}
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1.5 justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={editDate}
                    onSelect={setEditDate}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Time</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5 max-h-48 overflow-y-auto">
                {TIME_SLOTS.map(time => (
                  <Button
                    key={time}
                    variant={editTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditTime(time)}
                    className={cn(editTime === time && "bg-emerald-600 hover:bg-emerald-700")}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Party Size</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={editPartySize}
                onChange={(e) => setEditPartySize(parseInt(e.target.value) || 1)}
                className="mt-1.5"
              />
            </div>

            <Button
              onClick={handleSaveEdit}
              disabled={!editDate || !editTime || updateReservationMutation.isPending}
              className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              {updateReservationMutation.isPending ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
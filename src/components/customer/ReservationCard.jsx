import React from 'react';
import { Calendar, Clock, Users, MapPin, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, isAfter } from 'date-fns';
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'Pending' },
  approved: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Confirmed' },
  declined: { color: 'bg-red-100 text-red-700', icon: X, label: 'Declined' },
  cancelled: { color: 'bg-slate-100 text-slate-500', icon: X, label: 'Cancelled' }
};

export default function ReservationCard({ reservation, restaurant, onCancel, onModify }) {
  const status = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isUpcoming = reservation.reservation_date && isAfter(parseISO(reservation.reservation_date), new Date());
  const canModify = ['pending', 'approved'].includes(reservation.status) && isUpcoming;

  return (
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
                  className="text-xs"
                  onClick={() => onModify?.(reservation)}
                >
                  Modify
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onCancel?.(reservation)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
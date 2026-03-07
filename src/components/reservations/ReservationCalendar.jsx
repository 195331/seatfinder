import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Users, MapPin, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  pending: 'bg-yellow-500',
  approved: 'bg-emerald-500',
  declined: 'bg-red-500',
  cancelled: 'bg-slate-400',
  checked_in: 'bg-blue-500',
  arrived_early: 'bg-purple-500',
};

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  checked_in: 'Checked In',
  arrived_early: 'Arrived Early',
};

export default function ReservationCalendar({ reservations = [], restaurantMap = {}, onCancel }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailReservation, setDetailReservation] = useState(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Map date-string -> reservations
  const reservationsByDate = useMemo(() => {
    const map = {};
    reservations.forEach(r => {
      if (!r.reservation_date) return;
      const key = r.reservation_date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [reservations]);

  const selectedDateReservations = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return reservationsByDate[key] || [];
  }, [selectedDate, reservationsByDate]);

  // Get starting weekday offset
  const startOffset = startOfMonth(currentMonth).getDay();

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="font-bold text-lg text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-3">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells before month start */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 border-b border-r border-slate-50 last:border-r-0" />
          ))}

          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayReservations = reservationsByDate[key] || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            const colIndex = (startOffset + idx) % 7;

            return (
              <div
                key={key}
                onClick={() => setSelectedDate(isSameDay(day, selectedDate) ? null : day)}
                className={cn(
                  "h-16 p-1.5 border-b border-r border-slate-50 cursor-pointer transition-colors relative",
                  colIndex === 6 && "border-r-0",
                  isSelected ? "bg-emerald-50" : "hover:bg-slate-50",
                )}
              >
                <span className={cn(
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                  today ? "bg-emerald-600 text-white" : isSelected ? "text-emerald-700" : "text-slate-700"
                )}>
                  {format(day, 'd')}
                </span>

                {/* Reservation dots */}
                {dayReservations.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayReservations.slice(0, 3).map((r, i) => (
                      <div
                        key={i}
                        className={cn("w-1.5 h-1.5 rounded-full", STATUS_COLORS[r.status] || 'bg-slate-400')}
                      />
                    ))}
                    {dayReservations.length > 3 && (
                      <span className="text-[9px] text-slate-500">+{dayReservations.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-xs text-slate-500">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* Selected Date Reservations */}
      {selectedDate && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 px-1">
            {format(selectedDate, 'EEEE, MMMM d')}
            {selectedDateReservations.length === 0 && (
              <span className="text-slate-400 font-normal ml-2 text-sm">— No reservations</span>
            )}
          </h3>
          {selectedDateReservations.map(r => {
            const restaurant = restaurantMap[r.restaurant_id];
            return (
              <div
                key={r.id}
                onClick={() => setDetailReservation(r)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[r.status] || 'bg-slate-400')} />
                      <p className="font-semibold text-slate-900 truncate">{restaurant?.name || 'Restaurant'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                      {r.reservation_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />{r.reservation_time}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />{r.party_size} guests
                      </span>
                      {restaurant?.neighborhood && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />{restaurant.neighborhood}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-xs flex-shrink-0",
                    r.status === 'approved' && "border-emerald-300 text-emerald-700 bg-emerald-50",
                    r.status === 'pending' && "border-yellow-300 text-yellow-700 bg-yellow-50",
                    r.status === 'declined' && "border-red-300 text-red-700 bg-red-50",
                  )}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      {detailReservation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setDetailReservation(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Reservation Details</h3>
              <button onClick={() => setDetailReservation(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="font-medium">{restaurantMap[detailReservation.restaurant_id]?.name || 'Restaurant'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="font-semibold text-sm">
                    {detailReservation.reservation_date
                      ? format(parseISO(detailReservation.reservation_date), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Time</p>
                  <p className="font-semibold text-sm">{detailReservation.reservation_time || '—'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Party Size</p>
                  <p className="font-semibold text-sm">{detailReservation.party_size} guests</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[detailReservation.status])} />
                    <p className="font-semibold text-sm">{STATUS_LABELS[detailReservation.status] || detailReservation.status}</p>
                  </div>
                </div>
              </div>
              {detailReservation.special_requests && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Special Requests</p>
                  <p className="text-sm">{detailReservation.special_requests}</p>
                </div>
              )}
              {detailReservation.dietary_needs?.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Dietary Needs</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detailReservation.dietary_needs.map(d => (
                      <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {['pending', 'approved'].includes(detailReservation.status) && onCancel && (
              <Button
                variant="destructive"
                className="w-full rounded-xl"
                onClick={() => {
                  onCancel(detailReservation);
                  setDetailReservation(null);
                }}
              >
                Cancel Reservation
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
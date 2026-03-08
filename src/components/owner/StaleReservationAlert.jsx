import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Returns minutes past the reservation time (positive = overdue)
function minutesPast(reservation) {
  if (!reservation.reservation_date || !reservation.reservation_time) return 0;
  const [h, m] = reservation.reservation_time.split(':').map(Number);
  const resTime = new Date(reservation.reservation_date);
  resTime.setHours(h, m, 0, 0);
  return (Date.now() - resTime.getTime()) / 60000;
}

export default function StaleReservationAlert({ restaurantId }) {
  const queryClient = useQueryClient();

  const { data: reservations = [] } = useQuery({
    queryKey: ['staleReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    refetchInterval: 5000,
    select: (data) =>
      (Array.isArray(data) ? data : []).filter(
        (r) => r.status === 'approved' && minutesPast(r) > 20
      ),
  });

  const releaseMutation = useMutation({
    mutationFn: async (reservation) => {
      await base44.entities.Reservation.update(reservation.id, { status: 'cancelled' });
      if (reservation.table_id) {
        await base44.entities.Table.update(reservation.table_id, { status: 'free', party_name: null, party_size: null, seated_at: null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staleReservations', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      toast.success('Table released successfully.');
    },
  });

  if (!reservations.length) return null;

  return (
    <div className="mb-6 space-y-2">
      {reservations.map((res) => (
        <div
          key={res.id}
          className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800 truncate">
                {res.user_name || 'Guest'} — {res.reservation_time}
              </p>
              <p className="text-xs text-red-500">
                {Math.round(minutesPast(res))} min overdue · no check-in
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-red-500 text-white text-xs">STALE</Badge>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100 text-xs h-7"
              disabled={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate(res)}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Release Table
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
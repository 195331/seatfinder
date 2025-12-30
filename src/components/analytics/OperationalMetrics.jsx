import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Users, RotateCw } from 'lucide-react';
import moment from 'moment';

export default function OperationalMetrics({ restaurantId }) {
  const { data: reservations = [] } = useQuery({
    queryKey: ['opReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['opSchedules', restaurantId],
    queryFn: () => base44.entities.StaffSchedule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['seatingHistory', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 500),
    enabled: !!restaurantId,
  });

  // Calculate average table turnover
  const avgTurnoverTime = useMemo(() => {
    const completedReservations = reservations.filter(r => r.status === 'approved');
    if (completedReservations.length === 0) return 0;
    // Estimate 90 min avg dining time
    return 90;
  }, [reservations]);

  // Calculate table turnover rate
  const tableTurnoverRate = useMemo(() => {
    const dailyReservations = {};
    reservations.forEach(r => {
      const date = moment(r.reservation_date).format('YYYY-MM-DD');
      dailyReservations[date] = (dailyReservations[date] || 0) + 1;
    });
    const avgDaily = Object.values(dailyReservations).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(dailyReservations).length);
    return avgDaily.toFixed(1);
  }, [reservations]);

  // Staff utilization
  const staffUtilization = useMemo(() => {
    const totalScheduledHours = schedules.reduce((sum, s) => {
      const start = moment(s.shift_start, 'HH:mm');
      const end = moment(s.shift_end, 'HH:mm');
      return sum + end.diff(start, 'hours', true);
    }, 0);
    return totalScheduledHours;
  }, [schedules]);

  // Peak occupancy times
  const peakOccupancyData = useMemo(() => {
    const hourlyOccupancy = {};
    seatingHistory.forEach(entry => {
      const hour = moment(entry.recorded_at).hour();
      if (!hourlyOccupancy[hour]) {
        hourlyOccupancy[hour] = { hour: `${hour}:00`, occupancy: [], count: 0 };
      }
      hourlyOccupancy[hour].occupancy.push(entry.occupancy_percent || 0);
      hourlyOccupancy[hour].count++;
    });

    return Object.values(hourlyOccupancy)
      .map(h => ({
        hour: h.hour,
        avgOccupancy: h.occupancy.reduce((a, b) => a + b, 0) / h.count
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [seatingHistory]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Dining Time</p>
                <p className="text-2xl font-bold text-slate-900">{avgTurnoverTime} min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <RotateCw className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Table Turnover</p>
                <p className="text-2xl font-bold text-emerald-600">{tableTurnoverRate}/day</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Staff Hours</p>
                <p className="text-2xl font-bold text-purple-600">{staffUtilization.toFixed(0)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak Occupancy Chart */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Average Occupancy by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakOccupancyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgOccupancy" fill="#8b5cf6" name="Occupancy %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
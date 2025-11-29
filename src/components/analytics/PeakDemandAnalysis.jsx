import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from "@/lib/utils";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 9); // 9 AM to 11 PM

export default function PeakDemandAnalysis({ restaurantId }) {
  const [view, setView] = useState('daily');

  const { data: seatingHistory = [], isLoading } = useQuery({
    queryKey: ['peakDemand', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 500),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['peakReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'approved' }, '-created_date', 200),
    enabled: !!restaurantId,
  });

  // Process data for daily view
  const dailyData = DAYS.map((day, idx) => {
    const dayRecords = seatingHistory.filter(h => new Date(h.recorded_at).getDay() === idx);
    const avgOccupancy = dayRecords.length > 0
      ? dayRecords.reduce((sum, h) => sum + (h.occupancy_percent || 0), 0) / dayRecords.length
      : 0;
    const reservationCount = reservations.filter(r => new Date(r.reservation_date).getDay() === idx).length;
    
    return {
      day,
      occupancy: Math.round(avgOccupancy),
      reservations: reservationCount,
      isPeak: avgOccupancy > 70
    };
  });

  // Process data for hourly view
  const hourlyData = HOURS.map(hour => {
    const hourRecords = seatingHistory.filter(h => new Date(h.recorded_at).getHours() === hour);
    const avgOccupancy = hourRecords.length > 0
      ? hourRecords.reduce((sum, h) => sum + (h.occupancy_percent || 0), 0) / hourRecords.length
      : 0;
    
    return {
      hour: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`,
      occupancy: Math.round(avgOccupancy),
      isPeak: avgOccupancy > 70
    };
  });

  // Find peak times
  const peakDay = dailyData.reduce((max, d) => d.occupancy > max.occupancy ? d : max, dailyData[0]);
  const peakHour = hourlyData.reduce((max, h) => h.occupancy > max.occupancy ? h : max, hourlyData[0]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Peak Demand Analysis
          </CardTitle>
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-3">Daily</TabsTrigger>
              <TabsTrigger value="hourly" className="text-xs px-3">Hourly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Peak Indicators */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">Busiest Day</span>
            </div>
            <p className="text-lg font-bold text-emerald-900">{peakDay?.day}</p>
            <p className="text-xs text-emerald-600">{peakDay?.occupancy}% avg occupancy</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Peak Hour</span>
            </div>
            <p className="text-lg font-bold text-blue-900">{peakHour?.hour}</p>
            <p className="text-xs text-blue-600">{peakHour?.occupancy}% avg occupancy</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={view === 'daily' ? dailyData : hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey={view === 'daily' ? 'day' : 'hour'} 
                tick={{ fontSize: 11 }}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip 
                formatter={(value) => [`${value}%`, 'Occupancy']}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
                {(view === 'daily' ? dailyData : hourlyData).map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={entry.isPeak ? '#10b981' : '#94a3b8'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-600">
            <strong>💡 Insight:</strong> Your busiest times are {peakDay?.day}s around {peakHour?.hour}. 
            Consider adding extra staff during these peak periods for better service.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
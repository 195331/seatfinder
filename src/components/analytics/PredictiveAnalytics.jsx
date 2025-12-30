import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar, Users, Clock, AlertCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function PredictiveAnalytics({ restaurantId }) {
  const { data: seatingHistory = [], isLoading: loadingSeating } = useQuery({
    queryKey: ['seatingHistory', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ 
      restaurant_id: restaurantId 
    }, '-recorded_at', 500),
    enabled: !!restaurantId,
  });

  const { data: reservations = [], isLoading: loadingReservations } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurantId 
    }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const { data: waitlist = [], isLoading: loadingWaitlist } = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurantId 
    }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const isLoading = loadingSeating || loadingReservations || loadingWaitlist;

  // Calculate 30-day trends
  const last30Days = moment().subtract(30, 'days');
  const recentSeating = (seatingHistory || []).filter(s => moment(s?.recorded_at).isAfter(last30Days));
  const recentReservations = (reservations || []).filter(r => moment(r?.created_date).isAfter(last30Days));
  const recentWaitlist = (waitlist || []).filter(w => moment(w?.created_date).isAfter(last30Days));

  // Predict next 7 days demand
  const dayOfWeekDemand = {};
  (recentSeating || []).forEach(entry => {
    const day = moment(entry.recorded_at).day();
    if (!dayOfWeekDemand[day]) dayOfWeekDemand[day] = { sum: 0, count: 0 };
    dayOfWeekDemand[day].sum += entry.occupancy_percent || 0;
    dayOfWeekDemand[day].count += 1;
  });

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = moment().add(i, 'days');
    const dayOfWeek = date.day();
    const avgOccupancy = dayOfWeekDemand[dayOfWeek]?.count > 0
      ? dayOfWeekDemand[dayOfWeek].sum / dayOfWeekDemand[dayOfWeek].count
      : 50;
    
    return {
      date: date.format('ddd MMM D'),
      predicted: Math.round(avgOccupancy),
      confidence: dayOfWeekDemand[dayOfWeek]?.count >= 3 ? 'High' : 'Medium'
    };
  });

  // Waitlist conversion rate trend
  const waitlistByWeek = {};
  (recentWaitlist || []).forEach(entry => {
    const week = moment(entry.created_date).week();
    if (!waitlistByWeek[week]) {
      waitlistByWeek[week] = { total: 0, seated: 0 };
    }
    waitlistByWeek[week].total += 1;
    if (entry.status === 'seated') waitlistByWeek[week].seated += 1;
  });

  const conversionTrend = Object.keys(waitlistByWeek).map(week => ({
    week: `W${week}`,
    rate: Math.round((waitlistByWeek[week].seated / waitlistByWeek[week].total) * 100)
  }));

  // Table turnover analysis
  const turnoverByHour = {};
  (recentSeating || []).forEach(entry => {
    const hour = moment(entry.recorded_at).hour();
    if (!turnoverByHour[hour]) turnoverByHour[hour] = [];
    turnoverByHour[hour].push(entry.occupancy_percent || 0);
  });

  const optimalTurnoverHours = Object.keys(turnoverByHour)
    .map(hour => ({
      hour: parseInt(hour),
      avgOccupancy: turnoverByHour[hour].reduce((sum, v) => sum + v, 0) / turnoverByHour[hour].length
    }))
    .sort((a, b) => b.avgOccupancy - a.avgOccupancy)
    .slice(0, 3);

  if (isLoading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  if (recentSeating.length < 10) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Analytics</CardTitle>
          <CardDescription>Not enough data for predictions</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-500">Need at least 10 seating updates to generate predictions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Next 7 Days Demand Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            7-Day Demand Forecast
          </CardTitle>
          <CardDescription>Predicted occupancy based on historical patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={next7Days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis label={{ value: 'Occupancy %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="predicted" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-4">
            {(next7Days || []).map((day, i) => (
              <div key={i} className="text-center">
                <Badge variant={day.confidence === 'High' ? 'default' : 'secondary'} className="text-xs">
                  {day.confidence}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Conversion Trend */}
      {conversionTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Waitlist Conversion Trend
            </CardTitle>
            <CardDescription>Weekly conversion rate from waitlist to seated</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={conversionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis label={{ value: 'Conversion %', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Optimal Turnover Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Optimal Table Turnover Times
          </CardTitle>
          <CardDescription>Hours with highest occupancy - best for quick turnover</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(optimalTurnoverHours || []).map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                    #{i + 1}
                  </div>
                  <span className="font-medium text-slate-900">
                    {entry.hour % 12 || 12}:00 {entry.hour < 12 ? 'AM' : 'PM'}
                  </span>
                </div>
                <Badge className="bg-purple-100 text-purple-800">
                  {entry.avgOccupancy.toFixed(0)}% avg occupancy
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-4">
            💡 Focus on faster service during these hours to maximize capacity
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
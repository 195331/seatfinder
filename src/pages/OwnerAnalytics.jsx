import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, TrendingUp, Users, Star, Clock, BarChart3,
  Calendar, ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import moment from 'moment';
import { cn } from "@/lib/utils";

import ReservationTrendsChart from '@/components/analytics/ReservationTrendsChart';
import PeakTimeAnalysis from '@/components/analytics/PeakTimeAnalysis';
import PopularMenuItems from '@/components/analytics/PopularMenuItems';
import CustomerRetention from '@/components/analytics/CustomerRetention';

export default function OwnerAnalytics() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');
  const [timeFilter, setTimeFilter] = useState('last_7_days');

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date', 500),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }),
    enabled: !!restaurantId,
  });

  // Time filtering
  const getFilteredData = (data, dateField = 'created_date') => {
    const now = moment();
    return data.filter(item => {
      const itemDate = moment(item[dateField]);
      switch (timeFilter) {
        case 'today': return itemDate.isSame(now, 'day');
        case 'this_week': return itemDate.isSame(now, 'week');
        case 'last_7_days': return itemDate.isAfter(now.clone().subtract(7, 'days'));
        case 'last_30_days': return itemDate.isAfter(now.clone().subtract(30, 'days'));
        default: return true;
      }
    });
  };

  const filteredReservations = getFilteredData(reservations, 'reservation_date');
  const filteredWaitlist = getFilteredData(waitlistEntries);
  const filteredReviews = getFilteredData(reviews);

  // Key metrics
  const totalReservations = filteredReservations.length;
  const showUpRate = filteredReservations.length > 0
    ? (filteredReservations.filter(r => r.status === 'approved').length / filteredReservations.length * 100).toFixed(1)
    : 0;
  const avgPartySize = filteredReservations.length > 0
    ? (filteredReservations.reduce((sum, r) => sum + (r.party_size || 0), 0) / filteredReservations.length).toFixed(1)
    : 0;
  const waitlistConversion = filteredWaitlist.length > 0
    ? (filteredWaitlist.filter(w => w.status === 'seated').length / filteredWaitlist.length * 100).toFixed(1)
    : 0;
  const avgRating = filteredReviews.length > 0
    ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length).toFixed(1)
    : 0;

  // Reservation volume chart
  const volumeData = useMemo(() => {
    const grouped = {};
    filteredReservations.forEach(r => {
      const date = moment(r.reservation_date).format('MMM D');
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }, [filteredReservations]);

  // Party size distribution
  const partySizeData = useMemo(() => {
    const sizes = { '2': 0, '3-4': 0, '5-6': 0, '7+': 0 };
    filteredReservations.forEach(r => {
      const size = r.party_size || 0;
      if (size === 2) sizes['2']++;
      else if (size <= 4) sizes['3-4']++;
      else if (size <= 6) sizes['5-6']++;
      else sizes['7+']++;
    });
    return Object.entries(sizes).map(([size, count]) => ({ size, count }));
  }, [filteredReservations]);

  // Peak hours heatmap
  const peakHoursData = useMemo(() => {
    const hours = {};
    filteredReservations.forEach(r => {
      const hour = parseInt(r.reservation_time?.split(':')[0] || 0);
      hours[hour] = (hours[hour] || 0) + 1;
    });
    return Object.entries(hours)
      .map(([hour, count]) => ({ 
        hour: parseInt(hour) === 0 ? '12 AM' : parseInt(hour) < 12 ? `${hour} AM` : parseInt(hour) === 12 ? '12 PM' : `${parseInt(hour) - 12} PM`,
        count 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredReservations]);

  // Waitlist funnel
  const waitlistFunnel = {
    added: filteredWaitlist.length,
    notified: filteredWaitlist.filter(w => w.status !== 'waiting').length,
    confirmed: filteredWaitlist.filter(w => w.status === 'confirmed').length,
    seated: filteredWaitlist.filter(w => w.status === 'seated').length,
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl('OwnerDashboard') + `?id=${restaurantId}`)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg">Analytics</h1>
                <p className="text-sm text-slate-500">{restaurant?.name}</p>
              </div>
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Reservations</p>
              <p className="text-2xl font-bold text-slate-900">{totalReservations}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Show-up Rate</p>
              <p className="text-2xl font-bold text-emerald-600">{showUpRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Avg Party Size</p>
              <p className="text-2xl font-bold text-slate-900">{avgPartySize}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Waitlist Conversion</p>
              <p className="text-2xl font-bold text-blue-600">{waitlistConversion}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Avg Rating</p>
              <p className="text-2xl font-bold text-amber-500 flex items-center gap-1">
                <Star className="w-5 h-5 fill-current" />
                {avgRating}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reservation Trends - Enhanced */}
        <ReservationTrendsChart reservations={reservations} />

        {/* Peak Time Analysis */}
        <PeakTimeAnalysis reservations={filteredReservations} waitlistEntries={filteredWaitlist} />

        {/* Party Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Party Size Distribution</CardTitle>
            <p className="text-sm text-slate-500">How your guests group</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={partySizeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="size" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {partySizeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm text-slate-600 mt-4">
              💡 <strong>Insight:</strong> Parties of 2 make up the majority. Consider optimizing your 2-top tables.
            </p>
          </CardContent>
        </Card>

        {/* Popular Menu Items */}
        <PopularMenuItems restaurantId={restaurantId} />

        {/* Customer Retention */}
        <CustomerRetention reservations={reservations} />

        {/* Waitlist Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Waitlist Performance</CardTitle>
            <p className="text-sm text-slate-500">Track how efficiently you move guests through your waitlist</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-3xl font-bold text-slate-900">{waitlistFunnel.added}</p>
                <p className="text-sm text-slate-500 mt-1">Added</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{waitlistFunnel.notified}</p>
                <p className="text-sm text-slate-500 mt-1">Notified</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{waitlistFunnel.confirmed}</p>
                <p className="text-sm text-slate-500 mt-1">Confirmed</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{waitlistFunnel.seated}</p>
                <p className="text-sm text-slate-500 mt-1">Seated</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-4">
              💡 <strong>Insight:</strong> {waitlistConversion}% of your waitlist entries result in successful seating
            </p>
          </CardContent>
        </Card>

        {/* Reviews Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Reviews & Ratings</CardTitle>
            <p className="text-sm text-slate-500">What diners are saying</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-900">{avgRating}</p>
                  <div className="flex text-amber-400 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={cn("w-4 h-4", i < Math.round(avgRating) && "fill-current")} />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{filteredReviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = filteredReviews.filter(r => r.rating === rating).length;
                    const percent = filteredReviews.length > 0 ? (count / filteredReviews.length * 100) : 0;
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="text-sm w-8">{rating}★</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-sm text-slate-500 w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
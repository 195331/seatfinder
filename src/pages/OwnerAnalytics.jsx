import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Eye, MousePointerClick, Heart, Users, Phone, 
  Navigation, Globe, Calendar, TrendingUp, Clock, Award
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import moment from 'moment';
import { cn } from "@/lib/utils";
import PeakDemandAnalysis from '@/components/analytics/PeakDemandAnalysis';
import TableTurnoverTracker from '@/components/analytics/TableTurnoverTracker';
import CustomerLifetimeValue from '@/components/analytics/CustomerLifetimeValue';
import CompetitorBenchmark from '@/components/analytics/CompetitorBenchmark';
import LoyaltyAnalytics from '@/components/analytics/LoyaltyAnalytics';
import RevenueMetrics from '@/components/analytics/RevenueMetrics';
import TableHeatmap from '@/components/analytics/TableHeatmap';
import { TabsContent } from "@/components/ui/tabs";

export default function OwnerAnalytics() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');
  const [currentUser, setCurrentUser] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [analyticsTab, setAnalyticsTab] = useState('overview');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['analyticsEvents', restaurantId, dateRange],
    queryFn: () => base44.entities.AnalyticsEvent.filter({ 
      restaurant_id: restaurantId 
    }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['seatingHistory', restaurantId, dateRange],
    queryFn: () => base44.entities.SeatingHistory.filter({ 
      restaurant_id: restaurantId 
    }, '-recorded_at', 200),
    enabled: !!restaurantId,
  });

  // Filter events by date range
  const filteredEvents = useMemo(() => {
    const now = moment();
    const cutoff = dateRange === '7d' 
      ? now.clone().subtract(7, 'days')
      : dateRange === '30d'
        ? now.clone().subtract(30, 'days')
        : now.clone().subtract(1, 'day');
    
    return events.filter(e => moment(e.created_date).isAfter(cutoff));
  }, [events, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    const views = filteredEvents.filter(e => e.event_type === 'view').length;
    const calls = filteredEvents.filter(e => e.event_type === 'call_click').length;
    const directions = filteredEvents.filter(e => e.event_type === 'directions_click').length;
    const websites = filteredEvents.filter(e => e.event_type === 'website_click').length;
    const waitlistJoins = filteredEvents.filter(e => e.event_type === 'waitlist_join').length;
    const favorites = filteredEvents.filter(e => e.event_type === 'favorite_add').length;
    
    return { views, calls, directions, websites, waitlistJoins, favorites };
  }, [filteredEvents]);

  // Chart data - views over time
  const viewsChartData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 1;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const dayEvents = filteredEvents.filter(e => 
        moment(e.created_date).isSame(date, 'day')
      );
      
      data.push({
        date: date.format('MMM D'),
        views: dayEvents.filter(e => e.event_type === 'view').length,
        clicks: dayEvents.filter(e => 
          ['call_click', 'directions_click', 'website_click'].includes(e.event_type)
        ).length,
      });
    }
    
    return data;
  }, [filteredEvents, dateRange]);

  // Occupancy chart data
  const occupancyChartData = useMemo(() => {
    if (seatingHistory.length === 0) return [];
    
    // Group by hour
    const hourlyData = {};
    seatingHistory.forEach(h => {
      const hour = moment(h.recorded_at).format('HH:00');
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, count: 0 };
      }
      hourlyData[hour].total += h.occupancy_percent || 0;
      hourlyData[hour].count += 1;
    });

    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour,
        occupancy: Math.round(data.total / data.count)
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [seatingHistory]);

  // Event breakdown for pie/bar
  const eventBreakdown = useMemo(() => {
    return [
      { name: 'Calls', value: stats.calls, color: '#3b82f6' },
      { name: 'Directions', value: stats.directions, color: '#10b981' },
      { name: 'Website', value: stats.websites, color: '#8b5cf6' },
      { name: 'Waitlist', value: stats.waitlistJoins, color: '#f59e0b' },
    ];
  }, [stats]);

  if (!currentUser || loadingEvents) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Analytics</h1>
                <p className="text-sm text-slate-500">{restaurant?.name}</p>
              </div>
            </div>
            
            <Tabs value={dateRange} onValueChange={setDateRange}>
              <TabsList className="bg-slate-100">
                <TabsTrigger value="1d">Today</TabsTrigger>
                <TabsTrigger value="7d">7 Days</TabsTrigger>
                <TabsTrigger value="30d">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Analytics Tabs */}
        <Tabs value={analyticsTab} onValueChange={setAnalyticsTab}>
          <TabsList className="bg-white shadow-sm rounded-full p-1 mb-6">
            <TabsTrigger value="overview" className="rounded-full">Overview</TabsTrigger>
            <TabsTrigger value="advanced" className="rounded-full">Advanced</TabsTrigger>
            <TabsTrigger value="loyalty" className="rounded-full">Loyalty</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Revenue & Key Metrics */}
            <RevenueMetrics restaurantId={restaurantId} dateRange={dateRange} />

        {/* Engagement Stats Cards */}
        <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.views}</p>
                  <p className="text-sm text-slate-500">Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.calls}</p>
                  <p className="text-sm text-slate-500">Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.directions}</p>
                  <p className="text-sm text-slate-500">Directions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.websites}</p>
                  <p className="text-sm text-slate-500">Website</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.waitlistJoins}</p>
                  <p className="text-sm text-slate-500">Waitlist</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.favorites}</p>
                  <p className="text-sm text-slate-500">Favorites</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Views & Clicks Over Time */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Views & Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={viewsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Breakdown */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5" />
                Engagement Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={80} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {eventBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Occupancy Heatmap */}
          {occupancyChartData.length > 0 && (
            <Card className="border-0 shadow-lg lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Average Occupancy by Hour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: 'none', 
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value) => [`${value}%`, 'Occupancy']}
                      />
                      <Bar 
                        dataKey="occupancy" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TableHeatmap restaurantId={restaurantId} />
              <PeakDemandAnalysis restaurantId={restaurantId} />
              <TableTurnoverTracker restaurantId={restaurantId} />
              <CustomerLifetimeValue restaurantId={restaurantId} />
              <CompetitorBenchmark 
                restaurantId={restaurantId} 
                cityId={restaurant?.city_id}
                cuisine={restaurant?.cuisine}
              />
            </div>
          </TabsContent>

          <TabsContent value="loyalty">
            <LoyaltyAnalytics restaurantId={restaurantId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, TrendingUp, Users, Star, Clock, BarChart3,
  Calendar, ChevronDown, RefreshCw, Wifi, WifiOff, Zap,
  Crown, Lock
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, Legend
} from 'recharts';
import moment from 'moment';
import { cn } from "@/lib/utils";
import { useFeatureAccess } from '@/components/subscription/SubscriptionPlans';
import confetti from 'canvas-confetti';

import ReservationTrendsChart from '@/components/analytics/ReservationTrendsChart';
import PeakTimeAnalysis from '@/components/analytics/PeakTimeAnalysis';
import PopularMenuItems from '@/components/analytics/PopularMenuItems';
import CustomerRetention from '@/components/analytics/CustomerRetention';
import FinancialPerformance from '@/components/analytics/FinancialPerformance';
import OperationalMetrics from '@/components/analytics/OperationalMetrics';
import LoyaltyAnalytics from '@/components/analytics/LoyaltyAnalytics';
import LiveFeed from '@/components/commandcenter/LiveFeed';
import AnalyticsCustomerIntel from '@/components/analytics/AnalyticsCustomerIntel.jsx';

// ─── Shared data loader (same as CommandCenter) ──────────────────────────────
const getCacheKey = (restaurantId) => `supa_hub_cache_${restaurantId}`;

async function getSuperHubContext(restaurantId) {
  const [restaurant, waitlist, reservations, seatingHistory, reviews] = await Promise.all([
    base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0] || null),
    base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId, status: 'waiting' }),
    base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'approved' }, '-created_date', 100),
    base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 48),
    base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }, '-created_date', 10),
  ]);

  const totalSeats = restaurant?.total_seats || 0;
  const availableSeats = restaurant?.available_seats || 0;
  const occupiedSeats = Math.max(0, totalSeats - availableSeats);
  const activeWaiting = waitlist.length;
  const currentWaitTime = activeWaiting * 8;

  const now = moment();
  const todayStr = now.format('YYYY-MM-DD');
  const activeReservations = reservations.filter(r => r.reservation_date === todayStr);

  const next6Hours = [];
  for (let i = 0; i < 6; i++) {
    const h = moment().add(i, 'hours');
    const confirmedCount = activeReservations.filter(r => {
      const rHour = parseInt(r.reservation_time?.split(':')[0] || 0);
      return rHour === h.hour();
    }).length;
    const histPattern = seatingHistory.find(s => {
      const sh = moment(s.recorded_at);
      return sh.day() === h.day() && sh.hour() === h.hour();
    });
    const basePct = histPattern?.occupancy_percent || (50 + Math.sin(i) * 15);
    next6Hours.push({
      hour: h.format('h:mm A'),
      predictedOccupancy: Math.min(100, Math.round(basePct + confirmedCount * 4)),
      confirmedBookings: confirmedCount,
    });
  }

  const sentimentScore = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + (r.rating / 5) * 100, 0) / reviews.length)
    : 50;

  const ctx = {
    live_stats: {
      total_seats: totalSeats,
      occupied_seats: occupiedSeats,
      current_wait_time: currentWaitTime,
      active_reservations: activeReservations.length,
    },
    forecast: {
      next_6_hours_predicted_occupancy: next6Hours,
      known_reservation_spikes: next6Hours
        .filter(h => h.confirmedBookings >= 3)
        .map(h => `${h.hour}: ${h.confirmedBookings} bookings`),
    },
    feedback: { latest_10_reviews: reviews.map(r => ({ rating: r.rating, comment: r.comment?.slice(0, 120) })), sentimentScore },
    // expose raw data for analytics section
    _restaurant: restaurant,
    _waitlist: waitlist,
    _reservations: reservations,
  };

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...ctx, _cached_at: Date.now() })); } catch (_) {}
  return ctx;
}

// ─── Command Center sub-components ───────────────────────────────────────────

function PulseIndicator() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

function KPICard({ label, value, sub, color = 'indigo' }) {
  const glows = {
    indigo: 'border-indigo-500/40 shadow-indigo-500/10 text-indigo-400',
    emerald: 'border-emerald-500/40 shadow-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/40 shadow-amber-500/10 text-amber-400',
    rose: 'border-rose-500/40 shadow-rose-500/10 text-rose-400',
  };
  return (
    <div className={`rounded-xl border bg-[#0d0d0d]/80 backdrop-blur-sm p-5 flex flex-col gap-1 shadow-lg ${glows[color]}`}>
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-4xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ManagerBriefing({ ctx, restaurantId }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateBriefing = useCallback(async () => {
    if (!ctx || !restaurantId) return;
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI restaurant operations manager. Based on this live data, write exactly 3 concise, specific, actionable bullet points for the manager's briefing:

Live stats: ${JSON.stringify(ctx.live_stats)}
Forecast: ${JSON.stringify(ctx.forecast)}
Sentiment score: ${ctx.feedback.sentimentScore}%
Known spikes: ${ctx.forecast.known_reservation_spikes.join(', ') || 'none'}

Format: Return JSON with keys: bullet1, bullet2, bullet3. Each is a single sentence starting with a category label like "Pacing Alert:", "Sentiment:", "Revenue Op:", etc.`,
        response_json_schema: {
          type: 'object',
          properties: { bullet1: { type: 'string' }, bullet2: { type: 'string' }, bullet3: { type: 'string' } },
        },
      });
      setBriefing(result);
    } catch (_) {
      setBriefing({
        bullet1: 'Pacing Alert: Monitor wait times closely during peak hours.',
        bullet2: `Sentiment: Current guest satisfaction is at ${ctx.feedback.sentimentScore}%.`,
        bullet3: `Capacity: ${ctx.live_stats.active_reservations} reservations active today.`,
      });
    }
    setLoading(false);
  }, [ctx, restaurantId]);

  useEffect(() => { generateBriefing(); }, [generateBriefing]);

  return (
    <div className="rounded-xl border border-[#333] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Manager's Briefing</h3>
        </div>
        <button onClick={generateBriefing} disabled={loading} className="text-slate-500 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        </div>
      ) : briefing ? (
        <ul className="space-y-3 flex-1">
          {[briefing.bullet1, briefing.bullet2, briefing.bullet3].filter(Boolean).map((b, i) => {
            const colonIdx = b.indexOf(':');
            const label = colonIdx > -1 ? b.slice(0, colonIdx + 1) : '';
            const rest = colonIdx > -1 ? b.slice(colonIdx + 1) : b;
            return (
              <li key={i} className="flex gap-2 text-sm leading-snug">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>
                  {label && <span className="text-amber-400 font-semibold">{label}</span>}
                  <span className="text-slate-300">{rest}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function FlowChart({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(v, n) => [n === 'predictedOccupancy' ? `${v}%` : v, n === 'predictedOccupancy' ? 'Predicted Flow' : 'Confirmed Bookings']}
          />
          <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
          <Area type="monotone" dataKey="predictedOccupancy" stroke="#6366f1" fill="url(#flowGrad)" strokeWidth={2} dot={false} />
          <Bar dataKey="confirmedBookings" fill="#f59e0b" opacity={0.8} radius={[3, 3, 0, 0]} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Parallax food icons that drift upward on scroll ─────────────────────────
const FOOD_ICONS = ['🍕', '🍜', '🥗', '🍣', '🥂', '🍷', '🍔', '🌮', '🥩', '🍰'];

function ParallaxFoodLayer({ scrollY }) {
  const items = useMemo(() =>
    FOOD_ICONS.map((icon, i) => ({
      icon,
      x: 5 + (i * 9.3) % 90,
      baseY: 10 + (i * 17) % 80,
      speed: 0.15 + (i % 5) * 0.08,
      size: 18 + (i % 4) * 8,
      opacity: 0.06 + (i % 3) * 0.04,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {items.map((item, i) => (
        <span
          key={i}
          className="absolute select-none transition-none"
          style={{
            left: `${item.x}%`,
            top: `${item.baseY}%`,
            fontSize: item.size,
            opacity: item.opacity,
            transform: `translateY(${-scrollY * item.speed}px)`,
            willChange: 'transform',
          }}
        >
          {item.icon}
        </span>
      ))}
    </div>
  );
}

// ─── Deep Analytics Lock overlay for free tier ───────────────────────────────
function AnalyticsLock({ restaurantId }) {
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const existing = await base44.entities.Subscription.filter({ restaurant_id: restaurantId });
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (existing.length > 0) {
        await base44.entities.Subscription.update(existing[0].id, { plan: 'pro', status: 'active', current_period_end: expiry });
      } else {
        await base44.entities.Subscription.create({ restaurant_id: restaurantId, plan: 'pro', status: 'active', current_period_end: expiry });
      }
      await base44.entities.Restaurant.update(restaurantId, { subscription_plan: 'pro', subscription_expires_at: expiry });
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } catch (e) { console.error(e); }
    setUpgrading(false);
  };

  return (
    <div className="relative min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-6">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/70 to-slate-50 backdrop-blur-[2px]" />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
          <Lock className="w-6 h-6 text-black" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Deep Analytics is a Pro Feature</h3>
        <p className="text-slate-500 text-sm">Unlock full charts, financial performance, loyalty analytics, and operational metrics.</p>
        <button
          onClick={handleUpgrade}
          disabled={upgrading}
          className="px-6 py-2.5 rounded-full font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-lg transition-all flex items-center gap-2 text-sm"
        >
          {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
          {upgrading ? 'Activating...' : 'Upgrade to Pro'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OwnerAnalytics() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');

  const [timeFilter, setTimeFilter] = useState('last_7_days');
  const [ctx, setCtx] = useState(null);
  const [offline, setOffline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [scrollY, setScrollY] = useState(0);

  const commandRef = useRef(null);
  const analyticsRef = useRef(null);

  const featureAccess = useFeatureAccess(restaurantId);
  const isPro = featureAccess?.isPro || featureAccess?.isPlus || true; // keep bypass for preview

  // Track scroll for parallax
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load shared context
  const loadContext = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await getSuperHubContext(restaurantId);
      setCtx(data);
      setOffline(false);
      setLastRefreshed(new Date());
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached) { setCtx(cached); setOffline(true); }
      } catch (_) {}
    }
  }, [restaurantId]);

  useEffect(() => { loadContext(); }, [loadContext]);
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(loadContext, 60_000);
    return () => clearInterval(interval);
  }, [restaurantId, loadContext]);

  // Analytics data queries
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
    ? (filteredReservations.filter(r => r.status === 'approved').length / filteredReservations.length * 100).toFixed(1) : 0;
  const avgPartySize = filteredReservations.length > 0
    ? (filteredReservations.reduce((sum, r) => sum + (r.party_size || 0), 0) / filteredReservations.length).toFixed(1) : 0;
  const waitlistConversion = filteredWaitlist.length > 0
    ? (filteredWaitlist.filter(w => w.status === 'seated').length / filteredWaitlist.length * 100).toFixed(1) : 0;
  const avgRating = filteredReviews.length > 0
    ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length).toFixed(1) : 0;

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

  const waitlistFunnel = {
    added: filteredWaitlist.length,
    notified: filteredWaitlist.filter(w => w.status !== 'waiting').length,
    confirmed: filteredWaitlist.filter(w => w.status === 'confirmed').length,
    seated: filteredWaitlist.filter(w => w.status === 'seated').length,
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  const scrollToAnalytics = () => {
    analyticsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sentimentScore = ctx?.feedback?.sentimentScore ?? 50;

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans">

      {/* ── SECTION 1: AI Command Center (100vh) ── */}
      <section ref={commandRef} className="relative min-h-screen flex flex-col overflow-hidden">
        <ParallaxFoodLayer scrollY={scrollY} />

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#080808]/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('OwnerDashboard') + `?id=${restaurantId}`)}>
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </Button>
              <div className="flex items-center gap-2">
                <PulseIndicator />
                <span className="text-xs text-emerald-400 font-medium tracking-wide uppercase">System Status: Active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {offline ? (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1 rounded-full">
                  <WifiOff className="w-3 h-3" /> Working Offline
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Wifi className="w-3 h-3" />
                  {lastRefreshed ? `Updated ${moment(lastRefreshed).fromNow()}` : 'Live'}
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-slate-600 uppercase tracking-widest">Live Wait</p>
                <p className="text-2xl font-black text-white leading-none">
                  {ctx ? `${ctx.live_stats.current_wait_time}m` : '—'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Command Center content */}
        <div className="flex-1 max-w-7xl mx-auto px-4 py-6 space-y-6 w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">AI Command Center</h1>
              <p className="text-slate-500 text-sm mt-0.5">Mission control · {restaurant?.name}</p>
            </div>
            <button
              onClick={loadContext}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors border border-[#222] rounded-full px-3 py-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {!ctx ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-slate-500 text-sm">Loading mission data...</p>
            </div>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard label="Total Seats" value={ctx.live_stats.total_seats || '—'} sub="Restaurant capacity" color="indigo" />
                <KPICard label="Occupied" value={ctx.live_stats.occupied_seats || '0'} sub={`${ctx.live_stats.total_seats ? Math.round((ctx.live_stats.occupied_seats / ctx.live_stats.total_seats) * 100) : 0}% full`} color="rose" />
                <KPICard label="Wait Time" value={`${ctx.live_stats.current_wait_time}m`} sub={`${ctx.forecast.next_6_hours_predicted_occupancy[0]?.confirmedBookings || 0} waiting`} color="amber" />
                <KPICard label="Reservations" value={ctx.live_stats.active_reservations || '0'} sub="Today's confirmed" color="emerald" />
              </div>

              {/* Flow Graph + Briefing */}
              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 rounded-xl border border-[#222] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-bold text-white text-sm uppercase tracking-wider">Flow Graph — Next 6 Hours</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Area = Predicted Flow · Bars = Confirmed Bookings</p>
                    </div>
                    {ctx.forecast.known_reservation_spikes.length > 0 && (
                      <div className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-1 rounded-full">⚠ Spike</div>
                    )}
                  </div>
                  <FlowChart data={ctx.forecast.next_6_hours_predicted_occupancy} />
                  {ctx.forecast.known_reservation_spikes.length > 0 && (
                    <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                      <p className="text-xs text-rose-400 font-medium mb-1">⚠ Booking Spikes</p>
                      {ctx.forecast.known_reservation_spikes.map((s, i) => (
                        <p key={i} className="text-xs text-slate-400">• {s}</p>
                      ))}
                    </div>
                  )}
                </div>
                <ManagerBriefing ctx={ctx} restaurantId={restaurantId} />
              </div>

              {/* Sentiment Bar */}
              <div className="rounded-xl border border-[#222] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 p-5 flex items-center gap-6">
                <div className="shrink-0">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Guest Sentiment</p>
                  <p className="text-3xl font-black text-white">{sentimentScore}%</p>
                </div>
                <div className="flex-1 bg-[#1a1a1a] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${sentimentScore}%`,
                      background: sentimentScore >= 70
                        ? 'linear-gradient(90deg,#10b981,#34d399)'
                        : sentimentScore >= 40
                        ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                        : 'linear-gradient(90deg,#ef4444,#f87171)',
                    }}
                  />
                </div>
                <p className="shrink-0 text-xs text-slate-500">
                  {sentimentScore >= 70 ? '😊 Positive' : sentimentScore >= 40 ? '😐 Neutral' : '😟 Needs attention'}
                </p>
              </div>

              {/* Live Feed */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Activity</h2>
                </div>
                <LiveFeed restaurantId={restaurantId} />
              </div>
            </>
          )}
        </div>

        {/* ── View Full Analytics CTA ── */}
        <div className="relative z-10 flex flex-col items-center pb-10 pt-4">
          <button
            onClick={scrollToAnalytics}
            className="group flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <span className="text-xs uppercase tracking-widest font-semibold">View Full Analytics</span>
            <span className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent group-hover:from-white transition-colors" />
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </button>
        </div>
      </section>

      {/* ── SECTION 2: Deep Analytics ── */}
      <section ref={analyticsRef} className="relative bg-slate-50 text-slate-900 min-h-screen">
        {/* Gradient fade from dark to light */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#080808] to-slate-50 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 pt-20 pb-24 space-y-6">
          {/* Analytics Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Deep Analytics</h2>
              <p className="text-slate-500 text-sm mt-0.5">Detailed performance charts · {restaurant?.name}</p>
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

          {!isPro ? (
            <AnalyticsLock restaurantId={restaurantId} />
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Total Reservations</p><p className="text-2xl font-bold text-slate-900">{totalReservations}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Show-up Rate</p><p className="text-2xl font-bold text-emerald-600">{showUpRate}%</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Avg Party Size</p><p className="text-2xl font-bold text-slate-900">{avgPartySize}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Waitlist Conv.</p><p className="text-2xl font-bold text-blue-600">{waitlistConversion}%</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Avg Rating</p><p className="text-2xl font-bold text-amber-500 flex items-center gap-1"><Star className="w-5 h-5 fill-current" />{avgRating}</p></CardContent></Card>
              </div>

              <ReservationTrendsChart reservations={reservations} />
              <PeakTimeAnalysis reservations={filteredReservations} waitlistEntries={filteredWaitlist} />

              {/* Party Size Distribution */}
              <Card>
                <CardHeader><CardTitle>Party Size Distribution</CardTitle><p className="text-sm text-slate-500">How your guests group</p></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={partySizeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="size" /><YAxis />
                      <Tooltip />
                      <Bar dataKey="count">
                        {partySizeData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <PopularMenuItems restaurantId={restaurantId} />
              <CustomerRetention reservations={reservations} />

              {/* Waitlist Performance */}
              <Card>
                <CardHeader><CardTitle>Waitlist Performance</CardTitle><p className="text-sm text-slate-500">Track how efficiently you move guests</p></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg"><p className="text-3xl font-bold">{waitlistFunnel.added}</p><p className="text-sm text-slate-500 mt-1">Added</p></div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg"><p className="text-3xl font-bold text-blue-600">{waitlistFunnel.notified}</p><p className="text-sm text-slate-500 mt-1">Notified</p></div>
                    <div className="text-center p-4 bg-emerald-50 rounded-lg"><p className="text-3xl font-bold text-emerald-600">{waitlistFunnel.confirmed}</p><p className="text-sm text-slate-500 mt-1">Confirmed</p></div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg"><p className="text-3xl font-bold text-amber-600">{waitlistFunnel.seated}</p><p className="text-sm text-slate-500 mt-1">Seated</p></div>
                  </div>
                </CardContent>
              </Card>

              <FinancialPerformance restaurantId={restaurantId} />
              <OperationalMetrics restaurantId={restaurantId} />
              <LoyaltyAnalytics restaurantId={restaurantId} />

              {/* Customer Intelligence */}
              <AnalyticsCustomerIntel restaurantId={restaurantId} />

              {/* Reviews & Ratings */}
              <Card>
                <CardHeader><CardTitle>Reviews & Ratings</CardTitle><p className="text-sm text-slate-500">What diners are saying</p></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold">{avgRating}</p>
                      <div className="flex text-amber-400 mt-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className={cn("w-4 h-4", i < Math.round(avgRating) && "fill-current")} />)}
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
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Loader2, Crown, ArrowLeft, RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureAccess } from '@/components/subscription/SubscriptionPlans';
import confetti from 'canvas-confetti';
import LiveFeed from '@/components/commandcenter/LiveFeed';
import CustomerIntelPanel from '@/components/commandcenter/CustomerIntelPanel';

const CACHE_KEY = 'supa_hub_cache';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getSuperHubContext(restaurantId) {
  const [restaurant, waitlist, reservations, seatingHistory, reviews] = await Promise.all([
    base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0] || null),
    base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId, status: 'waiting' }),
    base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'approved' }, '-created_date', 100),
    base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 48),
    base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }, '-created_date', 10),
  ]);

  // Detect large-party reservations (> 6 guests) that need table combining
  const todayStr = moment().format('YYYY-MM-DD');
  const largePartyAlerts = reservations
    .filter(r => r.reservation_date === todayStr && r.party_size > 6 && !r.combined_table_ids?.length)
    .map(r => `${r.user_name || 'Guest'} — ${r.party_size} guests at ${r.reservation_time}`);

  const totalSeats = restaurant?.total_seats || 0;
  const availableSeats = restaurant?.available_seats || 0;
  const occupiedSeats = Math.max(0, totalSeats - availableSeats);
  const activeWaiting = waitlist.length;
  const avgWaitPerParty = 8;
  const currentWaitTime = activeWaiting * avgWaitPerParty;

  const now = moment();
  const todayStr = now.format('YYYY-MM-DD');
  const activeReservations = reservations.filter(r => r.reservation_date === todayStr);

  // Build 6-hour forecast buckets
  const next6Hours = [];
  for (let i = 0; i < 6; i++) {
    const h = moment().add(i, 'hours');
    const label = h.format('h:mm A');
    const confirmedCount = activeReservations.filter(r => {
      const rHour = parseInt(r.reservation_time?.split(':')[0] || 0);
      return rHour === h.hour();
    }).length;
    // Use seating history pattern for that hour
    const histPattern = seatingHistory.find(s => {
      const sh = moment(s.recorded_at);
      return sh.day() === h.day() && sh.hour() === h.hour();
    });
    const basePct = histPattern?.occupancy_percent || (50 + Math.sin(i) * 15);
    next6Hours.push({
      hour: label,
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
    feedback: {
      latest_10_reviews: reviews.map(r => ({ rating: r.rating, comment: r.comment?.slice(0, 120) })),
      sentiment_score: sentimentScore,
    },
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...ctx, _cached_at: Date.now() }));
  } catch (_) {}

  return ctx;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
Sentiment score: ${ctx.feedback.sentiment_score}%
Known spikes: ${ctx.forecast.known_reservation_spikes.join(', ') || 'none'}

Format: Return JSON with keys: bullet1, bullet2, bullet3. Each is a single sentence starting with a category label like "Pacing Alert:", "Sentiment:", "Revenue Op:", "Capacity:", "Staffing:", etc.`,
        response_json_schema: {
          type: 'object',
          properties: {
            bullet1: { type: 'string' },
            bullet2: { type: 'string' },
            bullet3: { type: 'string' },
          },
        },
      });
      setBriefing(result);
    } catch (_) {
      setBriefing({
        bullet1: 'Pacing Alert: Monitor wait times closely during peak hours.',
        bullet2: `Sentiment: Current guest satisfaction is at ${ctx.feedback.sentiment_score}%.`,
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
          <Area type="monotone" dataKey="predictedOccupancy" name="predictedOccupancy" stroke="#6366f1" fill="url(#flowGrad)" strokeWidth={2} dot={false} />
          <Bar dataKey="confirmedBookings" name="confirmedBookings" fill="#f59e0b" opacity={0.8} radius={[3, 3, 0, 0]} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlusPaywall({ restaurantId }) {
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!restaurantId) return;
    setUpgrading(true);
    try {
      const existingSub = await base44.entities.Subscription.filter({ restaurant_id: restaurantId });
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (existingSub.length > 0) {
        await base44.entities.Subscription.update(existingSub[0].id, { plan: 'plus', status: 'active', current_period_end: expiry });
      } else {
        await base44.entities.Subscription.create({ restaurant_id: restaurantId, plan: 'plus', status: 'active', current_period_end: expiry });
      }
      await base44.entities.Restaurant.update(restaurantId, { subscription_plan: 'plus', subscription_expires_at: expiry });
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      await queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] });

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } }), 300);
      setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } }), 500);
    } catch (e) {
      console.error(e);
    }
    setUpgrading(false);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#333] bg-[#0a0a0a] min-h-[500px] flex flex-col items-center justify-center">
      {/* Blurred ghost preview */}
      <div className="absolute inset-0 pointer-events-none select-none blur-sm opacity-30 p-6 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-4">
          {['Total Seats', 'Occupied', 'Wait Time', 'Reservations'].map(l => (
            <div key={l} className="rounded-xl border border-[#333] bg-[#111] p-4">
              <p className="text-xs text-slate-500">{l}</p>
              <p className="text-4xl font-black text-white">—</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#333] bg-[#0d0d0d] p-6 h-48" />
        <div className="rounded-xl border border-[#333] bg-[#0d0d0d] p-6 h-24" />
      </div>

      {/* Gate overlay */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-900/40">
          <Crown className="w-8 h-8 text-black" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">AI Command Center</h2>
          <p className="text-slate-400 mt-2">Real-time flow intelligence, occupancy forecasting, and AI-generated briefings — exclusively for Plus tier.</p>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={upgrading}
          className="px-8 py-3 rounded-full font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2 text-sm uppercase tracking-wide"
        >
          {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
          {upgrading ? 'Activating Plus...' : 'Unlock The AI Command Center (Plus Tier)'}
        </button>
        <p className="text-xs text-slate-600">Instant activation. No credit card required.</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [offline, setOffline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Auth
  useEffect(() => {
    base44.auth.isAuthenticated().then(isAuth => {
      if (!isAuth) navigate(createPageUrl('Home'));
    });
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('restaurant_id') || params.get('id');
    if (rid) setRestaurantId(rid);
  }, [navigate]);

  // Auto-detect restaurant if not in URL
  useQuery({
    queryKey: ['ccRestaurant'],
    queryFn: async () => {
      if (restaurantId) return null;
      const user = await base44.auth.me();
      const owned = await base44.entities.Restaurant.filter({ owner_id: user.id });
      if (owned[0]) setRestaurantId(owned[0].id);
      return null;
    },
    enabled: !restaurantId,
  });

  const featureAccess = useFeatureAccess(restaurantId);

  const loadContext = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await getSuperHubContext(restaurantId);
      setCtx(data);
      setOffline(false);
      setLastRefreshed(new Date());
    } catch (e) {
      // Offline fallback
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached) { setCtx(cached); setOffline(true); }
      } catch (_) {}
    }
  }, [restaurantId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  // Auto-refresh every 60 seconds + cache
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(loadContext, 60_000);
    return () => clearInterval(interval);
  }, [restaurantId, loadContext]);

  // Temporarily allow all access for preview — re-enable gate when ready
  const isPlus = true; // featureAccess?.isPlus;

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#080808]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('OwnerDashboard')}>
              <button className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <PulseIndicator />
              <span className="text-xs text-emerald-400 font-medium tracking-wide uppercase">System Status: Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {offline ? (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1 rounded-full">
                <WifiOff className="w-3 h-3" />
                Working Offline: Displaying Cached Insights
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Wifi className="w-3 h-3" />
                {lastRefreshed ? `Updated ${moment(lastRefreshed).fromNow()}` : 'Live'}
              </div>
            )}

            <div className="text-right">
              <p className="text-xs text-slate-600 uppercase tracking-widest">Live Wait Time</p>
              <p className="text-2xl font-black text-white leading-none">
                {ctx ? `${ctx.live_stats.current_wait_time} MINS` : '—'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">AI Command Center</h1>
            <p className="text-slate-500 text-sm mt-0.5">Mission control for your restaurant operations</p>
          </div>
          {isPlus && (
            <button
              onClick={loadContext}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors border border-[#222] rounded-full px-3 py-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          )}
        </div>

        {/* Paywall or content */}
        {!isPlus ? (
          <PlusPaywall restaurantId={restaurantId} />
        ) : !ctx ? (
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
              <KPICard label="Wait Time" value={`${ctx.live_stats.current_wait_time}m`} sub={`${ctx.forecast.next_6_hours_predicted_occupancy[0]?.confirmedBookings || 0} currently waiting`} color="amber" />
              <KPICard label="Active Reservations" value={ctx.live_stats.active_reservations || '0'} sub="Today's confirmed" color="emerald" />
            </div>

            {/* Main Stage + Sidebar */}
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Flow Graph (2/3) */}
              <div className="lg:col-span-2 rounded-xl border border-[#222] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-bold text-white text-sm uppercase tracking-wider">Flow Graph — Next 6 Hours</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Area = Predicted Flow · Bars = Confirmed Bookings</p>
                  </div>
                  {ctx.forecast.known_reservation_spikes.length > 0 && (
                    <div className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-1 rounded-full">
                      ⚠ Spike detected
                    </div>
                  )}
                </div>
                <FlowChart data={ctx.forecast.next_6_hours_predicted_occupancy} />

                {ctx.forecast.known_reservation_spikes.length > 0 && (
                  <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                    <p className="text-xs text-rose-400 font-medium mb-1">⚠ Booking Spikes Detected</p>
                    {ctx.forecast.known_reservation_spikes.map((s, i) => (
                      <p key={i} className="text-xs text-slate-400">• {s}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager's Briefing (1/3) */}
              <ManagerBriefing ctx={ctx} restaurantId={restaurantId} />
            </div>

            {/* Sentiment Bar */}
            <div className="rounded-xl border border-[#222] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 p-5 flex items-center gap-6">
              <div className="shrink-0">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Guest Sentiment</p>
                <p className="text-3xl font-black text-white">{ctx.feedback.sentiment_score}%</p>
              </div>
              <div className="flex-1 bg-[#1a1a1a] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${ctx.feedback.sentiment_score}%`,
                    background: ctx.feedback.sentiment_score >= 70
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : ctx.feedback.sentiment_score >= 40
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>
              <p className="shrink-0 text-xs text-slate-500">
                {ctx.feedback.sentiment_score >= 70 ? '😊 Positive' : ctx.feedback.sentiment_score >= 40 ? '😐 Neutral' : '😟 Needs attention'}
              </p>
            </div>

            {/* Bottom Section: Customer Intel + Live Feed */}
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                {/* Section header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-indigo-500" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Customer Intelligence</h2>
                </div>
                <CustomerIntelPanel restaurantId={restaurantId} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Activity</h2>
                </div>
                <LiveFeed restaurantId={restaurantId} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
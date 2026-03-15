import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Minus, Plus, AlertCircle, Users, Clock, TrendingUp,
  Bell, RefreshCw, CheckCircle, WifiOff, Lock, Unlock, Database, ArrowRightLeft
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SeatingBar from "@/components/ui/SeatingBar";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import { cn } from "@/lib/utils";
import moment from 'moment';

// ─── localStorage helpers ─────────────────────────────────────────────────────
const CACHE_KEY = (id) => `seatcache_${id}`;

function saveToCache(restaurant) {
  try {
    localStorage.setItem(CACHE_KEY(restaurant.id), JSON.stringify({
      available_seats: restaurant.available_seats,
      total_seats: restaurant.total_seats,
      is_full: restaurant.is_full,
      manual_override_active: restaurant.manual_override_active,
      manual_adjustment_offset: restaurant.manual_adjustment_offset,
      seating_updated_at: restaurant.seating_updated_at,
      cachedAt: new Date().toISOString(),
    }));
  } catch {}
}

function loadFromCache(restaurantId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(restaurantId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SeatingControlEnhanced({
  restaurant,
  onSeatingChange,
  onFullToggle,
  isUpdating,
  waitlist = []
}) {
  const queryClient = useQueryClient();

  // ── Offline mode ──────────────────────────────────────────────────────────
  const [offlineMode, setOfflineMode] = useState(false);
  const [cachedData, setCachedData] = useState(null);
  // When offline, track local seat count for manual adjustments
  const [localOfflineSeats, setLocalOfflineSeats] = useState(null);

  // Real-time restaurant data (live synced via subscription)
  const [liveRestaurant, setLiveRestaurant] = useState(null);

  // Subscribe to real-time restaurant updates
  useEffect(() => {
    if (!restaurant?.id) return;
    const unsubscribe = base44.entities.Restaurant.subscribe((event) => {
      if (event.id !== restaurant.id) return;
      if (event.type === 'update' && event.data) {
        setLiveRestaurant(event.data);
        // When we receive a live update, we're definitely online
        setOfflineMode(false);
        saveToCache(event.data);
      }
    });
    return unsubscribe;
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const cache = loadFromCache(restaurant.id);
    setCachedData(cache);
    // Detect offline: no total_seats in live data but have cache
    const seemsOffline = !restaurant.total_seats && cache;
    if (seemsOffline) {
      setOfflineMode(true);
      setLocalOfflineSeats(cache.available_seats ?? 0);
    }
  }, [restaurant?.id]);

  // Persist cache whenever restaurant prop has valid data
  useEffect(() => {
    if (restaurant?.id && restaurant.total_seats > 0) {
      saveToCache(restaurant);
      setOfflineMode(false);
    }
  }, [
    restaurant?.id,
    restaurant?.available_seats,
    restaurant?.total_seats,
    restaurant?.is_full,
    restaurant?.manual_override_active,
    restaurant?.manual_adjustment_offset,
    restaurant?.seating_updated_at,
  ]);

  // Merge: liveRestaurant (real-time) > restaurant (prop) > cache (offline)
  const data = offlineMode && cachedData
    ? { ...restaurant, ...cachedData }
    : (liveRestaurant ?? restaurant);

  // ── Auto-calculated available seats from approved/checked-in reservations ──
  const { data: confirmedReservations = [] } = useQuery({
    queryKey: ['confirmedReservations', restaurant?.id],
    queryFn: () => base44.entities.Reservation.filter({
      restaurant_id: restaurant.id,
      reservation_date: moment().format('YYYY-MM-DD'),
    }),
    enabled: !!restaurant?.id && !offlineMode,
    refetchInterval: 15000,
    select: (res) => res.filter(r => ['approved', 'checked_in'].includes(r.status)),
  });

  // Seats committed by confirmed + checked-in reservations
  const reservationOccupiedSeats = confirmedReservations.reduce(
    (sum, r) => sum + (r.party_size || 0), 0
  );

  // Auto-calculated available = total - committed (only when override is OFF)
  const autoAvailable = data?.manual_override_active
    ? null
    : Math.max(0, Math.min(
        data?.total_seats || 0,
        (data?.total_seats || 0) - reservationOccupiedSeats + (data?.manual_adjustment_offset || 0)
      ));

  // Displayed available seats — in offline mode use local value
  const displayAvailable = offlineMode
    ? (localOfflineSeats ?? data?.available_seats ?? 0)
    : data?.manual_override_active
      ? (data?.available_seats ?? 0)
      : (autoAvailable ?? data?.available_seats ?? 0);

  // ── Manual Drift Alert ─────────────────────────────────────────────────────
  // Show when manual override is ON and manual count differs from reservation-based count
  const autoBasedCount = data?.manual_override_active
    ? Math.max(0, (data?.total_seats || 0) - reservationOccupiedSeats)
    : null;
  const manualDrift = data?.manual_override_active && autoBasedCount !== null
    ? Math.abs(displayAvailable - autoBasedCount)
    : 0;
  const [driftDismissed, setDriftDismissed] = useState(false);
  const showDriftAlert = data?.manual_override_active && manualDrift > 0 && !driftDismissed && !offlineMode;

  // ── Stale data detection ───────────────────────────────────────────────────
  const lastUpdate = data?.seating_updated_at ? moment(data.seating_updated_at) : null;
  const minutesSinceUpdate = lastUpdate ? moment().diff(lastUpdate, 'minutes') : null;
  const isStale = minutesSinceUpdate !== null && minutesSinceUpdate >= 60;
  const isVeryStale = minutesSinceUpdate !== null && minutesSinceUpdate >= 90;

  const [reminderDismissed, setReminderDismissed] = useState(false);
  const showStaleAlert = isStale && !reminderDismissed && !data?.manual_override_active;

  const dismissReminder = () => {
    setReminderDismissed(true);
    setTimeout(() => setReminderDismissed(false), 15 * 60 * 1000);
  };

  // ── Metrics ────────────────────────────────────────────────────────────────
  const waitingParties = waitlist.filter(w => w.status === 'waiting');
  const totalWaiting = waitingParties.length;
  const occupancyPercent = data?.total_seats > 0
    ? Math.round(((data.total_seats - displayAvailable) / data.total_seats) * 100)
    : 0;
  const avgWaitTime = totalWaiting > 0
    ? Math.round(waitingParties.reduce((sum, e) => sum + moment().diff(moment(e.created_date), 'minutes'), 0) / totalWaiting)
    : 0;

  // ── Manual override toggle ─────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      await base44.entities.Restaurant.update(restaurant.id, {
        ...updates,
        seating_updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['staffRestaurants'] });
    },
  });

  const handleToggleOverride = async (enabled) => {
    if (offlineMode) return; // can't toggle in offline mode
    if (enabled) {
      await updateMutation.mutateAsync({
        manual_override_active: true,
        available_seats: displayAvailable,
        manual_adjustment_offset: 0,
      });
      setDriftDismissed(false);
      toast.info('Manual override ON — auto-sync paused');
    } else {
      await updateMutation.mutateAsync({
        manual_override_active: false,
        manual_adjustment_offset: 0,
        available_seats: autoAvailable ?? data?.available_seats ?? 0,
      });
      toast.info('Manual override OFF — auto-sync resumed');
    }
  };

  // Sync manual count to reservation-based count
  const handleSyncToAuto = async () => {
    if (!autoBasedCount !== null) return;
    await updateMutation.mutateAsync({ available_seats: autoBasedCount });
    setDriftDismissed(true);
    toast.success(`Synced to ${autoBasedCount} available seats`);
  };

  // ── Manual seat adjustment ─────────────────────────────────────────────────
  const handleAdjust = (delta) => {
    if (offlineMode) {
      // Offline: update local state only
      const maxSeats = cachedData?.total_seats || data?.total_seats || 100;
      const current = localOfflineSeats ?? data?.available_seats ?? 0;
      setLocalOfflineSeats(Math.max(0, Math.min(maxSeats, current + delta)));
      return;
    }
    if (!data?.manual_override_active) return;
    const newValue = Math.max(0, Math.min(data.total_seats, (data.available_seats || 0) + delta));
    onSeatingChange(newValue);
    setReminderDismissed(false);
    setDriftDismissed(false);
  };

  // When override is OFF, push auto-calculated value to DB whenever it changes
  useEffect(() => {
    if (offlineMode) return;
    if (data?.manual_override_active) return;
    if (autoAvailable === null || autoAvailable === undefined) return;
    if (autoAvailable === data?.available_seats) return;

    updateMutation.mutate({
      available_seats: autoAvailable,
      manual_override_active: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAvailable, data?.manual_override_active, offlineMode]);

  return (
    <div className="space-y-4">

      {/* Offline Mode Banner */}
      {offlineMode && (
        <Card className="border-2 border-orange-400 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-orange-500 shrink-0" />
              <div>
                <p className="font-medium text-orange-800">Offline Mode</p>
                <p className="text-sm text-orange-700">
                  Database unreachable — showing cached data from{' '}
                  {cachedData?.cachedAt ? moment(cachedData.cachedAt).fromNow() : 'earlier'}.
                  Changes cannot be saved until reconnected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Drift Alert */}
      {showDriftAlert && (
        <Card className="border-2 border-blue-400 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ArrowRightLeft className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Seat Count Mismatch</p>
                  <p className="text-sm text-blue-700">
                    Manual count is <strong>{displayAvailable}</strong>, but active reservations say <strong>{autoBasedCount}</strong>. Sync now?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setDriftDismissed(true)} className="text-slate-500">
                  Ignore
                </Button>
                <Button
                  size="sm"
                  onClick={handleSyncToAuto}
                  disabled={updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Sync
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stale Data Alert (>60 min) */}
      {showStaleAlert && (
        <Card className={cn(
          "border-2",
          isVeryStale ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className={cn("w-5 h-5 shrink-0", isVeryStale ? "text-red-500" : "text-amber-500")} />
                <div>
                  <p className={cn("font-medium", isVeryStale ? "text-red-700" : "text-amber-700")}>
                    Still Accurate?
                  </p>
                  <p className="text-sm text-slate-600">
                    Last DB write was {minutesSinceUpdate} minutes ago — please verify seating
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={dismissReminder} className="text-slate-500">
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    updateMutation.mutate({ available_seats: displayAvailable });
                    dismissReminder();
                  }}
                  className={cn(isVeryStale ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600")}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Confirm Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Seating Control */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">{data?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm">
                  {data?.manual_override_active ? 'Manual Mode' : 'Auto-Sync Active'}
                </p>
                {lastUpdate && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      isVeryStale ? "border-red-300 text-red-600" :
                      isStale ? "border-amber-300 text-amber-600" :
                      "border-emerald-300 text-emerald-600"
                    )}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {moment(lastUpdate).fromNow()}
                  </Badge>
                )}
                {!data?.manual_override_active && (
                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 gap-1">
                    <Database className="w-3 h-3" />
                    {reservationOccupiedSeats} reserved
                  </Badge>
                )}
              </div>
            </div>
            <OccupancyBadge
              available={displayAvailable}
              total={data?.total_seats}
              isFull={data?.is_full}
            />
          </div>

          <SeatingBar
            available={displayAvailable}
            total={data?.total_seats}
            height="h-4"
          />

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-slate-900">{occupancyPercent}%</span>
              </div>
              <p className="text-xs text-slate-500">Occupancy</p>
            </div>
            <div className="text-center border-x border-slate-200">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="text-2xl font-bold text-slate-900">{totalWaiting}</span>
              </div>
              <p className="text-xs text-slate-500">Waiting</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-2xl font-bold text-slate-900">{avgWaitTime}</span>
              </div>
              <p className="text-xs text-slate-500">Avg Wait (min)</p>
            </div>
          </div>

          {/* Manual Override Toggle */}
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl mt-6 transition-colors",
            data?.manual_override_active ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
          )}>
            <div className="flex items-center gap-3">
              {data?.manual_override_active
                ? <Lock className="w-5 h-5 text-amber-500" />
                : <Unlock className="w-5 h-5 text-slate-400" />
              }
              <div>
                <p className="font-medium text-slate-900">Manual Override</p>
                <p className="text-sm text-slate-500">
                  {data?.manual_override_active
                    ? 'Auto-sync paused — adjustments saved'
                    : 'Auto-calculates from reservations'}
                </p>
              </div>
            </div>
            <Switch
              checked={!!data?.manual_override_active}
              onCheckedChange={handleToggleOverride}
              disabled={isUpdating || updateMutation.isPending}
            />
          </div>

          {/* Adjust buttons — only active in manual override mode */}
          <div className={cn(
            "mt-6 transition-opacity",
            !data?.manual_override_active && "opacity-40 pointer-events-none"
          )}>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAdjust(-5)}
                disabled={displayAvailable === 0 || isUpdating}
                className="h-14 w-14 rounded-2xl text-lg font-semibold"
              >
                -5
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAdjust(-1)}
                disabled={displayAvailable === 0 || isUpdating}
                className="h-14 w-14 rounded-2xl"
              >
                <Minus className="w-5 h-5" />
              </Button>

              <div className="w-28 text-center">
                <div className="text-4xl font-bold text-slate-900">{displayAvailable}</div>
                <div className="text-sm text-slate-500">available</div>
              </div>

              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAdjust(1)}
                disabled={displayAvailable >= (data?.total_seats || 0) || isUpdating}
                className="h-14 w-14 rounded-2xl"
              >
                <Plus className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAdjust(5)}
                disabled={displayAvailable >= (data?.total_seats || 0) || isUpdating}
                className="h-14 w-14 rounded-2xl text-lg font-semibold"
              >
                +5
              </Button>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => data?.manual_override_active && onSeatingChange(0)}
                disabled={isUpdating}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Set to 0 (Full)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => data?.manual_override_active && onSeatingChange(data?.total_seats)}
                disabled={isUpdating}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                Set to Max
              </Button>
            </div>

            {!data?.manual_override_active && (
              <p className="text-center text-xs text-slate-400 mt-3">
                Enable Manual Override to adjust seats manually
              </p>
            )}
          </div>

          {/* No Walk-ins toggle */}
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl mt-4 transition-colors",
            data?.is_full ? "bg-red-50" : "bg-slate-50"
          )}>
            <div className="flex items-center gap-3">
              <AlertCircle className={cn("w-5 h-5", data?.is_full ? "text-red-500" : "text-slate-400")} />
              <div>
                <p className="font-medium text-slate-900">No More Walk-ins</p>
                <p className="text-sm text-slate-500">Mark restaurant as full</p>
              </div>
            </div>
            <Switch
              checked={!!data?.is_full}
              onCheckedChange={onFullToggle}
              disabled={isUpdating}
            />
          </div>

          {/* Up-to-date confirmation */}
          {!isStale && lastUpdate && minutesSinceUpdate !== null && minutesSinceUpdate < 5 && (
            <div className="flex items-center justify-center gap-2 mt-4 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Seating data is up to date</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
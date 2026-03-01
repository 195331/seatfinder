import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCircle, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

const NUDGE_INTERVAL = 15; // minutes

export default function ShiftModePanel({ restaurant }) {
  const queryClient = useQueryClient();
  const [showNudge, setShowNudge] = useState(false);

  // Check if nudge should be shown
  useEffect(() => {
    if (!restaurant.shift_mode_active) {
      setShowNudge(false);
      return;
    }

    const lastUpdate = restaurant.seating_updated_at ? moment(restaurant.seating_updated_at) : null;
    const lastNudge = restaurant.last_shift_nudge ? moment(restaurant.last_shift_nudge) : null;
    
    if (!lastUpdate || moment().diff(lastUpdate, 'minutes') > NUDGE_INTERVAL) {
      if (!lastNudge || moment().diff(lastNudge, 'minutes') > NUDGE_INTERVAL) {
        setShowNudge(true);
      }
    }

    const interval = setInterval(() => {
      const lastUpdateCheck = restaurant.seating_updated_at ? moment(restaurant.seating_updated_at) : null;
      if (!lastUpdateCheck || moment().diff(lastUpdateCheck, 'minutes') > NUDGE_INTERVAL) {
        setShowNudge(true);
      }
    }, NUDGE_INTERVAL * 60 * 1000);

    return () => clearInterval(interval);
  }, [restaurant.shift_mode_active, restaurant.seating_updated_at, restaurant.last_shift_nudge]);

  const toggleShiftMode = useMutation({
    mutationFn: (enabled) => base44.entities.Restaurant.update(restaurant.id, {
      shift_mode_active: enabled,
      last_shift_nudge: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ownedRestaurants']);
      queryClient.invalidateQueries(['staffRestaurants']);
    }
  });

  const quickUpdateMutation = useMutation({
    mutationFn: async (seatsChange) => {
      const newAvailable = Math.max(0, Math.min(restaurant.total_seats, restaurant.available_seats + seatsChange));
      await base44.entities.Restaurant.update(restaurant.id, {
        available_seats: newAvailable,
        seating_updated_at: new Date().toISOString(),
        last_shift_nudge: new Date().toISOString()
      });
      // Audit log — tagged as manual adjustment
      await base44.entities.AuditLog.create({
        restaurant_id: restaurant.id,
        action_type: 'seating_manual_adjustment',
        source: 'manual_adjustment',
        entity_type: 'restaurant',
        entity_id: restaurant.id,
        performed_by: 'owner',
        performed_by_name: 'Manual Override (Shift Mode)',
        old_value: { available_seats: restaurant.available_seats },
        new_value: { available_seats: newAvailable },
        reason: `Manual adjustment of ${seatsChange > 0 ? '+' : ''}${seatsChange} seats via Shift Mode override`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ownedRestaurants']);
      queryClient.invalidateQueries(['staffRestaurants']);
      setShowNudge(false);
      toast.success('Manual adjustment saved');
    }
  });

  const confirmAccurateMutation = useMutation({
    mutationFn: () => base44.entities.Restaurant.update(restaurant.id, {
      seating_updated_at: new Date().toISOString(),
      last_shift_nudge: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ownedRestaurants']);
      queryClient.invalidateQueries(['staffRestaurants']);
      setShowNudge(false);
      toast.success('Confirmed accurate');
    }
  });

  const lastUpdate = restaurant.seating_updated_at ? moment(restaurant.seating_updated_at) : null;
  const minutesSinceUpdate = lastUpdate ? moment().diff(lastUpdate, 'minutes') : null;

  return (
    <Card className={cn(
      "border-0 shadow-lg",
      restaurant.shift_mode_active && "border-2 border-emerald-400"
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className={cn(
              "w-5 h-5",
              restaurant.shift_mode_active ? "text-orange-500" : "text-slate-400"
            )} />
            Manual Override
            <Badge variant="outline" className="text-xs font-normal text-slate-500 ml-1">Shift Mode</Badge>
          </CardTitle>
          <Switch
            checked={restaurant.shift_mode_active}
            onCheckedChange={(v) => toggleShiftMode.mutate(v)}
          />
        </div>
        {restaurant.shift_mode_active && lastUpdate && (
          <p className="text-sm text-slate-500">
            Last updated: {lastUpdate.fromNow()}
          </p>
        )}
      </CardHeader>

      {restaurant.shift_mode_active && (
        <CardContent className="space-y-4">
          {/* Nudge Alert */}
          {showNudge && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg animate-pulse">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-2">Still accurate?</p>
                  <p className="text-sm text-amber-700 mb-3">
                    It's been {minutesSinceUpdate}+ minutes since your last update
                  </p>
                  <Button
                    onClick={() => confirmAccurateMutation.mutate()}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Yes, still accurate
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Update Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-lg">{restaurant.available_seats} / {restaurant.total_seats}</p>
                <p className="text-sm text-slate-500">Available seats</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => quickUpdateMutation.mutate(-4)}
                  disabled={restaurant.available_seats < 4}
                  variant="outline"
                  size="lg"
                  className="h-16 w-16 text-xl"
                >
                  -4
                </Button>
                <Button
                  onClick={() => quickUpdateMutation.mutate(-2)}
                  disabled={restaurant.available_seats < 2}
                  variant="outline"
                  size="lg"
                  className="h-16 w-16 text-xl"
                >
                  -2
                </Button>
                <Button
                  onClick={() => quickUpdateMutation.mutate(2)}
                  disabled={restaurant.available_seats >= restaurant.total_seats - 1}
                  variant="outline"
                  size="lg"
                  className="h-16 w-16 text-xl"
                >
                  +2
                </Button>
                <Button
                  onClick={() => quickUpdateMutation.mutate(4)}
                  disabled={restaurant.available_seats >= restaurant.total_seats - 3}
                  variant="outline"
                  size="lg"
                  className="h-16 w-16 text-xl"
                >
                  +4
                </Button>
              </div>
            </div>

            {/* Reliability Streak */}
            {restaurant.update_streak_days > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">
                    {restaurant.update_streak_days} day streak!
                  </span>
                </div>
                <Badge className="bg-emerald-600">
                  Reliable
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
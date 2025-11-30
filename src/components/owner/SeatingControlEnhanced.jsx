import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Minus, Plus, AlertCircle, Users, Clock, TrendingUp, 
  Bell, RefreshCw, CheckCircle 
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

export default function SeatingControlEnhanced({ 
  restaurant, 
  onSeatingChange, 
  onFullToggle,
  isUpdating,
  waitlist = []
}) {
  const [showReminder, setShowReminder] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Calculate internal metrics
  const waitingParties = waitlist.filter(w => w.status === 'waiting');
  const totalWaiting = waitingParties.length;
  
  const occupancyPercent = restaurant.total_seats > 0 
    ? Math.round(((restaurant.total_seats - restaurant.available_seats) / restaurant.total_seats) * 100)
    : 0;

  // Average wait time calculation
  const avgWaitTime = waitingParties.reduce((sum, entry) => {
    const waitMinutes = moment().diff(moment(entry.created_date), 'minutes');
    return sum + waitMinutes;
  }, 0) / (totalWaiting || 1);

  // Check if seating update is stale (more than 20-30 minutes)
  const lastUpdate = restaurant.seating_updated_at 
    ? moment(restaurant.seating_updated_at)
    : null;
  const minutesSinceUpdate = lastUpdate 
    ? moment().diff(lastUpdate, 'minutes')
    : null;
  const isStale = minutesSinceUpdate !== null && minutesSinceUpdate >= 20;
  const isVeryStale = minutesSinceUpdate !== null && minutesSinceUpdate >= 30;

  // Show reminder if stale and not dismissed
  useEffect(() => {
    if (isStale && !reminderDismissed) {
      setShowReminder(true);
    }
  }, [isStale, reminderDismissed]);

  const handleAdjust = (delta) => {
    const newValue = Math.max(0, Math.min(
      restaurant.total_seats, 
      restaurant.available_seats + delta
    ));
    onSeatingChange(newValue);
    setShowReminder(false);
    setReminderDismissed(false);
  };

  const dismissReminder = () => {
    setShowReminder(false);
    setReminderDismissed(true);
    setTimeout(() => setReminderDismissed(false), 10 * 60 * 1000); // Reset after 10 min
  };

  return (
    <div className="space-y-4">
      {/* Stale Data Reminder */}
      {showReminder && (
        <Card className={cn(
          "border-2 animate-pulse",
          isVeryStale ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className={cn(
                  "w-5 h-5",
                  isVeryStale ? "text-red-500" : "text-amber-500"
                )} />
                <div>
                  <p className={cn(
                    "font-medium",
                    isVeryStale ? "text-red-700" : "text-amber-700"
                  )}>
                    Time to update seating!
                  </p>
                  <p className="text-sm text-slate-600">
                    Last updated {minutesSinceUpdate} minutes ago
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismissReminder}
                  className="text-slate-500"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAdjust(0)}
                  className={cn(
                    isVeryStale ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Seating Control */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">{restaurant.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm">Live Seating Control</p>
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
              </div>
            </div>
            <OccupancyBadge
              available={restaurant.available_seats}
              total={restaurant.total_seats}
              isFull={restaurant.is_full}
            />
          </div>

          <SeatingBar 
            available={restaurant.available_seats} 
            total={restaurant.total_seats}
            height="h-4"
          />

          {/* Internal Stats Row */}
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
              <p className="text-xs text-slate-500">Parties Waiting</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-2xl font-bold text-slate-900">{Math.round(avgWaitTime)}</span>
              </div>
              <p className="text-xs text-slate-500">Avg Wait (min)</p>
            </div>
          </div>

          {/* Quick Adjust Buttons */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleAdjust(-5)}
              disabled={restaurant.available_seats === 0 || isUpdating}
              className="h-14 w-14 rounded-2xl text-lg font-semibold"
            >
              -5
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleAdjust(-1)}
              disabled={restaurant.available_seats === 0 || isUpdating}
              className="h-14 w-14 rounded-2xl"
            >
              <Minus className="w-5 h-5" />
            </Button>
            
            <div className="w-24 text-center">
              <div className="text-4xl font-bold text-slate-900">
                {restaurant.available_seats}
              </div>
              <div className="text-sm text-slate-500">available</div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => handleAdjust(1)}
              disabled={restaurant.available_seats >= restaurant.total_seats || isUpdating}
              className="h-14 w-14 rounded-2xl"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleAdjust(5)}
              disabled={restaurant.available_seats >= restaurant.total_seats || isUpdating}
              className="h-14 w-14 rounded-2xl text-lg font-semibold"
            >
              +5
            </Button>
          </div>

          {/* Quick Updates */}
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSeatingChange(0)}
              disabled={isUpdating}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Set to 0 (Full)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSeatingChange(restaurant.total_seats)}
              disabled={isUpdating}
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              Set to Max
            </Button>
          </div>

          {/* Full Toggle */}
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl mt-6 transition-colors",
            restaurant.is_full ? "bg-red-50" : "bg-slate-50"
          )}>
            <div className="flex items-center gap-3">
              <AlertCircle className={cn(
                "w-5 h-5",
                restaurant.is_full ? "text-red-500" : "text-slate-400"
              )} />
              <div>
                <p className="font-medium text-slate-900">No More Walk-ins</p>
                <p className="text-sm text-slate-500">Mark restaurant as full</p>
              </div>
            </div>
            <Switch
              checked={restaurant.is_full}
              onCheckedChange={onFullToggle}
              disabled={isUpdating}
            />
          </div>

          {/* Last updated confirmation */}
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
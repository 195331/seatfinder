import React from 'react';
import { Minus, Plus, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import SeatingBar from "@/components/ui/SeatingBar";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import { cn } from "@/lib/utils";

export default function SeatingControl({ 
  restaurant, 
  onSeatingChange, 
  onFullToggle,
  isUpdating 
}) {
  const handleAdjust = (delta) => {
    const newValue = Math.max(0, Math.min(
      restaurant.total_seats, 
      restaurant.available_seats + delta
    ));
    onSeatingChange(newValue);
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-lg">{restaurant.name}</h3>
            <p className="text-slate-500 text-sm">Live Seating Control</p>
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
      </CardContent>
    </Card>
  );
}
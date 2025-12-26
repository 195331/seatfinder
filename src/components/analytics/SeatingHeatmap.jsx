import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function SeatingHeatmap({ restaurantId, floorPlanData }) {
  const [timeRange, setTimeRange] = useState('7_days');

  const { data: seatingHistory = [], isLoading } = useQuery({
    queryKey: ['seatingHistory', restaurantId, timeRange],
    queryFn: () => base44.entities.SeatingHistory.filter({ 
      restaurant_id: restaurantId 
    }, '-recorded_at', 1000),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const cutoffDate = {
    '7_days': moment().subtract(7, 'days'),
    '30_days': moment().subtract(30, 'days'),
    '90_days': moment().subtract(90, 'days'),
  }[timeRange];

  const filteredHistory = seatingHistory.filter(s => 
    moment(s.recorded_at).isAfter(cutoffDate)
  );

  // Calculate occupancy by hour of day
  const hourlyOccupancy = {};
  filteredHistory.forEach(entry => {
    const hour = moment(entry.recorded_at).hour();
    if (!hourlyOccupancy[hour]) {
      hourlyOccupancy[hour] = { sum: 0, count: 0 };
    }
    hourlyOccupancy[hour].sum += entry.occupancy_percent || 0;
    hourlyOccupancy[hour].count += 1;
  });

  const avgByHour = Object.keys(hourlyOccupancy).map(hour => ({
    hour: parseInt(hour),
    avg: hourlyOccupancy[hour].sum / hourlyOccupancy[hour].count
  })).sort((a, b) => a.hour - b.hour);

  // Calculate table-level occupancy (if we have table data)
  const tableOccupancy = {};
  tables.forEach(table => {
    // This would need more detailed table-level tracking
    // For now, estimate based on capacity and overall occupancy
    const tableId = table.id;
    const capacity = table.capacity || 4;
    const relativeLoad = capacity / tables.reduce((sum, t) => sum + (t.capacity || 4), 0);
    const avgOccupancy = filteredHistory.length > 0
      ? filteredHistory.reduce((sum, s) => sum + (s.occupancy_percent || 0), 0) / filteredHistory.length
      : 0;
    tableOccupancy[tableId] = avgOccupancy * relativeLoad;
  });

  const getOccupancyColor = (percent) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-orange-500';
    if (percent >= 50) return 'bg-yellow-500';
    if (percent >= 30) return 'bg-green-500';
    return 'bg-emerald-500';
  };

  const getIntensity = (percent) => {
    if (percent >= 80) return 'opacity-100';
    if (percent >= 60) return 'opacity-80';
    if (percent >= 40) return 'opacity-60';
    if (percent >= 20) return 'opacity-40';
    return 'opacity-20';
  };

  if (isLoading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  if (filteredHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seating Heatmap</CardTitle>
          <CardDescription>Not enough data yet</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Keep tracking seating to see patterns</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Seating Heatmap
            </CardTitle>
            <CardDescription>Historical occupancy patterns</CardDescription>
          </div>
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="7_days">7d</TabsTrigger>
              <TabsTrigger value="30_days">30d</TabsTrigger>
              <TabsTrigger value="90_days">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hourly Heatmap */}
        <div>
          <h3 className="font-semibold text-sm text-slate-700 mb-3">Peak Hours</h3>
          <div className="grid grid-cols-12 gap-1">
            {avgByHour.map(({ hour, avg }) => (
              <div key={hour} className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-full aspect-square rounded-md",
                    getOccupancyColor(avg),
                    getIntensity(avg)
                  )}
                  title={`${hour}:00 - ${avg.toFixed(0)}% occupied`}
                />
                <span className="text-xs text-slate-500 mt-1">
                  {hour % 12 || 12}{hour < 12 ? 'a' : 'p'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Floor Plan Heatmap */}
        {floorPlanData?.areas && tables.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3">Table Utilization</h3>
            <div className="relative bg-slate-50 rounded-xl p-6 border border-slate-200" style={{ minHeight: '300px' }}>
              {/* Areas */}
              {floorPlanData.areas.map((area) => (
                <div
                  key={area.id}
                  className="absolute border-2 border-slate-300 rounded-lg bg-white/50"
                  style={{
                    left: `${area.x}px`,
                    top: `${area.y}px`,
                    width: `${area.width}px`,
                    height: `${area.height}px`,
                  }}
                >
                  <div className="absolute -top-6 left-2 text-xs font-medium text-slate-600">
                    {area.name}
                  </div>
                </div>
              ))}

              {/* Tables */}
              {tables.map((table) => {
                const occupancy = tableOccupancy[table.id] || 0;
                return (
                  <div
                    key={table.id}
                    className={cn(
                      "absolute rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-lg",
                      getOccupancyColor(occupancy),
                      getIntensity(occupancy)
                    )}
                    style={{
                      left: `${table.position_x || 100}px`,
                      top: `${table.position_y || 100}px`,
                      width: '50px',
                      height: '50px',
                    }}
                    title={`${table.label} - ${occupancy.toFixed(0)}% avg occupancy`}
                  >
                    {table.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t">
          <span className="text-xs text-slate-500">Less busy</span>
          <div className="flex gap-1">
            {[20, 40, 60, 80, 100].map((val) => (
              <div
                key={val}
                className={cn(
                  "w-8 h-4 rounded",
                  getOccupancyColor(val)
                )}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">Very busy</span>
        </div>
      </CardContent>
    </Card>
  );
}
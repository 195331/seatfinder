import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Flame, Snowflake, Minus, Zap, Music } from 'lucide-react';
import { cn } from "@/lib/utils";

// Attention level colors
const ATTENTION_COLORS = {
  hot: { bg: '#ef4444', border: '#dc2626', label: 'Popular Spot', icon: Flame },
  medium: { bg: '#f59e0b', border: '#d97706', label: 'Moderate', icon: Minus },
  cold: { bg: '#3b82f6', border: '#2563eb', label: 'Low Traffic', icon: Snowflake },
};

// Vibe colors: 1=Cozy(blue), 5=Energetic(orange)
const VIBE_COLORS = [
  { bg: '#3b82f6', border: '#2563eb', label: 'Very Cozy' },   // 1
  { bg: '#8b5cf6', border: '#7c3aed', label: 'Relaxed' },     // 2
  { bg: '#10b981', border: '#059669', label: 'Balanced' },    // 3
  { bg: '#f59e0b', border: '#d97706', label: 'Lively' },      // 4
  { bg: '#ef4444', border: '#dc2626', label: 'Energetic' },   // 5
];

export default function TableHeatmap({ restaurantId }) {
  const [viewMode, setViewMode] = useState('normal'); // 'normal' | 'vibe'

  // Fetch restaurant for floor plan data
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  // Fetch tables
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Fetch reservations to calculate popularity
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Calculate table popularity based on reservations
  const tablePopularity = useMemo(() => {
    const counts = {};
    (reservations || []).forEach(r => {
      if (r?.table_id) {
        counts[r.table_id] = (counts[r.table_id] || 0) + 1;
      }
    });
    return counts;
  }, [reservations]);

  // Determine attention level for each table
  const getAttentionLevel = (tableId) => {
    const count = tablePopularity[tableId] || 0;
    const maxCount = Math.max(...Object.values(tablePopularity), 1);
    const ratio = count / maxCount;

    if (ratio > 0.6) return 'hot';
    if (ratio > 0.2) return 'medium';
    return 'cold';
  };

  // Get floor plan data
  const floorPlanData = restaurant?.floor_plan_data;
  const hasFloorPlan = floorPlanData?.tables?.length > 0 || tables.length > 0;

  // Merge floor plan tables with DB tables
  const displayTables = useMemo(() => {
    if (floorPlanData?.tables?.length > 0) {
      return (floorPlanData.tables || []).map(fpTable => {
        const dbTable = (tables || []).find(t => t?.label === fpTable?.label);
        return {
          ...fpTable,
          id: dbTable?.id || fpTable.id,
          attention: getAttentionLevel(dbTable?.id),
          reservationCount: tablePopularity[dbTable?.id] || 0
        };
      });
    }
    return (tables || []).map(t => ({
      ...t,
      x: t.position_x || 50 + Math.random() * 300,
      y: t.position_y || 50 + Math.random() * 200,
      width: 50,
      height: 50,
      attention: getAttentionLevel(t.id),
      reservationCount: tablePopularity[t.id] || 0
    }));
  }, [floorPlanData, tables, tablePopularity]);

  const areas = floorPlanData?.areas || [];

  if (!hasFloorPlan) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Table Turnover Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No floor plan created yet</p>
            <p className="text-sm mt-1">Create a floor plan to see table popularity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" />
          Table Turnover Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(ATTENTION_COLORS).map(([key, value]) => {
            const Icon = value.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: value.bg }}
                />
                <Icon className="w-4 h-4" style={{ color: value.bg }} />
                <span className="text-sm text-slate-600">{value.label}</span>
              </div>
            );
          })}
        </div>

        {/* Floor Plan View */}
        <div className="relative bg-slate-100 rounded-xl overflow-hidden" style={{ height: 350 }}>
          <svg width="100%" height="100%" viewBox="0 0 500 350" preserveAspectRatio="xMidYMid meet">
            {/* Areas */}
            {(areas || []).map((area) => (
              <g key={area.id}>
                <rect
                  x={area.x || 20}
                  y={area.y || 20}
                  width={area.width || 460}
                  height={area.height || 310}
                  fill={area.color || '#e2e8f0'}
                  fillOpacity={0.3}
                  stroke={area.color || '#cbd5e1'}
                  strokeWidth={2}
                  rx={8}
                />
                <text
                  x={(area.x || 20) + 10}
                  y={(area.y || 20) + 20}
                  fill="#64748b"
                  fontSize={12}
                  fontWeight="500"
                >
                  {area.name}
                </text>
              </g>
            ))}

            {/* Tables */}
            {(displayTables || []).map((table) => {
              const attention = ATTENTION_COLORS[table.attention];
              const size = Math.min(table.width || 50, table.height || 50);
              
              return (
                <g key={table.id || table.label}>
                  {table.shape === 'round' ? (
                    <circle
                      cx={table.x + size / 2}
                      cy={table.y + size / 2}
                      r={size / 2 - 2}
                      fill={attention.bg}
                      stroke={attention.border}
                      strokeWidth={3}
                      className="transition-all duration-300"
                    />
                  ) : (
                    <rect
                      x={table.x}
                      y={table.y}
                      width={table.width || 50}
                      height={table.height || 50}
                      fill={attention.bg}
                      stroke={attention.border}
                      strokeWidth={3}
                      rx={table.shape === 'round' ? 25 : 6}
                      className="transition-all duration-300"
                    />
                  )}
                  {/* Table label */}
                  <text
                    x={table.x + (table.width || 50) / 2}
                    y={table.y + (table.height || 50) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={11}
                    fontWeight="bold"
                  >
                    {table.label}
                  </text>
                  {/* Reservation count */}
                  <text
                    x={table.x + (table.width || 50) / 2}
                    y={table.y + (table.height || 50) / 2 + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={9}
                    opacity={0.9}
                  >
                    {table.reservationCount} res.
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <Flame className="w-4 h-4" />
              <span className="font-bold">
                {(displayTables || []).filter(t => t?.attention === 'hot').length}
              </span>
            </div>
            <p className="text-xs text-slate-500">Popular Tables</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <Minus className="w-4 h-4" />
              <span className="font-bold">
                {(displayTables || []).filter(t => t?.attention === 'medium').length}
              </span>
            </div>
            <p className="text-xs text-slate-500">Moderate</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
              <Snowflake className="w-4 h-4" />
              <span className="font-bold">
                {(displayTables || []).filter(t => t?.attention === 'cold').length}
              </span>
            </div>
            <p className="text-xs text-slate-500">Low Traffic</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
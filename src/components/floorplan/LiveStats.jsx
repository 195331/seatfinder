import React from 'react';
import { Badge } from "@/components/ui/badge";

export default function LiveStats({ tables, areas }) {
  const totalTables = tables.length;
  const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0);

  const areaStats = areas.map(area => {
    const areaTables = tables.filter(t => t.areaId === area.id);
    return {
      ...area,
      tableCount: areaTables.length,
      seatCount: areaTables.reduce((sum, t) => sum + t.seats, 0)
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-white rounded-xl border border-slate-200">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Total:</span>
        <Badge variant="secondary" className="bg-slate-100">
          {totalTables} tables
        </Badge>
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
          {totalSeats} seats
        </Badge>
      </div>

      <div className="w-px h-6 bg-slate-200 hidden sm:block" />

      <div className="flex flex-wrap items-center gap-2">
        {areaStats.map(area => (
          <div key={area.id} className="flex items-center gap-1.5">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            <span className="text-xs text-slate-600">
              {area.name}: {area.tableCount}T · {area.seatCount}S
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
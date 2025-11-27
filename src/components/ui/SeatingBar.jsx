import React from 'react';
import { cn } from "@/lib/utils";

export default function SeatingBar({ available, total, showLabel = true, height = "h-2" }) {
  const occupancyPercent = total > 0 ? ((total - available) / total) * 100 : 0;
  
  const getColor = () => {
    if (occupancyPercent >= 85) return "bg-red-500";
    if (occupancyPercent >= 60) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="w-full">
      <div className={cn("w-full bg-slate-100 rounded-full overflow-hidden", height)}>
        <div 
          className={cn("h-full rounded-full transition-all duration-500", getColor())}
          style={{ width: `${occupancyPercent}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between items-center mt-1.5 text-sm">
          <span className="text-slate-600">{available} free / {total} seats</span>
          <span className="font-medium text-slate-800">{Math.round(occupancyPercent)}% full</span>
        </div>
      )}
    </div>
  );
}
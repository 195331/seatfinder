import React from 'react';
import { cn } from "@/lib/utils";

export default function OccupancyBadge({ available, total, isFull, size = "md" }) {
  const occupancyPercent = total > 0 ? ((total - available) / total) * 100 : 0;
  
  const getStatus = () => {
    if (isFull) return { label: "Full", color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50" };
    if (occupancyPercent >= 85) return { label: "Full", color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50" };
    if (occupancyPercent >= 60) return { label: "Moderate", color: "bg-amber-500", textColor: "text-amber-700", bgColor: "bg-amber-50" };
    return { label: "Chill", color: "bg-emerald-500", textColor: "text-emerald-700", bgColor: "bg-emerald-50" };
  };

  const status = getStatus();
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      status.bgColor,
      status.textColor,
      sizeClasses[size]
    )}>
      <span className={cn("w-2 h-2 rounded-full", status.color)} />
      {status.label}
    </span>
  );
}
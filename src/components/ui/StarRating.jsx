import React from 'react';
import { Star } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function StarRating({ rating, count, size = "sm", showCount = true }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Star className={cn(sizeClasses[size], "fill-amber-400 text-amber-400")} />
      <span className={cn("font-semibold text-slate-800", textSizes[size])}>
        {rating?.toFixed(1) || "0.0"}
      </span>
      {showCount && count !== undefined && (
        <span className={cn("text-slate-500", textSizes[size])}>
          ({count})
        </span>
      )}
    </span>
  );
}
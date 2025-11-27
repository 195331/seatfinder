import React from 'react';
import { cn } from "@/lib/utils";
import { DollarSign } from 'lucide-react';

export default function PriceLevel({ level, size = "sm" }) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4].map((i) => (
        <DollarSign 
          key={i}
          className={cn(
            sizeClasses[size],
            i <= level ? "text-slate-800" : "text-slate-300"
          )}
        />
      ))}
    </span>
  );
}
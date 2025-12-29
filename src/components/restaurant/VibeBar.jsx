import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const getVibeLabel = (score) => {
  if (score < 2) return 'Cozy';
  if (score < 3) return 'Chill';
  if (score < 4) return 'Lively';
  if (score < 4.5) return 'Energetic';
  return 'Electric';
};

const getVibeColor = (score) => {
  if (score < 2) return '#6366f1'; // Indigo
  if (score < 3) return '#3b82f6'; // Blue
  if (score < 4) return '#10b981'; // Green
  if (score < 4.5) return '#f59e0b'; // Amber
  return '#ec4899'; // Pink
};

export default function VibeBar({ score = 0, reviewCount = 0, compact = false }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const vibeLabel = getVibeLabel(score);
  const vibeColor = getVibeColor(score);
  const percentage = (score / 5) * 100;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  if (reviewCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            "relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-purple-300 transition-all hover:shadow-md group",
            compact && "px-2 py-1"
          )}
        >
          {/* Glow on hover */}
          <motion.div
            animate={{ opacity: isHovered ? 0.3 : 0 }}
            className="absolute inset-0 rounded-full blur-md"
            style={{ background: vibeColor }}
          />

          {/* Mini Bar */}
          <div className={cn("relative w-16 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-green-500 via-amber-500 to-pink-500", compact && "w-12")}>
            <motion.div
              initial={{ left: 0 }}
              animate={{ left: `${(animatedScore / 5) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2"
              style={{ borderColor: vibeColor }}
            />
          </div>

          {/* Label */}
          <span className={cn("text-xs font-semibold whitespace-nowrap", compact && "text-[10px]")} style={{ color: vibeColor }}>
            {vibeLabel} {score.toFixed(1)}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Ambience</p>
            <p className="text-2xl font-bold text-slate-900">{score.toFixed(1)}</p>
            <p className="text-sm font-semibold" style={{ color: vibeColor }}>
              {vibeLabel}
            </p>
          </div>

          <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 via-green-500 via-amber-500 to-pink-500 relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2"
              style={{ left: `${percentage}%`, borderColor: vibeColor }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-500">
            <span>Cozy</span>
            <span>Energetic</span>
          </div>

          <p className="text-xs text-slate-500">Based on {reviewCount} reviews</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
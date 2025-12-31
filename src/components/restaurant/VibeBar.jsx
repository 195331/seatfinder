import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import moment from 'moment';

const getVibeLabel = (score) => {
  if (score >= 4.5) return 'Energetic';
  if (score >= 3.5) return 'Lively';
  if (score >= 2.5) return 'Balanced';
  if (score >= 1.5) return 'Chill';
  return 'Cozy';
};

const getConfidenceLevel = (reviewCount) => {
  if (reviewCount >= 25) return { level: 'High', color: 'text-emerald-600' };
  if (reviewCount >= 10) return { level: 'Medium', color: 'text-amber-600' };
  return { level: 'Low', color: 'text-slate-600' };
};

export default function VibeBar({ reviews = [], className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById(`vibe-bar-${reviews[0]?.restaurant_id}`);
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [reviews]);

  const vibeReviews = reviews.filter(r => r.vibe_rating);
  const avgVibe = vibeReviews.length > 0
    ? vibeReviews.reduce((sum, r) => sum + r.vibe_rating, 0) / vibeReviews.length
    : 0;

  const vibeLabel = getVibeLabel(avgVibe);
  const confidence = getConfidenceLevel(vibeReviews.length);
  const percentage = (avgVibe / 5) * 100;

  const handleClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  if (vibeReviews.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          id={`vibe-bar-${reviews[0]?.restaurant_id}`}
          className={cn("cursor-pointer", className)}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-700">{vibeLabel}</span>
            <span className="text-xs text-slate-500">{avgVibe.toFixed(1)}</span>
          </div>

          <div className="relative">
            {/* Glow effect on hover */}
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-full blur-md bg-gradient-to-r from-teal-400 via-purple-400 to-orange-400 opacity-30"
              />
            )}

            {/* Gradient bar background */}
            <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-200 via-purple-200 to-orange-200 overflow-hidden">
              {/* Position indicator */}
              <motion.div
                className="absolute top-0 bottom-0 w-3 rounded-full bg-gradient-to-r from-emerald-600 via-purple-600 to-orange-600 shadow-lg"
                initial={{ left: '0%' }}
                animate={{ left: isVisible ? `calc(${percentage}% - 6px)` : '0%' }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {vibeReviews.length} reviews
          </p>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-slate-900 mb-1">Ambience</h4>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-900">
                {avgVibe.toFixed(1)} / 5
              </span>
              <Badge className={confidence.color}>
                {confidence.level}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1">{vibeLabel} atmosphere</p>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t">
            Based on {vibeReviews.length} reviews with vibe ratings
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
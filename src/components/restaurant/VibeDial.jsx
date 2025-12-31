import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import moment from 'moment';

const getVibeLabel = (score) => {
  if (score >= 4.5) return 'Energetic';
  if (score >= 3.5) return 'Lively';
  if (score >= 2.5) return 'Balanced';
  if (score >= 1.5) return 'Chill';
  return 'Cozy';
};

const getVibeColor = (score) => {
  if (score >= 4.5) return 'from-orange-500 to-red-500';
  if (score >= 3.5) return 'from-purple-500 to-pink-500';
  if (score >= 2.5) return 'from-blue-500 to-purple-500';
  if (score >= 1.5) return 'from-teal-500 to-blue-500';
  return 'from-emerald-500 to-teal-500';
};

const getConfidenceLevel = (reviewCount) => {
  if (reviewCount >= 25) return { level: 'High', color: 'text-emerald-600' };
  if (reviewCount >= 10) return { level: 'Medium', color: 'text-amber-600' };
  return { level: 'Low', color: 'text-slate-600' };
};

export default function VibeDial({ reviews = [], className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' or 'recent'
  const [showDetails, setShowDetails] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const filteredReviews = timeFilter === 'recent' 
    ? reviews.filter(r => moment(r.created_date).isAfter(moment().subtract(90, 'days')))
    : reviews;

  const vibeReviews = filteredReviews.filter(r => r.vibe_rating);
  const avgVibe = vibeReviews.length > 0
    ? vibeReviews.reduce((sum, r) => sum + r.vibe_rating, 0) / vibeReviews.length
    : 0;

  const vibeLabel = getVibeLabel(avgVibe);
  const vibeColor = getVibeColor(avgVibe);
  const confidence = getConfidenceLevel(vibeReviews.length);
  const percentage = (avgVibe / 5) * 100;

  // Generate AI summary
  const generateSummary = () => {
    const noiseLevels = filteredReviews.filter(r => r.noise_level);
    const avgNoise = noiseLevels.length > 0
      ? noiseLevels.reduce((s, r) => s + r.noise_level, 0) / noiseLevels.length
      : 0;

    const summaries = [];
    if (avgVibe >= 4) summaries.push('Energetic atmosphere');
    else if (avgVibe >= 3) summaries.push('Lively vibe');
    else summaries.push('Relaxed ambience');

    if (avgNoise >= 4) summaries.push('loud on weekends');
    else if (avgNoise >= 3) summaries.push('moderate noise');
    else summaries.push('quiet setting');

    return summaries.join(', ');
  };

  const handleClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setShowDetails(true);
  };

  if (vibeReviews.length === 0) return null;

  return (
    <>
      <div className={cn("relative", className)}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative cursor-pointer"
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect on hover */}
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "absolute inset-0 rounded-full blur-xl opacity-50",
                `bg-gradient-to-r ${vibeColor}`
              )}
            />
          )}

          {/* Outer ring */}
          <svg className="w-32 h-32 relative" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            
            {/* Animated progress circle */}
            <motion.circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="url(#vibeGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={2 * Math.PI * 50 * (1 - percentage / 100)}
              transform="rotate(-90 60 60)"
              initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
              animate={{ 
                strokeDashoffset: isVisible ? 2 * Math.PI * 50 * (1 - percentage / 100) : 2 * Math.PI * 50 
              }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            />

            <defs>
              <linearGradient id="vibeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={vibeColor.includes('orange') ? '#f97316' : vibeColor.includes('purple') ? '#a855f7' : vibeColor.includes('blue') ? '#3b82f6' : vibeColor.includes('teal') ? '#14b8a6' : '#10b981'} />
                <stop offset="100%" stopColor={vibeColor.includes('red') ? '#ef4444' : vibeColor.includes('pink') ? '#ec4899' : vibeColor.includes('purple') ? '#a855f7' : vibeColor.includes('blue') ? '#3b82f6' : '#14b8a6'} />
              </linearGradient>
            </defs>
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              {vibeLabel}
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {avgVibe.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">/5</p>
          </div>
        </motion.div>

        <p className="text-xs text-center text-slate-500 mt-2">
          Based on {vibeReviews.length} reviews
        </p>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ambience Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">{avgVibe.toFixed(1)} / 5</p>
                <p className="text-sm text-slate-500">{vibeLabel} atmosphere</p>
              </div>
              <Badge className={confidence.color}>
                {confidence.level} confidence
              </Badge>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700 italic">"{generateSummary()}"</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Time period:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeFilter('recent')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full transition-all",
                    timeFilter === 'recent'
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Recent (90 days)
                </button>
                <button
                  onClick={() => setTimeFilter('all')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full transition-all",
                    timeFilter === 'all'
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  All-time
                </button>
              </div>
            </div>

            <div className="pt-3 border-t text-xs text-slate-500">
              Based on {vibeReviews.length} {timeFilter === 'recent' ? 'recent ' : ''}reviews with vibe ratings
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  if (score < 2) return { from: '#6366f1', to: '#8b5cf6' }; // Indigo to Purple
  if (score < 3) return { from: '#3b82f6', to: '#06b6d4' }; // Blue to Cyan
  if (score < 4) return { from: '#10b981', to: '#14b8a6' }; // Green to Teal
  if (score < 4.5) return { from: '#f59e0b', to: '#ef4444' }; // Amber to Red
  return { from: '#ec4899', to: '#f43f5e' }; // Pink to Rose
};

const getConfidence = (reviewCount) => {
  if (reviewCount >= 25) return { label: 'High', color: 'text-green-600', badge: 'bg-green-100' };
  if (reviewCount >= 10) return { label: 'Medium', color: 'text-amber-600', badge: 'bg-amber-100' };
  return { label: 'Low', color: 'text-slate-600', badge: 'bg-slate-100' };
};

export default function VibeDial({ 
  score = 0, 
  reviewCount = 0, 
  aiSummary = null,
  recentScore = null,
  recentReviewCount = 0,
  className 
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' or 'recent'
  const [isHovered, setIsHovered] = useState(false);

  const activeScore = timeFilter === 'recent' && recentScore ? recentScore : score;
  const activeReviewCount = timeFilter === 'recent' ? recentReviewCount : reviewCount;
  const vibeLabel = getVibeLabel(activeScore);
  const vibeColor = getVibeColor(activeScore);
  const confidence = getConfidence(activeReviewCount);
  const percentage = (activeScore / 5) * 100;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(activeScore);
    }, 100);
    return () => clearTimeout(timer);
  }, [activeScore]);

  if (reviewCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowDetails(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn("relative group", className)}
      >
        {/* Glow on hover */}
        <motion.div
          animate={{ opacity: isHovered ? 0.4 : 0 }}
          className="absolute inset-0 rounded-full blur-xl"
          style={{
            background: `radial-gradient(circle, ${vibeColor.from} 0%, ${vibeColor.to} 100%)`
          }}
        />

        {/* Dial Container */}
        <div className="relative w-32 h-32">
          {/* Background Ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            {/* Animated Fill Ring */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${251.2}`}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ 
                strokeDashoffset: 251.2 - (251.2 * animatedScore) / 5,
                stroke: `url(#gradient-${vibeLabel})`
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id={`gradient-${vibeLabel}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={vibeColor.from} />
                <stop offset="100%" stopColor={vibeColor.to} />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-slate-900">{activeScore.toFixed(1)}</p>
            <p className="text-sm font-semibold" style={{ color: vibeColor.from }}>
              {vibeLabel}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {activeReviewCount} reviews
            </p>
          </div>
        </div>

        <Info className="absolute -bottom-1 -right-1 w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors" />
      </button>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Ambience
              <Badge className={cn(confidence.badge, confidence.color)}>
                {confidence.label} Confidence
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Time Filter Toggle */}
            {recentScore && (
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-full w-fit">
                <button
                  onClick={() => setTimeFilter('all')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                    timeFilter === 'all' ? "bg-white shadow-sm" : "text-slate-600"
                  )}
                >
                  All-time
                </button>
                <button
                  onClick={() => setTimeFilter('recent')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                    timeFilter === 'recent' ? "bg-white shadow-sm" : "text-slate-600"
                  )}
                >
                  Recent (90d)
                </button>
              </div>
            )}

            {/* Score Display */}
            <div className="text-center">
              <motion.p 
                key={activeScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-bold text-slate-900"
              >
                {activeScore.toFixed(1)}
              </motion.p>
              <p className="text-xl font-semibold mt-2" style={{ color: vibeColor.from }}>
                {vibeLabel}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Based on {activeReviewCount} reviews
              </p>
            </div>

            {/* Vibe Scale */}
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-gradient-to-r from-indigo-500 via-green-500 via-amber-500 to-pink-500 relative">
                <motion.div
                  initial={{ left: 0 }}
                  animate={{ left: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2"
                  style={{ borderColor: vibeColor.from }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Cozy</span>
                <span>Energetic</span>
              </div>
            </div>

            {/* AI Summary */}
            {aiSummary && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <p className="text-sm font-medium text-purple-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  What people say
                </p>
                <p className="text-sm text-slate-700">{aiSummary}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
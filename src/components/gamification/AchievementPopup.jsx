import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BADGES } from './GamificationTracker';

export default function AchievementPopup({ achievement, onClose }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (achievement) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#9333ea', '#ec4899', '#f97316']
      });

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  if (!achievement) return null;

  const badge = BADGES[achievement.badge_type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -100 }}
          className="fixed bottom-8 right-8 z-[9999] max-w-sm"
        >
          <div className="relative">
            {/* Purple glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl blur-2xl opacity-75 animate-pulse" />
            
            <div className="relative bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-6 shadow-2xl border border-white/20">
              <button
                onClick={() => {
                  setShow(false);
                  setTimeout(onClose, 500);
                }}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4">
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1, 1.1, 1]
                  }}
                  transition={{ duration: 0.6 }}
                  className="text-6xl"
                >
                  {badge?.icon || '🏆'}
                </motion.div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-white">Achievement Unlocked!</h3>
                  </div>
                  
                  <p className="text-xl font-bold text-white mb-1">
                    {badge?.name || 'New Achievement'}
                  </p>
                  
                  <p className="text-sm text-purple-200 mb-3">
                    {badge?.description || 'You\'ve earned a new badge!'}
                  </p>

                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-300">
                      +{badge?.points || achievement.points_awarded || 0} points
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
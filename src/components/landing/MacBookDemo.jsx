import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DinerDemo from './DinerDemo';
import OwnerDemo from './OwnerDemo';

export default function MacBookDemo({ activeTab, shouldReduceMotion }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      {/* MacBook Pro Mockup */}
      <div className="relative w-full max-w-4xl mx-auto">
        {/* Screen Bezel */}
        <div className="relative bg-slate-900 rounded-t-2xl p-3 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-900 rounded-b-2xl z-10" />
          
          {/* Screen Content */}
          <div className="relative bg-white rounded-lg overflow-hidden aspect-[16/10]">
            {isLoading ? (
              <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-shimmer" />
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'diner' ? (
                  <motion.div
                    key="diner"
                    initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <DinerDemo shouldReduceMotion={shouldReduceMotion} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="owner"
                    initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <OwnerDemo shouldReduceMotion={shouldReduceMotion} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Base */}
        <div className="relative h-2 bg-gradient-to-b from-slate-800 to-slate-900 rounded-b-xl shadow-lg" />
        <div className="h-6 flex justify-center">
          <div className="w-32 h-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-b-lg" />
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-3xl -z-10" />
    </div>
  );
}
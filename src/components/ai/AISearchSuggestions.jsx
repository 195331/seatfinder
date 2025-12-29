import React from 'react';
import { Sparkles, Heart, Users, TrendingUp, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { id: 1, icon: Heart, label: 'Quiet date night for 2', query: 'romantic quiet restaurant for date night', gradient: 'from-pink-500 to-rose-500' },
  { id: 2, icon: Users, label: 'Group-friendly spots', query: 'restaurant good for groups', gradient: 'from-blue-500 to-cyan-500' },
  { id: 3, icon: TrendingUp, label: 'Trending this week', query: 'trending popular restaurants', gradient: 'from-purple-500 to-indigo-500' },
  { id: 4, icon: MapPin, label: 'Hidden gems nearby', query: 'hidden gem restaurant', gradient: 'from-emerald-500 to-teal-500' },
  { id: 5, icon: Sparkles, label: 'Best outdoor seating', query: 'outdoor seating patio', gradient: 'from-orange-500 to-amber-500' },
  { id: 6, icon: Heart, label: 'Family-friendly dining', query: 'kid friendly family restaurant', gradient: 'from-green-500 to-lime-500' },
];

export default function AISearchSuggestions({ show, onSelect }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50"
        >
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-slate-700">AI Search Suggestions</span>
          </div>
          <div className="grid gap-2">
            {SUGGESTIONS.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <button
                  key={suggestion.id}
                  onClick={() => onSelect(suggestion.query)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-all group text-left"
                >
                  <div className={cn("w-8 h-8 rounded-full bg-gradient-to-r flex items-center justify-center", suggestion.gradient)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    {suggestion.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
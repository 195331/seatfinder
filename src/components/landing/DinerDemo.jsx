import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Star, Users, CheckCircle } from 'lucide-react';

const LOOP_DURATION = 10000; // 10 seconds

export default function DinerDemo({ shouldReduceMotion }) {
  const [step, setStep] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const sequence = async () => {
      // Step 1: Type search
      setStep(1);
      await typeText('italian near me', setSearchText, 50);
      await wait(500);

      // Step 2: Show filters
      setStep(2);
      setShowFilters(true);
      await wait(1000);

      // Step 3: Show restaurant detail
      setStep(3);
      setShowDetail(true);
      await wait(1500);

      // Step 4: Join waitlist
      setStep(4);
      setShowToast(true);
      await wait(1500);

      // Reset
      setShowToast(false);
      setShowDetail(false);
      setShowFilters(false);
      setSearchText('');
      setStep(0);
      await wait(500);
    };

    const loop = setInterval(sequence, LOOP_DURATION);
    sequence();

    return () => clearInterval(loop);
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) {
    return (
      <div className="w-full h-full bg-slate-50 p-8">
        <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80" alt="Restaurant" className="w-full h-full object-cover rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 overflow-hidden">
      {/* Search Bar */}
      <div className="p-6 bg-white border-b">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchText}
            readOnly
            className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-full text-slate-900 font-medium"
            placeholder="Search restaurants..."
          />
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-3 flex gap-2"
          >
            {['Outdoor', '$$', 'Chill'].map((filter, i) => (
              <motion.div
                key={filter}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
              >
                {filter}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restaurant Cards */}
      <div className="p-6 space-y-4">
        {[
          { name: 'Bella Vista', status: 'chill', color: 'emerald', available: 12, total: 20 },
          { name: 'Casa Mia', status: 'moderate', color: 'amber', available: 4, total: 18 },
          { name: 'Trattoria', status: 'packed', color: 'red', available: 0, total: 15 }
        ].map((restaurant, i) => (
          <motion.div
            key={restaurant.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: showFilters ? 0.3 + i * 0.1 : 0 }}
            className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>4.5</span>
                  <span>•</span>
                  <span>Italian</span>
                  <span>•</span>
                  <span>Downtown</span>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                restaurant.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                restaurant.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {restaurant.status === 'chill' ? '🟢 Chill' : restaurant.status === 'moderate' ? '🟡 Moderate' : '🔴 Packed'}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {restaurant.available} / {restaurant.total} seats
              </span>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 bg-emerald-500 rounded-full"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Slide In */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-0 bg-white"
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Bella Vista</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Seating Status</p>
                    <p className="text-lg font-semibold text-emerald-700">12 / 20 seats available</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold"
                >
                  Join Waitlist
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-6 right-6 bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">You're on the waitlist! Est. wait: 15 min</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

async function typeText(text, setter, delay) {
  for (let i = 0; i <= text.length; i++) {
    setter(text.slice(0, i));
    await wait(delay);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
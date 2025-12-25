import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles } from 'lucide-react';

const LOOP_DURATION = 10000;

export default function OwnerDemo({ shouldReduceMotion }) {
  const [step, setStep] = useState(0);
  const [tables, setTables] = useState([]);
  const [showPublish, setShowPublish] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const sequence = async () => {
      // Step 1: Draw area
      setStep(1);
      await wait(500);

      // Step 2: Add tables
      setStep(2);
      setTables([
        { id: 1, x: 20, y: 20, type: '2-top', rotation: 0 },
        { id: 2, x: 50, y: 20, type: '4-top', rotation: 0 }
      ]);
      await wait(800);

      // Step 3: Add more tables
      setTables(prev => [...prev, { id: 3, x: 20, y: 50, type: 'booth', rotation: 0 }]);
      await wait(800);

      // Step 4: Rotate one
      setTables(prev => prev.map(t => t.id === 2 ? { ...t, rotation: 45 } : t));
      await wait(800);

      // Step 5: Publish
      setStep(5);
      setShowPublish(true);
      await wait(1000);

      // Step 6: Success
      setShowSuccess(true);
      await wait(2000);

      // Reset
      setShowSuccess(false);
      setShowPublish(false);
      setTables([]);
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
        <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80" alt="Restaurant" className="w-full h-full object-cover rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b">
        <h3 className="text-lg font-semibold">Floor Plan Builder</h3>
        <p className="text-sm text-slate-500">Drag, drop, and rotate tables</p>
      </div>

      {/* Canvas */}
      <div className="p-6">
        <div className="relative w-full aspect-[4/3] bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden">
          {/* Area Outline */}
          <AnimatePresence>
            {step >= 1 && (
              <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1 }}
                className="absolute inset-4 border-2 border-emerald-300 rounded-lg bg-emerald-50/30"
              />
            )}
          </AnimatePresence>

          {/* Tables */}
          <AnimatePresence>
            {tables.map((table) => (
              <motion.div
                key={table.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  rotate: table.rotation,
                  x: `${table.x}%`,
                  y: `${table.y}%`
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="absolute"
                style={{ transformOrigin: 'center' }}
              >
                <div className={`${
                  table.type === 'booth' ? 'w-20 h-12 bg-purple-500' :
                  table.type === '4-top' ? 'w-16 h-16 bg-blue-500 rounded-full' :
                  'w-12 h-12 bg-emerald-500 rounded-full'
                } flex items-center justify-center text-white text-xs font-semibold shadow-lg`}>
                  {table.type === 'booth' ? 'Booth' : table.type === '4-top' ? '4' : '2'}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Label Animation */}
          {tables.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 px-3 py-1 bg-white rounded-full text-xs font-medium shadow-md"
            >
              {tables.length} table{tables.length !== 1 ? 's' : ''}
            </motion.div>
          )}
        </div>

        {/* Publish Button */}
        <AnimatePresence>
          {showPublish && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Publish Floor Plan
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">You're live!</h3>
              <p className="text-slate-600">Diners can now see your restaurant</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
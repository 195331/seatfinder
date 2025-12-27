import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle, ArrowRight, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function WowMoment() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const sequence = async () => {
      await wait(1000);
      setStep(1); // Draw floor plan
      await wait(1500);
      setStep(2); // Add tables
      await wait(1500);
      setStep(3); // Publish
      await wait(500);
      
      // Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      await wait(1000);
      setStep(4); // Show in search
      await wait(3000);
      setStep(0); // Reset
    };

    const loop = setInterval(sequence, 12000);
    sequence();

    return () => clearInterval(loop);
  }, []);

  return (
    <div className="relative py-32 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            Publish → Live instantly
          </h2>
          <p className="text-xl text-emerald-200">
            No waiting. No approval. Just magic.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Owner View */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-white text-sm font-medium">Owner Dashboard</span>
            </div>
            <div className="p-8 bg-slate-50 h-[500px] relative">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center h-full"
                  >
                    <div className="text-center">
                      <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">Start building your floor plan</p>
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="drawing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <motion.div
                      initial={{ width: 0, height: 0 }}
                      animate={{ width: 300, height: 200 }}
                      transition={{ duration: 1 }}
                      className="border-4 border-emerald-500 rounded-2xl"
                      style={{ borderStyle: 'dashed' }}
                    >
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="p-4"
                      >
                        <p className="text-sm text-slate-600 font-medium">Main Dining</p>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {step >= 2 && (
                  <motion.div
                    key="tables"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative"
                  >
                    <div className="border-4 border-emerald-500 rounded-2xl w-[300px] h-[200px] p-4 relative">
                      <p className="text-sm text-slate-600 font-medium mb-4">Main Dining</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((table, i) => (
                          <motion.div
                            key={table}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: i * 0.1, type: "spring" }}
                            className="w-16 h-16 bg-emerald-100 border-2 border-emerald-500 rounded-lg flex items-center justify-center"
                          >
                            <span className="text-xs font-semibold text-emerald-700">T{table}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {step === 3 && (
                      <motion.button
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-8 w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-5 h-5" />
                        Publish Floor Plan
                        <ArrowRight className="w-5 h-5" />
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Diner View */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-white text-sm font-medium">Search Results</span>
            </div>
            <div className="p-8 bg-slate-50 h-[500px] flex items-center justify-center relative">
              <AnimatePresence mode="wait">
                {step < 4 ? (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-slate-500">Waiting for new restaurants...</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="appeared"
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="w-full"
                  >
                    <motion.div
                      animate={{ boxShadow: ["0px 4px 20px rgba(16, 185, 129, 0.2)", "0px 4px 40px rgba(16, 185, 129, 0.4)", "0px 4px 20px rgba(16, 185, 129, 0.2)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="bg-white rounded-2xl p-6 border-2 border-emerald-500"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">Your Restaurant</h3>
                          <p className="text-sm text-slate-600">Italian • Downtown</p>
                        </div>
                        <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          LIVE
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">6 / 6 tables ready</span>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="w-3 h-3 bg-emerald-500 rounded-full"
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
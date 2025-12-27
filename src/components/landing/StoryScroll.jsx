import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Search, Filter, Heart, Users, CheckCircle, Sparkles } from 'lucide-react';

const steps = [
  {
    id: 1,
    icon: Search,
    title: 'Search',
    description: 'Find restaurants by name, vibe, or craving',
    demo: 'search'
  },
  {
    id: 2,
    icon: Filter,
    title: 'Filter',
    description: 'Pick your mood—chill, moderate, or lively',
    demo: 'filter'
  },
  {
    id: 3,
    icon: Heart,
    title: 'Discover',
    description: 'See live seating status in real-time',
    demo: 'discover'
  },
  {
    id: 4,
    icon: Users,
    title: 'Join Waitlist',
    description: 'Get in line with a tap—no calls needed',
    demo: 'waitlist'
  },
  {
    id: 5,
    icon: CheckCircle,
    title: 'Get Seated',
    description: 'Receive SMS when your table is ready',
    demo: 'seated'
  },
];

export default function StoryScroll() {
  const containerRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const progress = useTransform(scrollYProgress, [0, 1], [0, steps.length - 1]);

  useEffect(() => {
    return progress.onChange(v => {
      setActiveStep(Math.round(v));
    });
  }, [progress]);

  return (
    <div ref={containerRef} className="relative py-32">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl font-bold text-slate-900 mb-4">
            How it works
          </h2>
          <p className="text-xl text-slate-600">
            From search to seated in minutes
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Steps */}
          <div className="space-y-12 relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-slate-200">
              <motion.div
                className="absolute top-0 left-0 w-full bg-emerald-500"
                style={{
                  height: `${(activeStep / (steps.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isPast = index < activeStep;

              return (
                <motion.div
                  key={step.id}
                  className={`flex gap-6 items-start relative transition-all duration-500 ${
                    isActive ? 'opacity-100 scale-100' : 'opacity-50 scale-95'
                  }`}
                >
                  {/* Icon Circle */}
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 
                    isPast ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}>
                    <Icon className={`w-6 h-6 ${isActive || isPast ? 'text-white' : 'text-slate-500'}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <h3 className={`text-2xl font-bold mb-2 transition-colors ${
                      isActive ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-lg transition-colors ${
                      isActive ? 'text-slate-600' : 'text-slate-500'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right: Animated Demo */}
          <div className="relative lg:sticky lg:top-32 lg:h-[600px]">
            <DemoScreen step={steps[activeStep]?.demo} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoScreen({ step }) {
  return (
    <div className="relative">
      {/* Phone Mockup */}
      <div className="relative mx-auto w-full max-w-sm">
        <div className="bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
          {/* Screen */}
          <div className="bg-white rounded-[2.5rem] overflow-hidden aspect-[9/19] relative">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 p-6 bg-slate-50"
            >
              {step === 'search' && <SearchDemo />}
              {step === 'filter' && <FilterDemo />}
              {step === 'discover' && <DiscoverDemo />}
              {step === 'waitlist' && <WaitlistDemo />}
              {step === 'seated' && <SeatedDemo />}
            </motion.div>
          </div>
        </div>

        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-3xl -z-10" />
      </div>
    </div>
  );
}

function SearchDemo() {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          className="w-full pl-12 pr-4 py-3 bg-white rounded-full border-2 border-emerald-500 text-slate-900 font-medium shadow-sm"
          placeholder="italian near me"
          readOnly
        />
      </div>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-slate-500 px-4"
      >
        ✨ AI-powered search understands your mood
      </motion.div>
    </div>
  );
}

function FilterDemo() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['🟢 Chill', '💵 $$', '🍝 Italian', '🌳 Outdoor'].map((filter, i) => (
          <motion.div
            key={filter}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold"
          >
            {filter}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DiscoverDemo() {
  return (
    <div className="space-y-3">
      {[
        { name: 'Bella Vista', status: '🟢 Chill', seats: '12/20' },
        { name: 'Casa Mia', status: '🟡 Moderate', seats: '4/18' },
      ].map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.2 }}
          className="bg-white rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{r.name}</h4>
              <p className="text-sm text-slate-600">{r.seats} seats</p>
            </div>
            <span className="text-xs font-semibold">{r.status}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WaitlistDemo() {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-emerald-50 rounded-2xl p-6 text-center space-y-4"
    >
      <Users className="w-12 h-12 text-emerald-600 mx-auto" />
      <div>
        <h4 className="font-bold text-lg mb-1">Join Waitlist</h4>
        <p className="text-sm text-slate-600">Est. wait: 15 minutes</p>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold"
      >
        Confirm
      </motion.button>
    </motion.div>
  );
}

function SeatedDemo() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-center text-white space-y-4"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <CheckCircle className="w-16 h-16 mx-auto" />
      </motion.div>
      <div>
        <h4 className="font-bold text-xl mb-2">You're next!</h4>
        <p className="text-sm opacity-90">Your table is ready in 2 minutes</p>
      </div>
    </motion.div>
  );
}
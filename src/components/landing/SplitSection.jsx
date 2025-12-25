import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function SplitSection() {
  const [activeView, setActiveView] = useState('diners'); // diners | owners

  const content = {
    diners: {
      title: 'For Diners',
      bullets: [
        'See who's chill right now',
        'Join waitlist in seconds',
        'Find the vibe you want'
      ],
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'
    },
    owners: {
      title: 'For Owners',
      bullets: [
        'Design your floor plan',
        'Update seating instantly',
        'See peak hours + trends'
      ],
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80'
    }
  };

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-white rounded-full p-1 shadow-md">
          <button
            onClick={() => setActiveView('diners')}
            className={`px-8 py-3 rounded-full text-sm font-medium transition-all ${
              activeView === 'diners'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            For Diners
          </button>
          <button
            onClick={() => setActiveView('owners')}
            className={`px-8 py-3 rounded-full text-sm font-medium transition-all ${
              activeView === 'owners'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            For Owners
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Left: Active Side */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <h2 className="text-4xl font-bold text-slate-900">{content[activeView].title}</h2>
          <ul className="space-y-4">
            {content[activeView].bullets.map((bullet, i) => (
              <motion.li
                key={bullet}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-lg text-slate-700">{bullet}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Right: Image */}
        <motion.div
          key={`${activeView}-img`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <img
            src={content[activeView].image}
            alt={content[activeView].title}
            className="w-full aspect-[4/3] object-cover rounded-2xl shadow-xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
        </motion.div>
      </div>
    </div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Users, BarChart3, Heart, MapPin, Calendar } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Live crowd status', color: 'emerald' },
  { icon: MapPin, title: 'Owner-built floor plans', color: 'blue' },
  { icon: Users, title: 'Waitlist + reservations', color: 'purple' },
  { icon: Calendar, title: 'Smart filters', color: 'amber' },
  { icon: BarChart3, title: 'AI insights', color: 'indigo' },
  { icon: Heart, title: 'Favorites & alerts', color: 'pink' },
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
      {features.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            whileHover={{ 
              y: -8, 
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
              transition: { duration: 0.2 }
            }}
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-2xl transition-all cursor-pointer group"
          >
            <motion.div 
              className={`w-12 h-12 bg-${feature.color}-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
            >
              <Icon className={`w-6 h-6 text-${feature.color}-600`} />
            </motion.div>
            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
          </motion.div>
        );
      })}
    </div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';

const foodItems = [
  { emoji: '🍕', size: 120, top: '10%', left: '5%', delay: 0 },
  { emoji: '🍝', size: 100, top: '15%', right: '8%', delay: 0.5 },
  { emoji: '🍷', size: 110, bottom: '20%', left: '7%', delay: 1 },
  { emoji: '🥗', size: 90, top: '55%', right: '6%', delay: 1.5 },
  { emoji: '🍔', size: 105, bottom: '12%', right: '12%', delay: 2 },
  { emoji: '🍣', size: 95, top: '40%', left: '10%', delay: 2.5 },
  { emoji: '🍰', size: 85, bottom: '40%', right: '20%', delay: 3 },
  { emoji: '🍜', size: 100, top: '70%', left: '15%', delay: 3.5 },
];

export default function FloatingFood({ size = 'normal' }) {
  const sizeMultiplier = size === 'large' ? 1.3 : 1;
  const opacity = size === 'large' ? 0.15 : 0.2;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {foodItems.map((item, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            fontSize: `${item.size * sizeMultiplier}px`,
            opacity: opacity,
            top: item.top,
            bottom: item.bottom,
            left: item.left,
            right: item.right,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            rotate: [0, 8, -8, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            delay: item.delay,
            ease: 'easeInOut',
          }}
        >
          {item.emoji}
        </motion.div>
      ))}
      
      {/* Gradient Blobs */}
      <motion.div
        className="absolute w-96 h-96 bg-gradient-to-r from-emerald-300/20 to-teal-300/20 rounded-full blur-3xl"
        style={{ top: '20%', left: '-10%' }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-96 h-96 bg-gradient-to-r from-purple-300/20 to-pink-300/20 rounded-full blur-3xl"
        style={{ bottom: '10%', right: '-10%' }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />
    </div>
  );
}
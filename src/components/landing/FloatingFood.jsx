import React from 'react';
import { motion } from 'framer-motion';

const foodItems = [
  { emoji: '🍕', size: 80, top: '10%', left: '5%', delay: 0 },
  { emoji: '🍝', size: 60, top: '20%', right: '10%', delay: 0.5 },
  { emoji: '🍷', size: 70, bottom: '25%', left: '8%', delay: 1 },
  { emoji: '🥗', size: 50, top: '60%', right: '5%', delay: 1.5 },
  { emoji: '🍔', size: 65, bottom: '15%', right: '15%', delay: 2 },
];

export default function FloatingFood() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {foodItems.map((item, i) => (
        <motion.div
          key={i}
          className="absolute opacity-20"
          style={{
            fontSize: `${item.size}px`,
            top: item.top,
            bottom: item.bottom,
            left: item.left,
            right: item.right,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 8,
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
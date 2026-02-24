import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// High-quality food images with transparency
const FOOD_ITEMS = [
  {
    url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=90',
    alt: 'Pizza',
    size: 120,
    blur: false
  },
  {
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=90',
    alt: 'Salad Bowl',
    size: 100,
    blur: false
  },
  {
    url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=90',
    alt: 'Pancakes',
    size: 110,
    blur: false
  },
  {
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=90',
    alt: 'Pasta',
    size: 130,
    blur: false
  },
  {
    url: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&q=90',
    alt: 'Avocado Toast',
    size: 90,
    blur: false
  },
  {
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&q=90',
    alt: 'Burger',
    size: 115,
    blur: false
  }
];

export default function FloatingFood3D({ size = 'large' }) {
  const positions = size === 'large' ? [
    { top: '10%', left: '5%', delay: 0 },
    { top: '15%', right: '8%', delay: 0.5 },
    { top: '40%', left: '3%', delay: 1 },
    { top: '50%', right: '5%', delay: 1.5 },
    { top: '70%', left: '10%', delay: 2 },
    { top: '75%', right: '12%', delay: 2.5 }
  ] : [
    { top: '20%', left: '5%', delay: 0 },
    { top: '30%', right: '8%', delay: 0.8 },
    { top: '60%', left: '10%', delay: 1.6 }
  ];

  return (
    <>
      {FOOD_ITEMS.slice(0, positions.length).map((item, idx) => (
        <motion.div
          key={idx}
          className="absolute pointer-events-none z-0"
          style={{
            ...positions[idx],
            width: item.size,
            height: item.size
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: 0.4, 
            scale: 1,
            y: [0, -15, 0]
          }}
          transition={{
            opacity: { duration: 0.8, delay: positions[idx].delay },
            scale: { duration: 0.8, delay: positions[idx].delay },
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: positions[idx].delay
            }
          }}
        >
          <img
            src={item.url}
            alt={item.alt}
            className={cn(
              "w-full h-full object-cover rounded-full shadow-2xl",
              item.blur && "blur-sm"
            )}
          />
        </motion.div>
      ))}
    </>
  );
}
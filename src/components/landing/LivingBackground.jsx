import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function LivingBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let time = 0;
    
    const animate = () => {
      time += 0.005;
      
      // Create subtle gradient blobs
      const gradient1 = ctx.createRadialGradient(
        canvas.width * 0.3 + Math.sin(time) * 100,
        canvas.height * 0.4 + Math.cos(time) * 80,
        0,
        canvas.width * 0.3,
        canvas.height * 0.4,
        canvas.width * 0.6
      );
      gradient1.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
      gradient1.addColorStop(1, 'rgba(16, 185, 129, 0)');

      const gradient2 = ctx.createRadialGradient(
        canvas.width * 0.7 + Math.cos(time * 0.8) * 120,
        canvas.height * 0.6 + Math.sin(time * 0.8) * 100,
        0,
        canvas.width * 0.7,
        canvas.height * 0.6,
        canvas.width * 0.5
      );
      gradient2.addColorStop(0, 'rgba(20, 184, 166, 0.06)');
      gradient2.addColorStop(1, 'rgba(20, 184, 166, 0)');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Animated Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
      />
      
      {/* Grain Texture Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Floating Icons */}
      <FloatingIcons />
    </>
  );
}

function FloatingIcons() {
  const icons = [
    { emoji: '☕', delay: 0, duration: 25, x: 15, y: 20 },
    { emoji: '🌶️', delay: 3, duration: 30, x: 75, y: 15 },
    { emoji: '✨', delay: 6, duration: 28, x: 85, y: 60 },
    { emoji: '🍕', delay: 2, duration: 35, x: 10, y: 70 },
    { emoji: '🥗', delay: 8, duration: 32, x: 50, y: 10 },
    { emoji: '🍷', delay: 4, duration: 27, x: 90, y: 80 },
  ];

  return (
    <>
      {icons.map((icon, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl opacity-10 pointer-events-none"
          style={{
            left: `${icon.x}%`,
            top: `${icon.y}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            rotate: [-5, 5, -5],
          }}
          transition={{
            duration: icon.duration,
            repeat: Infinity,
            delay: icon.delay,
            ease: "easeInOut"
          }}
        >
          {icon.emoji}
        </motion.div>
      ))}
    </>
  );
}
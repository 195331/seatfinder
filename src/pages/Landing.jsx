import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowRight, Zap, Users, BarChart3, Heart, Sparkles, MapPin } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import MacBookDemo from '@/components/landing/MacBookDemo';
import FloatingFood from '@/components/landing/FloatingFood';
import FeatureCards from '@/components/landing/FeatureCards';
import SplitSection from '@/components/landing/SplitSection';

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('diner'); // diner | owner
  const [activeSection, setActiveSection] = useState('hero');
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'split', 'cta'];
      const scrollPos = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPos >= offsetTop && scrollPos < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const headlines = {
    diner: {
      title: "See who's open. Skip the wait.",
      subtitle: "Real-time seating status from restaurants near you. Join waitlists, reserve tables, find your vibe—all in seconds."
    },
    owner: {
      title: "Your floor plan. Live updates. Zero calls.",
      subtitle: "Design your layout, update seating instantly, and let diners find you. No app installs, no complicated setup."
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 overflow-x-hidden">
      {/* Sticky Mini Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-bold text-xl">SeatFinder</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {[
                { id: 'hero', label: 'Home' },
                { id: 'features', label: 'Features' },
                { id: 'split', label: 'How it Works' },
                { id: 'cta', label: 'Get Started' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    activeSection === item.id ? "text-emerald-600" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button onClick={() => navigate(createPageUrl('Home'))} className="bg-emerald-600 hover:bg-emerald-700">
              Launch App
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center py-20 overflow-hidden">
        {/* Floating Food Background */}
        {!shouldReduceMotion && <FloatingFood />}

        <div className="max-w-7xl mx-auto px-4 w-full relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div layout className="space-y-6">
                <motion.h1 
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight"
                >
                  {headlines[activeTab].title}
                </motion.h1>
                <motion.p 
                  key={`${activeTab}-sub`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl text-slate-600 leading-relaxed"
                >
                  {headlines[activeTab].subtitle}
                </motion.p>

                {/* CTAs */}
                <div className="flex flex-wrap gap-4 pt-4">
                  <Button
                    onClick={() => navigate(createPageUrl('Home'))}
                    size="lg"
                    className={cn(
                      "gap-2 h-14 px-8 text-lg",
                      activeTab === 'diner' ? "bg-emerald-600 hover:bg-emerald-700 scale-105" : "bg-slate-900 hover:bg-slate-800"
                    )}
                  >
                    <MapPin className="w-5 h-5" />
                    Find a Table
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() => navigate(createPageUrl('CreateRestaurant'))}
                    variant="outline"
                    size="lg"
                    className={cn(
                      "gap-2 h-14 px-8 text-lg",
                      activeTab === 'owner' && "border-emerald-600 text-emerald-600 hover:bg-emerald-50 scale-105"
                    )}
                  >
                    <Sparkles className="w-5 h-5" />
                    Start Free Trial
                  </Button>
                </div>

                {/* Trust Line */}
                <p className="text-sm text-slate-500 pt-2">
                  No app needed to browse • Owners can publish in minutes
                </p>
              </motion.div>
            </motion.div>

            {/* Right: Demo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {/* Tab Toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-slate-100 rounded-full p-1">
                  <button
                    onClick={() => setActiveTab('diner')}
                    className={cn(
                      "px-6 py-3 rounded-full text-sm font-medium transition-all",
                      activeTab === 'diner' 
                        ? "bg-white shadow-md text-slate-900" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Diner View
                  </button>
                  <button
                    onClick={() => setActiveTab('owner')}
                    className={cn(
                      "px-6 py-3 rounded-full text-sm font-medium transition-all",
                      activeTab === 'owner' 
                        ? "bg-white shadow-md text-slate-900" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Owner View
                  </button>
                </div>
              </div>

              {/* MacBook Demo */}
              <MacBookDemo activeTab={activeTab} shouldReduceMotion={shouldReduceMotion} />
            </motion.div>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none" />
      </section>

      {/* Feature Cards */}
      <section id="features" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Everything you need, nothing you don't</h2>
            <p className="text-xl text-slate-600">Built for speed, designed for trust</p>
          </motion.div>
          <FeatureCards />
        </div>
      </section>

      {/* Split Section */}
      <section id="split" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <SplitSection />
        </div>
      </section>

      {/* Final CTA */}
      <section id="cta" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl font-bold text-slate-900 mb-6">
              Ready to skip the wait?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Join restaurants and diners using SeatFinder today
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={() => navigate(createPageUrl('Home'))}
                size="lg"
                className="gap-2 h-16 px-10 text-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <MapPin className="w-6 h-6" />
                Find Restaurants Near You
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('CreateRestaurant'))}
                variant="outline"
                size="lg"
                className="gap-2 h-16 px-10 text-lg"
              >
                <Sparkles className="w-6 h-6" />
                List Your Restaurant
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-600">
          <p>© 2025 SeatFinder. Skip the wait, find your table.</p>
        </div>
      </footer>
    </div>
  );
}
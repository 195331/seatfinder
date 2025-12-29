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
import LivingBackground from '@/components/landing/LivingBackground';
import StoryScroll from '@/components/landing/StoryScroll';
import WowMoment from '@/components/landing/WowMoment';
import SocialProof from '@/components/landing/SocialProof';
import ConversionPanel from '@/components/landing/ConversionPanel';

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
    <div className="min-h-screen bg-white overflow-x-hidden relative">
      {/* Sticky Mini Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-300 hover:bg-white/90">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="font-bold text-xl">SeatFinder</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {[
                { id: 'hero', label: 'Home' },
                { id: 'features', label: 'Features' },
                { id: 'split', label: 'How it Works' },
                { id: 'reviews', label: 'Reviews' },
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
            <Button 
              onClick={() => {
                sessionStorage.setItem('browsing_as_guest', 'true');
                navigate(createPageUrl('Home'));
              }} 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:shadow-purple-500/30 transition-all rounded-full px-6"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center py-20 overflow-hidden">
        {/* Glowing Aura Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-br from-purple-500/30 to-blue-500/30 blur-[100px] rounded-full pointer-events-none animate-pulse" />

        {/* Floating Food Images - Bigger */}
        {!shouldReduceMotion && <FloatingFood size="large" />}

        <div className="max-w-6xl mx-auto px-4 w-full relative z-10">
          <div className="text-center space-y-8">
            {/* Tab Toggle - Centered at Top */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <div className="inline-flex bg-slate-100/80 backdrop-blur-sm rounded-full p-1.5 border border-slate-200/50">
                <button
                  onClick={() => setActiveTab('diner')}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 relative overflow-hidden",
                    activeTab === 'diner' 
                      ? "bg-white shadow-lg text-slate-900" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {activeTab === 'diner' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white rounded-full"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    For Diners
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('owner')}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 relative overflow-hidden",
                    activeTab === 'owner' 
                      ? "bg-white shadow-lg text-slate-900" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {activeTab === 'owner' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white rounded-full"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    For Owners
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Centered Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6 max-w-4xl mx-auto"
            >
              <motion.h1 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-bold leading-tight"
              >
                <span className="text-slate-900">
                  {activeTab === 'diner' ? 'Find Your' : 'Transform Your'}
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {activeTab === 'diner' ? 'Perfect Table' : 'Restaurant'}
                </span>
              </motion.h1>
              
              <motion.p 
                key={`${activeTab}-sub`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto"
              >
                {headlines[activeTab].subtitle}
              </motion.p>

              {/* CTAs */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-4 justify-center pt-4"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => {
                      sessionStorage.setItem('browsing_as_guest', 'true');
                      navigate(createPageUrl('Home'));
                    }}
                    size="lg"
                    className="gap-2 h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl hover:shadow-2xl shadow-purple-500/30 transition-all rounded-full"
                  >
                    {activeTab === 'diner' ? 'Start Exploring' : 'Start Automating'}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => scrollToSection('split')}
                    variant="outline"
                    size="lg"
                    className="gap-2 h-14 px-8 text-lg border-slate-300 hover:bg-slate-50 rounded-full"
                  >
                    Watch Demo
                  </Button>
                </motion.div>
              </motion.div>

              {/* Trust Line */}
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-slate-500 pt-2"
              >
                ✨ No credit card required • 🚀 Get started in 2 minutes
              </motion.p>
            </motion.div>

            {/* MacBook Demo - Centered Below */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-12"
            >
              <MacBookDemo activeTab={activeTab} shouldReduceMotion={shouldReduceMotion} />
            </motion.div>
          </div>
        </div>
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

      {/* Story Scroll */}
      <section className="bg-white">
        <StoryScroll />
      </section>

      {/* Wow Moment */}
      <WowMoment />

      {/* Reviews Section */}
      <section id="reviews" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Loved by <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Diners & Owners</span>
            </h2>
            <p className="text-xl text-slate-600">See what people are saying about SeatFinder</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Sarah Chen",
                role: "Food Enthusiast",
                avatar: "SC",
                rating: 5,
                text: "Game changer! I can see which restaurants have tables available RIGHT NOW. No more calling around or waiting 2 hours for a text.",
                color: "from-pink-500 to-rose-500"
              },
              {
                name: "Marcus Rodriguez",
                role: "Restaurant Owner",
                avatar: "MR",
                rating: 5,
                text: "We went from 20 calls a night to zero. Customers find us, see our availability, and book instantly. Our no-show rate dropped by 40%.",
                color: "from-blue-500 to-cyan-500"
              },
              {
                name: "Emily Watson",
                role: "Date Night Regular",
                avatar: "EW",
                rating: 5,
                text: "The AI recommendations are spot-on! It suggested a hidden gem I'd never heard of based on my taste. Now it's my favorite spot.",
                color: "from-purple-500 to-pink-500"
              },
              {
                name: "David Kim",
                role: "Bistro Owner",
                avatar: "DK",
                rating: 5,
                text: "Setup took 10 minutes. The floor plan builder is intuitive, and now we're getting 3x more reservations. Best decision we made this year.",
                color: "from-emerald-500 to-teal-500"
              },
              {
                name: "Jessica Park",
                role: "Busy Professional",
                avatar: "JP",
                rating: 5,
                text: "Perfect for lunch breaks! I check the app, see who has tables near my office, and I'm seated in 5 minutes. Saves me so much time.",
                color: "from-amber-500 to-orange-500"
              },
              {
                name: "Alex Thompson",
                role: "Fine Dining Owner",
                avatar: "AT",
                rating: 5,
                text: "The loyalty program and pre-order features are incredible. Our regulars love earning points, and kitchen prep is smoother than ever.",
                color: "from-indigo-500 to-purple-500"
              },
              {
                name: "Rachel Moore",
                role: "Weekend Explorer",
                avatar: "RM",
                rating: 5,
                text: "The mood boards are genius! I created one for date nights and another for brunch spots. Planning outings is so much easier now.",
                color: "from-rose-500 to-pink-500"
              },
              {
                name: "James Wilson",
                role: "Cafe Owner",
                avatar: "JW",
                rating: 5,
                text: "Real-time updates are a lifesaver. We update our seating during rush hour and customers can see it instantly. No more disappointed walk-ins.",
                color: "from-cyan-500 to-blue-500"
              },
              {
                name: "Maya Patel",
                role: "Foodie Influencer",
                avatar: "MP",
                rating: 5,
                text: "I've tried every restaurant app out there. SeatFinder is the only one that shows LIVE availability. It's authentic, not fake 'availability'.",
                color: "from-violet-500 to-purple-500"
              }
            ].map((review, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold", review.color)}>
                      {review.avatar}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{review.name}</h4>
                      <p className="text-sm text-slate-600">{review.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed">"{review.text}"</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <SocialProof />

      {/* Final CTA */}
      <section id="cta" className="py-32 relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-slate-900">Ready to</span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Get Started?
              </span>
            </h2>
            <p className="text-xl text-slate-600 mb-10">
              Join thousands of restaurants and diners using SeatFinder today
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={() => {
                  sessionStorage.setItem('browsing_as_guest', 'true');
                  navigate(createPageUrl('Home'));
                }}
                size="lg"
                className="gap-2 h-16 px-10 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl hover:shadow-2xl shadow-purple-500/30 rounded-full"
              >
                <MapPin className="w-6 h-6" />
                Start Exploring Now
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('CreateRestaurant'))}
                variant="outline"
                size="lg"
                className="gap-2 h-16 px-10 text-lg border-2 rounded-full hover:bg-slate-50"
              >
                <Sparkles className="w-6 h-6" />
                List Your Restaurant
              </Button>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              ✨ No credit card required • 🚀 Set up in minutes
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-600">
          <p>© 2025 SeatFinder. Skip the wait, find your table.</p>
        </div>
      </footer>

      {/* Conversion Panel */}
      <ConversionPanel />
    </div>
  );
}
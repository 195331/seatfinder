import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Sparkles, Mail, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

export default function ConversionPanel() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [role, setRole] = useState(null); // null | 'diner' | 'owner'
  const [step, setStep] = useState(1); // 1 | 2

  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > 70 && !isVisible) {
        setIsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isVisible]);

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setStep(2);
  };

  const handleContinue = (method) => {
    if (method === 'guest') {
      sessionStorage.setItem('browsing_as_guest', 'true');
      navigate(createPageUrl('Home'));
    } else if (method === 'google' || method === 'email') {
      base44.auth.redirectToLogin(window.location.origin + createPageUrl(role === 'owner' ? 'CreateRestaurant' : 'Home'));
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setRole(null);
      setStep(1);
    }, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-w-2xl mx-auto"
          >
            <div className="p-8">
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>

              {/* Progress */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">
                        Let's get you started
                      </h3>
                      <p className="text-slate-600">
                        Choose your role to continue
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02, boxShadow: "0 10px 40px rgba(16, 185, 129, 0.2)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRoleSelect('diner')}
                        className="p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all text-left group"
                      >
                        <MapPin className="w-10 h-10 text-emerald-600 mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-xl font-bold text-slate-900 mb-1">I'm a Diner</h4>
                        <p className="text-sm text-slate-600">Find restaurants & skip the wait</p>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, boxShadow: "0 10px 40px rgba(16, 185, 129, 0.2)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRoleSelect('owner')}
                        className="p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all text-left group"
                      >
                        <Sparkles className="w-10 h-10 text-emerald-600 mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-xl font-bold text-slate-900 mb-1">I'm an Owner</h4>
                        <p className="text-sm text-slate-600">List my restaurant for free</p>
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">
                        {role === 'diner' ? 'Find your table' : 'Start your free trial'}
                      </h3>
                      <p className="text-slate-600">
                        {role === 'diner' ? 'Sign in or browse as guest' : 'Create your account to get started'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={() => handleContinue('google')}
                        className="w-full h-14 text-lg gap-3 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </Button>

                      <Button
                        onClick={() => handleContinue('email')}
                        variant="outline"
                        className="w-full h-14 text-lg gap-3"
                      >
                        <Mail className="w-6 h-6" />
                        Continue with Email
                      </Button>

                      {role === 'diner' && (
                        <>
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                              <span className="px-2 bg-white text-slate-500">or</span>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleContinue('guest')}
                            variant="ghost"
                            className="w-full h-14 text-lg"
                          >
                            Browse as Guest
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </Button>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      ← Back
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
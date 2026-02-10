import React, { useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, Calendar, Clock, Users, Sparkles, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function ReservationSuccess({ 
  open, 
  onClose, 
  reservation, 
  restaurantName,
  instantConfirmed = false 
}) {
  useEffect(() => {
    if (open) {
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  }, [open]);

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white text-center relative overflow-hidden">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="relative z-10"
          >
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <PartyPopper className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {instantConfirmed ? "Reservation Confirmed!" : "Request Sent!"}
            </h2>
            <p className="text-emerald-50">
              {instantConfirmed 
                ? "Your table is ready and waiting for you!" 
                : "The restaurant will review and confirm your reservation"}
            </p>
          </motion.div>
          
          {/* Decorative elements */}
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"
          />
          <motion.div
            animate={{ 
              rotate: -360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full"
          />
        </div>

        {/* Details */}
        <div className="p-8 space-y-6">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
            <h3 className="font-semibold text-emerald-900 mb-3">{restaurantName}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">{reservation.reservation_date}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">{reservation.reservation_time}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">{reservation.party_size} guests</span>
              </div>
            </div>
          </div>

          {/* Points earned */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-purple-900">+25 Points Earned!</p>
                <p className="text-sm text-purple-700">Keep making reservations to level up</p>
              </div>
            </div>
          </motion.div>

          {/* What's Next */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              What's Next?
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              {instantConfirmed ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>Your reservation is confirmed - no further action needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>You'll receive a reminder email before your visit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>Check your email for the full details</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span>The restaurant will review your request</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span>You'll be notified via email once confirmed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span>Check My Reservations to track the status</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
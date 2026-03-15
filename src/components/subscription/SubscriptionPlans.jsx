import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, Sparkles, Zap, Lock, Loader2, PartyPopper } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from 'canvas-confetti';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Basic features for small restaurants',
    features: [
      'Basic seating management',
      'Up to 20 tables',
      'Basic reservations',
      'Customer reviews'
    ],
    limitations: [
      'No analytics',
      'No AI features',
      'No waitlist management',
      'No loyalty program'
    ],
    stripeLink: null
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    description: 'Advanced tools for growing restaurants',
    features: [
      'Everything in Free',
      'Full analytics dashboard',
      'Peak demand analysis',
      'Table turnover tracking',
      'AI wait time predictions',
      'Advanced floor plan editor',
      'Waitlist management',
      'Customer loyalty program',
      'Menu management',
      'Promotions & offers',
      'SMS notifications (100/mo)',
      'Priority support'
    ],
    limitations: [],
    stripeLink: 'https://buy.stripe.com/test_pro_plan',
    popular: true
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 99,
    description: 'Full suite for premium restaurants',
    features: [
      'Everything in Pro',
      'AI table assignments',
      'AI occupancy forecasting',
      'AI review analyzer',
      'AI reservation manager',
      'AI floor plan optimizer',
      'Customer lifetime value',
      'Competitor benchmarking',
      'Loyalty analytics',
      'Custom SMS templates',
      'Unlimited SMS',
      'API access',
      'White-label options',
      'Dedicated support'
    ],
    limitations: [],
    stripeLink: 'https://buy.stripe.com/test_plus_plan'
  }
];

export default function SubscriptionPlans({ restaurantId, currentPlan = 'free' }) {
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(null);
  const [successPlan, setSuccessPlan] = useState(null);

  const { data: subscription } = useQuery({
    queryKey: ['subscription', restaurantId],
    queryFn: () => base44.entities.Subscription.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    select: (data) => data[0]
  });

  const activePlan = subscription?.plan || currentPlan;

  const handleUpgrade = async (plan) => {
    setUpgrading(plan.id);
    
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Single call: update the restaurant's subscription plan directly
      await base44.entities.Restaurant.update(restaurantId, {
        subscription_plan: plan.id,
        subscription_expires_at: expiresAt
      });

      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['ownedRestaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      queryClient.invalidateQueries({ queryKey: ['staffRestaurants'] });

      if (plan.id !== 'free') {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } }), 300);
        setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } }), 500);
        setSuccessPlan(plan);
      } else {
        toast.success('Switched to Free plan.');
      }
    } catch (error) {
      toast.error('Failed to change plan: ' + error.message);
    }
    
    setUpgrading(null);
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'pro': return <Zap className="w-5 h-5" />;
      case 'plus': return <Crown className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  if (successPlan) {
    // Show only features specific to this plan (exclude "Everything in X" lines)
    const ownFeatures = successPlan.features.filter(f => !f.startsWith('Everything in'));
    // For plus, also include pro-specific features since plus includes pro
    const proFeatures = successPlan.id === 'plus'
      ? PLANS.find(p => p.id === 'pro').features.filter(f => !f.startsWith('Everything in'))
      : [];
    const allUnlocked = successPlan.id === 'plus' ? [...proFeatures, ...ownFeatures] : ownFeatures;

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center">
          <PartyPopper className="w-12 h-12 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Welcome to {successPlan.name}! 🎉</h2>
          <p className="text-slate-500 mt-2 text-lg">Your features are now unlocked and ready to use.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg text-left">
          {allUnlocked.map((f, i) => (
            <span key={i} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm px-3 py-1.5 rounded-full border border-emerald-200">
              <Check className="w-3.5 h-3.5 shrink-0" /> {f}
            </span>
          ))}
        </div>
        <Button
          className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => setSuccessPlan(null)}
        >
          View All Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Choose Your Plan</h2>
        <p className="text-slate-500 mt-1">Unlock powerful features to grow your restaurant</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = activePlan === plan.id;
          const isUpgrade = PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === activePlan);
          
          return (
            <Card 
              key={plan.id}
              className={cn(
                "relative border-2 transition-all",
                plan.popular && "border-indigo-500 shadow-lg shadow-indigo-100",
                isCurrentPlan && "border-emerald-500 bg-emerald-50/50"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-500 text-white">Most Popular</Badge>
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-white">Current Plan</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className={cn(
                  "w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center",
                  plan.id === 'free' && "bg-slate-100 text-slate-600",
                  plan.id === 'pro' && "bg-indigo-100 text-indigo-600",
                  plan.id === 'plus' && "bg-amber-100 text-amber-600"
                )}>
                  {getPlanIcon(plan.id)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && <span className="text-slate-500">/mo</span>}
                </div>
                <p className="text-sm text-slate-500 mt-2">{plan.description}</p>
              </CardHeader>

              <CardContent className="pt-4">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation, i) => (
                    <li key={i} className="flex items-start gap-2 opacity-50">
                      <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-500">{limitation}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "w-full",
                    isCurrentPlan && "bg-emerald-600 hover:bg-emerald-700",
                    plan.popular && !isCurrentPlan && "bg-indigo-600 hover:bg-indigo-700"
                  )}
                  variant={!plan.popular && !isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan || upgrading !== null}
                  onClick={() => handleUpgrade(plan)}
                >
                  {upgrading === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Current Plan
                    </>
                  ) : isUpgrade ? (
                    `Upgrade to ${plan.name}`
                  ) : (
                    `Switch to ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Helper hook to check feature access
export function useFeatureAccess(restaurantId) {
  // Use restaurant.subscription_plan as the single source of truth
  const { data: restaurantData } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }),
    enabled: !!restaurantId,
    select: (data) => data[0],
    staleTime: 30000,
  });

  // Prefer subscription entity, fall back to restaurant.subscription_plan
  const plan = subscription?.plan || restaurantData?.subscription_plan || 'free';

  return {
    plan,
    hasAnalytics: plan === 'pro' || plan === 'plus',
    hasWaitlist: plan === 'pro' || plan === 'plus',
    hasAIFeatures: plan === 'plus',
    hasAdvancedFloorPlan: plan === 'pro' || plan === 'plus',
    hasSMS: plan === 'pro' || plan === 'plus',
    hasUnlimitedSMS: plan === 'plus',
    hasAIReservations: plan === 'plus',
    hasAIAnalyzer: plan === 'plus',
    hasLoyalty: plan === 'pro' || plan === 'plus',
    hasLoyaltyAnalytics: plan === 'plus',
    hasCLV: plan === 'plus',
    hasBenchmarking: plan === 'plus',
    hasMenu: plan === 'pro' || plan === 'plus',
    hasPromotions: plan === 'pro' || plan === 'plus',
    isPro: plan === 'pro',
    isPlus: plan === 'plus',
    isFree: plan === 'free'
  };
}
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SubscriptionPlans from '@/components/subscription/SubscriptionPlans';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function Pricing() {
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('restaurant_id');

  const { data: restaurants = [] } = useQuery({
    queryKey: ['pricingRestaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }),
    enabled: !!restaurantId,
  });
  const restaurant = restaurants[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-10">
          <Link to={restaurantId ? createPageUrl('OwnerDashboard') : createPageUrl('Home')}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          {restaurant && (
            <span className="text-slate-500 text-sm">
              Upgrading: <span className="font-semibold text-slate-800">{restaurant.name}</span>
            </span>
          )}
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h1>
          <p className="text-lg text-slate-500">Start free. Upgrade when you're ready to grow.</p>
        </div>

        <SubscriptionPlans restaurantId={restaurantId} />

        <p className="text-center text-slate-400 text-xs mt-10">
          All plans include a 14-day free trial. No credit card required for Free plan.
        </p>
      </div>
    </div>
  );
}
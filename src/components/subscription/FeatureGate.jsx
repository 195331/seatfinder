import React from 'react';
import { Lock, Crown, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useFeatureAccess } from './SubscriptionPlans';

export default function FeatureGate({ 
  restaurantId, 
  feature, 
  requiredPlan = 'pro',
  children,
  title,
  description 
}) {
  const access = useFeatureAccess(restaurantId);
  
  const featureChecks = {
    analytics: access.hasAnalytics,
    waitlist: access.hasWaitlist,
    ai: access.hasAIFeatures,
    floorplan: access.hasAdvancedFloorPlan,
    sms: access.hasSMS,
    aiReservations: access.hasAIReservations,
    aiAnalyzer: access.hasAIAnalyzer
  };

  const hasAccess = featureChecks[feature] ?? false;

  if (hasAccess) {
    return children;
  }

  return (
    <Card className="border-2 border-dashed border-slate-300 bg-slate-50/50">
      <CardContent className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="font-semibold text-lg text-slate-900 mb-1">
          {title || 'Premium Feature'}
        </h3>
        <p className="text-slate-500 text-sm mb-4 max-w-md mx-auto">
          {description || `This feature requires ${requiredPlan === 'plus' ? 'Plus' : 'Pro'} plan or higher.`}
        </p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Badge className={requiredPlan === 'plus' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}>
            {requiredPlan === 'plus' ? (
              <><Crown className="w-3 h-3 mr-1" /> Plus</>
            ) : (
              <><Zap className="w-3 h-3 mr-1" /> Pro</>
            )}
          </Badge>
          <span className="text-sm text-slate-500">required</span>
        </div>
        <Link to={createPageUrl('RestaurantSettings') + `?id=${restaurantId}&tab=subscription`}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            Upgrade Now
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
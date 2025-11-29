import React from 'react';
import { Star, Gift, Award, ChevronRight } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TIER_COLORS = {
  Bronze: 'from-amber-600 to-amber-700',
  Silver: 'from-slate-400 to-slate-500',
  Gold: 'from-yellow-500 to-amber-500',
  Platinum: 'from-purple-500 to-indigo-600'
};

export default function LoyaltyCard({ loyalty, program, onClick }) {
  if (!loyalty || !program) return null;

  const currentTier = program.tiers?.find(t => t.name === loyalty.current_tier);
  const nextTier = program.tiers?.find(t => t.min_points > (loyalty.lifetime_points || 0));
  
  const progressToNext = nextTier 
    ? Math.min(100, ((loyalty.lifetime_points - (currentTier?.min_points || 0)) / (nextTier.min_points - (currentTier?.min_points || 0))) * 100)
    : 100;

  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer hover:shadow-lg transition-all",
        "bg-gradient-to-br",
        TIER_COLORS[loyalty.current_tier] || TIER_COLORS.Bronze
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs opacity-80">Loyalty Member</p>
            <h3 className="text-lg font-bold">{program.name}</h3>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            <Award className="w-3 h-3 mr-1" />
            {loyalty.current_tier}
          </Badge>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-2xl font-bold">{loyalty.available_points?.toLocaleString()}</p>
            <p className="text-xs opacity-80">Available Points</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{loyalty.visits || 0}</p>
            <p className="text-xs opacity-80">Visits</p>
          </div>
        </div>

        {nextTier && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>{loyalty.lifetime_points?.toLocaleString()} pts</span>
              <span>{nextTier.min_points?.toLocaleString()} pts to {nextTier.name}</span>
            </div>
            <Progress value={progressToNext} className="h-1.5 bg-white/20" />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center gap-1 text-xs">
            <Gift className="w-3 h-3" />
            <span>{program.rewards?.length || 0} rewards available</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Lock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { BADGES } from './GamificationTracker';

export default function BadgeProgress({ userId }) {
  const { data: stats } = useQuery({
    queryKey: ['userStats', userId],
    queryFn: async () => {
      const result = await base44.entities.UserStats.filter({ user_id: userId });
      return Array.isArray(result) ? result[0] : null;
    },
    enabled: !!userId,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => base44.entities.Achievement.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const unlockedBadges = stats?.achievements_unlocked || [];

  const badgeCategories = {
    'Reviews': ['first_review', 'review_master_5', 'review_master_10', 'review_master_25', 'review_master_50'],
    'Dining': ['frequent_diner_5', 'frequent_diner_10', 'frequent_diner_25', 'frequent_diner_50'],
    'Social': ['social_butterfly_5', 'social_butterfly_10', 'social_butterfly_25'],
    'Streaks': ['streak_warrior_7', 'streak_warrior_30'],
    'Special': ['mood_board_master', 'explorer', 'foodie', 'influencer']
  };

  const getBadgeProgress = (badgeType) => {
    if (badgeType.includes('review_master')) {
      const target = parseInt(badgeType.split('_')[2]);
      return Math.min(100, ((stats?.review_count || 0) / target) * 100);
    }
    if (badgeType.includes('frequent_diner')) {
      const target = parseInt(badgeType.split('_')[2]);
      return Math.min(100, ((stats?.reservation_count || 0) / target) * 100);
    }
    if (badgeType.includes('social_butterfly')) {
      const target = parseInt(badgeType.split('_')[2]);
      return Math.min(100, ((stats?.following_count || 0) / target) * 100);
    }
    if (badgeType === 'mood_board_master') {
      return Math.min(100, ((stats?.mood_board_count || 0) / 3) * 100);
    }
    if (badgeType === 'streak_warrior_7') {
      return Math.min(100, ((stats?.check_in_streak || 0) / 7) * 100);
    }
    if (badgeType === 'streak_warrior_30') {
      return Math.min(100, ((stats?.check_in_streak || 0) / 30) * 100);
    }
    return 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Badge Collection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(badgeCategories).map(([category, badges]) => (
            <div key={category}>
              <h4 className="font-semibold text-sm text-slate-700 mb-3">{category}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {badges.map(badgeType => {
                  const badge = BADGES[badgeType];
                  if (!badge) return null;
                  
                  const isUnlocked = unlockedBadges.includes(badgeType);
                  const progress = getBadgeProgress(badgeType);

                  return (
                    <div
                      key={badgeType}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all",
                        isUnlocked 
                          ? "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50" 
                          : "border-slate-200 bg-slate-50"
                      )}
                    >
                      {isUnlocked ? (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Star className="w-3 h-3 text-white fill-white" />
                        </div>
                      ) : (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center">
                          <Lock className="w-3 h-3 text-white" />
                        </div>
                      )}
                      
                      <div className={cn(
                        "text-4xl mb-2 text-center transition-all",
                        !isUnlocked && "opacity-30 grayscale filter saturate-0"
                      )}>
                        {badge.icon}
                      </div>
                      
                      <p className={cn(
                        "text-xs font-medium text-center mb-2",
                        isUnlocked ? "text-amber-900" : "text-slate-500"
                      )}>
                        {badge.name}
                      </p>
                      
                      {!isUnlocked && progress > 0 && (
                        <div className="space-y-1">
                          <Progress value={progress} className="h-1" />
                          <p className="text-xs text-center text-slate-500">
                            {Math.round(progress)}%
                          </p>
                        </div>
                      )}
                      
                      {isUnlocked && badge.points > 0 && (
                        <Badge className="w-full justify-center text-xs bg-amber-500">
                          +{badge.points} pts
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
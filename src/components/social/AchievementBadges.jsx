import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

// All 15 badges with how-to-earn descriptions
const BADGE_DEFINITIONS = {
  first_review:       { name: 'First Review',     icon: '✍️', description: 'Write your first review',          color: 'from-yellow-400 to-amber-500' },
  review_master_5:    { name: '5 Reviews',         icon: '⭐', description: 'Write 5 reviews',                  color: 'from-orange-400 to-red-500' },
  review_master_10:   { name: '10 Reviews',        icon: '🌟', description: 'Write 10 reviews',                 color: 'from-pink-400 to-rose-500' },
  review_master_25:   { name: '25 Reviews',        icon: '💫', description: 'Write 25 reviews',                 color: 'from-purple-400 to-violet-500' },
  review_master_50:   { name: '50 Reviews',        icon: '👑', description: 'Write 50 reviews',                 color: 'from-indigo-400 to-blue-500' },
  frequent_diner_5:   { name: 'Regular',           icon: '🍽️', description: 'Visit 5 restaurants',             color: 'from-emerald-400 to-green-500' },
  frequent_diner_10:  { name: 'Frequent Diner',    icon: '🎯', description: 'Visit 10 restaurants',            color: 'from-teal-400 to-cyan-500' },
  frequent_diner_25:  { name: 'VIP Diner',         icon: '💎', description: 'Visit 25 restaurants',            color: 'from-sky-400 to-blue-500' },
  frequent_diner_50:  { name: 'Dining Legend',     icon: '🏆', description: 'Visit 50 restaurants',            color: 'from-yellow-400 to-orange-500' },
  social_butterfly:   { name: 'Social',            icon: '🦋', description: 'Follow 5 people',                  color: 'from-pink-400 to-fuchsia-500' },
  explorer:           { name: 'Explorer',          icon: '🗺️', description: 'Visit 10+ different restaurants',  color: 'from-lime-400 to-green-500' },
  foodie:             { name: 'Foodie',             icon: '🍕', description: 'Review 5+ different cuisines',     color: 'from-orange-400 to-amber-500' },
  night_owl:          { name: 'Night Owl',         icon: '🦉', description: 'Make a reservation after 9pm',     color: 'from-slate-500 to-slate-700' },
  early_bird:         { name: 'Early Bird',        icon: '🐦', description: 'Make a reservation before 8am',    color: 'from-sky-300 to-blue-400' },
  weekend_warrior:    { name: 'Weekend',           icon: '🎉', description: 'Dine out on 3 weekends in a row',  color: 'from-violet-400 to-purple-500' },
};

const BADGE_ORDER = Object.keys(BADGE_DEFINITIONS);

export default function AchievementBadges({ userId, variant = 'compact' }) {
  const queryClient = useQueryClient();

  const { data: rawAchievements = [] } = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => base44.entities.Achievement.filter({ user_id: userId }, '-earned_at'),
    enabled: !!userId,
  });

  // Deduplicate: keep only the first occurrence of each badge_type
  const achievements = React.useMemo(() => {
    const seen = new Set();
    return rawAchievements.filter(a => {
      if (seen.has(a.badge_type)) return false;
      seen.add(a.badge_type);
      return true;
    });
  }, [rawAchievements]);

  const earnedTypes = new Set(achievements.map(a => a.badge_type));

  const { data: reviews = [] } = useQuery({
    queryKey: ['userReviewsForBadges', userId],
    queryFn: () => base44.entities.Review.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['userReservationsForBadges', userId],
    queryFn: () => base44.entities.Reservation.filter({ user_id: userId, status: 'approved' }),
    enabled: !!userId,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['userFollowersForBadges', userId],
    queryFn: () => base44.entities.Follow.filter({ following_id: userId }),
    enabled: !!userId,
  });

  const awardBadgeMutation = useMutation({
    mutationFn: async (badgeType) => {
      const badge = BADGE_DEFINITIONS[badgeType];
      await base44.entities.Achievement.create({
        user_id: userId,
        badge_type: badgeType,
        badge_name: badge.name,
        badge_icon: badge.icon,
        earned_at: new Date().toISOString()
      });
    },
    onSuccess: (_, badgeType) => {
      queryClient.invalidateQueries(['achievements']);
      const badge = BADGE_DEFINITIONS[badgeType];
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-2xl">{badge.icon}</span>
          <div>
            <p className="font-bold">Achievement Unlocked!</p>
            <p className="text-sm">{badge.name}</p>
          </div>
        </div>
      );
    }
  });

  // Check and award achievements
  useEffect(() => {
    if (!userId) return;
    const toAward = [];
    const reviewCount = reviews.length;
    if (reviewCount >= 1 && !earnedTypes.has('first_review')) toAward.push('first_review');
    if (reviewCount >= 5 && !earnedTypes.has('review_master_5')) toAward.push('review_master_5');
    if (reviewCount >= 10 && !earnedTypes.has('review_master_10')) toAward.push('review_master_10');
    if (reviewCount >= 25 && !earnedTypes.has('review_master_25')) toAward.push('review_master_25');
    if (reviewCount >= 50 && !earnedTypes.has('review_master_50')) toAward.push('review_master_50');

    const visitCount = reservations.length;
    if (visitCount >= 5 && !earnedTypes.has('frequent_diner_5')) toAward.push('frequent_diner_5');
    if (visitCount >= 10 && !earnedTypes.has('frequent_diner_10')) toAward.push('frequent_diner_10');
    if (visitCount >= 25 && !earnedTypes.has('frequent_diner_25')) toAward.push('frequent_diner_25');
    if (visitCount >= 50 && !earnedTypes.has('frequent_diner_50')) toAward.push('frequent_diner_50');

    const followerCount = followers.length;
    if (followerCount >= 5 && !earnedTypes.has('social_butterfly')) toAward.push('social_butterfly');

    const uniqueRestaurants = new Set(reservations.map(r => r.restaurant_id)).size;
    if (uniqueRestaurants >= 10 && !earnedTypes.has('explorer')) toAward.push('explorer');

    const uniqueCuisines = new Set(reviews.map(r => r.cuisine).filter(Boolean)).size;
    if (uniqueCuisines >= 5 && !earnedTypes.has('foodie')) toAward.push('foodie');

    if (toAward.length > 0) {
      toAward.forEach((badgeType, index) => {
        setTimeout(() => awardBadgeMutation.mutate(badgeType), index * 1000);
      });
    }
  }, [reviews.length, reservations.length, followers.length, userId]);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {achievements.slice(0, 5).map((achievement) => (
          <span key={achievement.badge_type} className="text-lg" title={achievement.badge_name}>
            {achievement.badge_icon}
          </span>
        ))}
        {achievements.length > 5 && (
          <Badge variant="secondary" className="text-xs">+{achievements.length - 5}</Badge>
        )}
      </div>
    );
  }

  // Full variant — show all 15 badges (earned + locked) with hover tooltip
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        Achievements ({earnedTypes.size}/{BADGE_ORDER.length})
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {BADGE_ORDER.map((badgeType) => {
          const def = BADGE_DEFINITIONS[badgeType];
          const isEarned = earnedTypes.has(badgeType);
          return (
            <div
              key={badgeType}
              title={`${def.name}: ${def.description}`}
              className={cn(
                "relative group p-3 rounded-xl border-2 text-center cursor-default transition-all hover:scale-105",
                isEarned
                  ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm"
                  : "border-slate-200 bg-slate-50"
              )}
            >
              {/* Earned checkmark */}
              {isEarned && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">✓</span>
                </div>
              )}

              <div className={cn("text-3xl mb-1", !isEarned && "opacity-25 grayscale")}>
                {def.icon}
              </div>
              <p className={cn("text-[11px] font-medium leading-tight", isEarned ? "text-slate-800" : "text-slate-400")}>
                {def.name}
              </p>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                <p className="font-semibold">{def.name}</p>
                <p className="text-slate-300">{def.description}</p>
                {isEarned && <p className="text-emerald-400 mt-0.5">✓ Earned!</p>}
                {!isEarned && <p className="text-slate-400 mt-0.5">🔒 Locked</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
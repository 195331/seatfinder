import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

const BADGE_DEFINITIONS = {
  first_review: { name: 'First Review', icon: '✍️', description: 'Posted your first review' },
  review_master_5: { name: 'Review Apprentice', icon: '⭐', description: '5 reviews' },
  review_master_10: { name: 'Review Expert', icon: '🌟', description: '10 reviews' },
  review_master_25: { name: 'Review Master', icon: '💫', description: '25 reviews' },
  review_master_50: { name: 'Review Legend', icon: '👑', description: '50 reviews' },
  frequent_diner_5: { name: 'Regular', icon: '🍽️', description: '5 visits' },
  frequent_diner_10: { name: 'Frequent Diner', icon: '🎯', description: '10 visits' },
  frequent_diner_25: { name: 'VIP Diner', icon: '💎', description: '25 visits' },
  frequent_diner_50: { name: 'Dining Legend', icon: '🏆', description: '50 visits' },
  social_butterfly_5: { name: 'Social Starter', icon: '🦋', description: '5 followers' },
  social_butterfly_10: { name: 'Social Star', icon: '⚡', description: '10 followers' },
  social_butterfly_25: { name: 'Influencer', icon: '🌈', description: '25 followers' },
  explorer: { name: 'Explorer', icon: '🗺️', description: 'Visited 10+ different restaurants' },
  foodie: { name: 'Foodie', icon: '👨‍🍳', description: 'Reviewed 5+ different cuisines' },
  influencer: { name: 'Top Influencer', icon: '🔥', description: '100+ total interactions' }
};

export default function AchievementBadges({ userId, variant = 'compact' }) {
  const queryClient = useQueryClient();

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => base44.entities.Achievement.filter({ user_id: userId }, '-earned_at'),
    enabled: !!userId,
  });

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
      
      // Celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
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

    const earnedTypes = new Set(achievements.map(a => a.badge_type));
    const toAward = [];

    // Review milestones
    const reviewCount = reviews.length;
    if (reviewCount >= 1 && !earnedTypes.has('first_review')) toAward.push('first_review');
    if (reviewCount >= 5 && !earnedTypes.has('review_master_5')) toAward.push('review_master_5');
    if (reviewCount >= 10 && !earnedTypes.has('review_master_10')) toAward.push('review_master_10');
    if (reviewCount >= 25 && !earnedTypes.has('review_master_25')) toAward.push('review_master_25');
    if (reviewCount >= 50 && !earnedTypes.has('review_master_50')) toAward.push('review_master_50');

    // Visit milestones
    const visitCount = reservations.length;
    if (visitCount >= 5 && !earnedTypes.has('frequent_diner_5')) toAward.push('frequent_diner_5');
    if (visitCount >= 10 && !earnedTypes.has('frequent_diner_10')) toAward.push('frequent_diner_10');
    if (visitCount >= 25 && !earnedTypes.has('frequent_diner_25')) toAward.push('frequent_diner_25');
    if (visitCount >= 50 && !earnedTypes.has('frequent_diner_50')) toAward.push('frequent_diner_50');

    // Follower milestones
    const followerCount = followers.length;
    if (followerCount >= 5 && !earnedTypes.has('social_butterfly_5')) toAward.push('social_butterfly_5');
    if (followerCount >= 10 && !earnedTypes.has('social_butterfly_10')) toAward.push('social_butterfly_10');
    if (followerCount >= 25 && !earnedTypes.has('social_butterfly_25')) toAward.push('social_butterfly_25');

    // Special achievements
    const uniqueRestaurants = new Set(reservations.map(r => r.restaurant_id)).size;
    if (uniqueRestaurants >= 10 && !earnedTypes.has('explorer')) toAward.push('explorer');

    const uniqueCuisines = new Set(reviews.map(r => r.cuisine).filter(Boolean)).size;
    if (uniqueCuisines >= 5 && !earnedTypes.has('foodie')) toAward.push('foodie');

    const totalInteractions = reviewCount + visitCount + followerCount;
    if (totalInteractions >= 100 && !earnedTypes.has('influencer')) toAward.push('influencer');

    // Award one at a time with delay
    if (toAward.length > 0) {
      toAward.forEach((badgeType, index) => {
        setTimeout(() => {
          awardBadgeMutation.mutate(badgeType);
        }, index * 1000);
      });
    }
  }, [reviews.length, reservations.length, followers.length, userId]);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {achievements.slice(0, 5).map((achievement) => (
          <span
            key={achievement.id}
            className="text-lg"
            title={achievement.badge_name}
          >
            {achievement.badge_icon}
          </span>
        ))}
        {achievements.length > 5 && (
          <Badge variant="secondary" className="text-xs">
            +{achievements.length - 5}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        Achievements ({achievements.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg text-center"
          >
            <div className="text-3xl mb-1">{achievement.badge_icon}</div>
            <p className="font-medium text-xs text-slate-900">{achievement.badge_name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
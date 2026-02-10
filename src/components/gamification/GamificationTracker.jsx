import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const POINTS_CONFIG = {
  review: 50,
  review_with_photo: 75,
  reservation: 25,
  favorite: 10,
  mood_board_create: 100,
  mood_board_share: 20,
  follow_user: 15,
  daily_check_in: 20,
  streak_bonus_3: 30,
  streak_bonus_7: 100,
  streak_bonus_30: 500
};

const BADGES = {
  first_review: { name: 'First Steps', icon: '🌟', points: 0 },
  review_master_5: { name: 'Critic', icon: '⭐', points: 250 },
  review_master_10: { name: 'Expert Reviewer', icon: '🌟', points: 500 },
  review_master_25: { name: 'Master Critic', icon: '🏆', points: 1250 },
  review_master_50: { name: 'Review Legend', icon: '👑', points: 2500 },
  
  frequent_diner_5: { name: 'Regular', icon: '🍽️', points: 125 },
  frequent_diner_10: { name: 'Food Enthusiast', icon: '🍴', points: 250 },
  frequent_diner_25: { name: 'Dining Expert', icon: '🥘', points: 625 },
  frequent_diner_50: { name: 'Restaurant Pro', icon: '👨‍🍳', points: 1250 },
  
  social_butterfly_5: { name: 'Social', icon: '🦋', points: 75 },
  social_butterfly_10: { name: 'Influencer', icon: '✨', points: 150 },
  social_butterfly_25: { name: 'Community Leader', icon: '🌟', points: 375 },
  
  explorer: { name: 'Explorer', icon: '🗺️', points: 200 },
  foodie: { name: 'Foodie', icon: '🍕', points: 300 },
  influencer: { name: 'Influencer', icon: '💫', points: 500 },
  
  mood_board_master: { name: 'Curator', icon: '🎨', points: 200 },
  streak_warrior_7: { name: 'Committed', icon: '🔥', points: 150 },
  streak_warrior_30: { name: 'Unstoppable', icon: '⚡', points: 1000 }
};

const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1500, 2500, 4000, 6000, 8500, 
  11500, 15000, 19000, 24000, 30000, 37000, 45000, 54000, 64000, 75000
];

function calculateLevel(totalPoints) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 10000;
  return { level, pointsToNext: nextThreshold - totalPoints };
}

export async function awardPoints(userId, userEmail, userName, action, metadata = {}) {
  if (!userId) return;

  const points = POINTS_CONFIG[action] || 0;
  if (points === 0) return;

  try {
    // Get or create user stats
    let stats = await base44.entities.UserStats.filter({ user_id: userId });
    stats = Array.isArray(stats) ? stats[0] : null;

    if (!stats) {
      stats = await base44.entities.UserStats.create({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        total_points: 0,
        level: 1,
        points_to_next_level: 100
      });
    }

    const newTotalPoints = (stats.total_points || 0) + points;
    const { level, pointsToNext } = calculateLevel(newTotalPoints);
    const leveledUp = level > (stats.level || 1);

    // Update stats
    const updateData = {
      total_points: newTotalPoints,
      level,
      points_to_next_level: pointsToNext
    };

    // Update specific counters
    if (action === 'review') updateData.review_count = (stats.review_count || 0) + 1;
    if (action === 'reservation') updateData.reservation_count = (stats.reservation_count || 0) + 1;
    if (action === 'favorite') updateData.favorite_count = (stats.favorite_count || 0) + 1;
    if (action === 'mood_board_create') updateData.mood_board_count = (stats.mood_board_count || 0) + 1;
    if (action === 'follow_user') updateData.following_count = (stats.following_count || 0) + 1;

    await base44.entities.UserStats.update(stats.id, updateData);

    // Check for new badges
    await checkAndAwardBadges(userId, userEmail, userName, { ...stats, ...updateData });

    // Show toast
    if (leveledUp) {
      toast.success(`🎉 Level Up! You're now level ${level}!`, {
        description: `+${points} points earned`
      });
    } else {
      toast.success(`+${points} points! 🎯`, {
        description: `${pointsToNext} points to level ${level + 1}`
      });
    }
  } catch (error) {
    console.error('Error awarding points:', error);
  }
}

async function checkAndAwardBadges(userId, userEmail, userName, stats) {
  const achievements = stats.achievements_unlocked || [];
  const newBadges = [];

  // Review badges
  if (stats.review_count >= 1 && !achievements.includes('first_review')) {
    newBadges.push('first_review');
  }
  if (stats.review_count >= 5 && !achievements.includes('review_master_5')) {
    newBadges.push('review_master_5');
  }
  if (stats.review_count >= 10 && !achievements.includes('review_master_10')) {
    newBadges.push('review_master_10');
  }
  if (stats.review_count >= 25 && !achievements.includes('review_master_25')) {
    newBadges.push('review_master_25');
  }
  if (stats.review_count >= 50 && !achievements.includes('review_master_50')) {
    newBadges.push('review_master_50');
  }

  // Reservation badges
  if (stats.reservation_count >= 5 && !achievements.includes('frequent_diner_5')) {
    newBadges.push('frequent_diner_5');
  }
  if (stats.reservation_count >= 10 && !achievements.includes('frequent_diner_10')) {
    newBadges.push('frequent_diner_10');
  }
  if (stats.reservation_count >= 25 && !achievements.includes('frequent_diner_25')) {
    newBadges.push('frequent_diner_25');
  }
  if (stats.reservation_count >= 50 && !achievements.includes('frequent_diner_50')) {
    newBadges.push('frequent_diner_50');
  }

  // Social badges
  if (stats.following_count >= 5 && !achievements.includes('social_butterfly_5')) {
    newBadges.push('social_butterfly_5');
  }
  if (stats.following_count >= 10 && !achievements.includes('social_butterfly_10')) {
    newBadges.push('social_butterfly_10');
  }
  if (stats.following_count >= 25 && !achievements.includes('social_butterfly_25')) {
    newBadges.push('social_butterfly_25');
  }

  // Mood board badges
  if (stats.mood_board_count >= 3 && !achievements.includes('mood_board_master')) {
    newBadges.push('mood_board_master');
  }

  // Streak badges
  if (stats.check_in_streak >= 7 && !achievements.includes('streak_warrior_7')) {
    newBadges.push('streak_warrior_7');
  }
  if (stats.check_in_streak >= 30 && !achievements.includes('streak_warrior_30')) {
    newBadges.push('streak_warrior_30');
  }

  // Award new badges
  for (const badgeType of newBadges) {
    const badge = BADGES[badgeType];
    if (!badge) continue;

    await base44.entities.Achievement.create({
      user_id: userId,
      badge_type: badgeType,
      badge_name: badge.name,
      badge_icon: badge.icon,
      earned_at: new Date().toISOString()
    });

    await base44.entities.UserStats.update(stats.id, {
      achievements_unlocked: [...achievements, badgeType],
      total_points: stats.total_points + badge.points
    });

    toast.success(`🏆 New Badge: ${badge.icon} ${badge.name}!`, {
      description: `+${badge.points} bonus points`,
      duration: 5000
    });
  }
}

export async function dailyCheckIn(userId, userEmail, userName) {
  if (!userId) return;

  try {
    let stats = await base44.entities.UserStats.filter({ user_id: userId });
    stats = Array.isArray(stats) ? stats[0] : null;

    const today = new Date().toISOString().split('T')[0];
    if (stats?.last_check_in === today) {
      toast.info('Already checked in today!');
      return;
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const isConsecutive = stats?.last_check_in === yesterday;
    const newStreak = isConsecutive ? (stats.check_in_streak || 0) + 1 : 1;

    let bonusPoints = POINTS_CONFIG.daily_check_in;
    if (newStreak === 3) bonusPoints += POINTS_CONFIG.streak_bonus_3;
    if (newStreak === 7) bonusPoints += POINTS_CONFIG.streak_bonus_7;
    if (newStreak === 30) bonusPoints += POINTS_CONFIG.streak_bonus_30;

    if (!stats) {
      await base44.entities.UserStats.create({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        total_points: bonusPoints,
        check_in_streak: 1,
        last_check_in: today
      });
    } else {
      const newTotal = (stats.total_points || 0) + bonusPoints;
      const { level, pointsToNext } = calculateLevel(newTotal);

      await base44.entities.UserStats.update(stats.id, {
        total_points: newTotal,
        level,
        points_to_next_level: pointsToNext,
        check_in_streak: newStreak,
        last_check_in: today
      });
    }

    await checkAndAwardBadges(userId, userEmail, userName, { 
      ...stats, 
      check_in_streak: newStreak 
    });

    toast.success(`✅ Day ${newStreak} streak! +${bonusPoints} points`);
  } catch (error) {
    console.error('Error during check-in:', error);
  }
}

export default function GamificationTracker({ children }) {
  return children;
}

export { POINTS_CONFIG, BADGES, LEVEL_THRESHOLDS };
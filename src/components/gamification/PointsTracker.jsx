import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { awardPoints } from './GamificationTracker';

/**
 * Wrapper component to automatically track points for user actions
 * Usage: Wrap around components where you want to track actions
 */
export default function PointsTracker({ children, currentUser }) {
  useEffect(() => {
    if (!currentUser) return;

    // Listen for review submissions
    const handleReviewCreated = async (event) => {
      if (event.detail?.userId === currentUser.id) {
        const hasPhotos = event.detail?.photos?.length > 0;
        await awardPoints(
          currentUser.id,
          currentUser.email,
          currentUser.full_name,
          hasPhotos ? 'review_with_photo' : 'review'
        );
      }
    };

    // Listen for reservations
    const handleReservationCreated = async (event) => {
      if (event.detail?.userId === currentUser.id) {
        await awardPoints(
          currentUser.id,
          currentUser.email,
          currentUser.full_name,
          'reservation'
        );
      }
    };

    // Listen for favorites
    const handleFavoriteAdded = async (event) => {
      if (event.detail?.userId === currentUser.id) {
        await awardPoints(
          currentUser.id,
          currentUser.email,
          currentUser.full_name,
          'favorite'
        );
      }
    };

    // Listen for mood board creation
    const handleMoodBoardCreated = async (event) => {
      if (event.detail?.userId === currentUser.id) {
        await awardPoints(
          currentUser.id,
          currentUser.email,
          currentUser.full_name,
          'mood_board_create'
        );
      }
    };

    // Listen for follow actions
    const handleUserFollowed = async (event) => {
      if (event.detail?.userId === currentUser.id) {
        await awardPoints(
          currentUser.id,
          currentUser.email,
          currentUser.full_name,
          'follow_user'
        );
      }
    };

    window.addEventListener('review:created', handleReviewCreated);
    window.addEventListener('reservation:created', handleReservationCreated);
    window.addEventListener('favorite:added', handleFavoriteAdded);
    window.addEventListener('moodboard:created', handleMoodBoardCreated);
    window.addEventListener('user:followed', handleUserFollowed);

    return () => {
      window.removeEventListener('review:created', handleReviewCreated);
      window.removeEventListener('reservation:created', handleReservationCreated);
      window.removeEventListener('favorite:added', handleFavoriteAdded);
      window.removeEventListener('moodboard:created', handleMoodBoardCreated);
      window.removeEventListener('user:followed', handleUserFollowed);
    };
  }, [currentUser]);

  return children;
}

// Helper functions to dispatch events
export const trackReviewCreated = (userId, photos = []) => {
  window.dispatchEvent(new CustomEvent('review:created', { detail: { userId, photos } }));
};

export const trackReservationCreated = (userId) => {
  window.dispatchEvent(new CustomEvent('reservation:created', { detail: { userId } }));
};

export const trackFavoriteAdded = (userId) => {
  window.dispatchEvent(new CustomEvent('favorite:added', { detail: { userId } }));
};

export const trackMoodBoardCreated = (userId) => {
  window.dispatchEvent(new CustomEvent('moodboard:created', { detail: { userId } }));
};

export const trackUserFollowed = (userId) => {
  window.dispatchEvent(new CustomEvent('user:followed', { detail: { userId } }));
};
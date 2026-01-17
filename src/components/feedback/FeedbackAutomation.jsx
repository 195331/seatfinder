import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// This component runs automated feedback requests for completed reservations
export default function FeedbackAutomation() {
  const { data: completedReservations = [] } = useQuery({
    queryKey: ['completedReservationsForFeedback'],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const reservations = await base44.entities.Reservation.filter({ 
        status: 'approved',
        reservation_date: yesterday.toISOString().split('T')[0]
      });

      return reservations.filter(r => {
        const resTime = new Date(`${r.reservation_date}T${r.reservation_time}`);
        const now = new Date();
        const hoursSince = (now - resTime) / (1000 * 60 * 60);
        return hoursSince >= 2 && hoursSince <= 24;
      });
    },
    refetchInterval: 3600000, // Check hourly
    enabled: true
  });

  useEffect(() => {
    if (completedReservations.length === 0) return;

    completedReservations.forEach(async (reservation) => {
      const existingReview = await base44.entities.Review.filter({
        restaurant_id: reservation.restaurant_id,
        user_id: reservation.user_id,
        created_date: { $gte: new Date(Date.now() - 86400000).toISOString() }
      });

      if (existingReview.length > 0) return;

      const restaurant = await base44.entities.Restaurant.filter({ id: reservation.restaurant_id }).then(r => r[0]);
      
      try {
        await base44.integrations.Core.SendEmail({
          to: reservation.user_email,
          subject: `How was your experience at ${restaurant?.name}?`,
          body: `
Hi ${reservation.user_name},

Thank you for dining with us at ${restaurant?.name}!

We'd love to hear about your experience. Please take a moment to share your feedback:

${window.location.origin}/review?reservation=${reservation.id}

Your feedback helps us improve and helps other diners discover great restaurants.

Best regards,
The SeatFinder Team
          `.trim()
        });
      } catch (err) {
        console.log('Email send failed', err);
      }
    });
  }, [completedReservations]);

  return null;
}
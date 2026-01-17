import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Skeleton } from "@/components/ui/skeleton";
import ReviewSubmissionForm from '@/components/feedback/ReviewSubmissionForm';

export default function ReviewSubmission() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const reservationId = urlParams.get('reservation');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    fetchUser();
  }, []);

  const { data: reservation, isLoading: loadingReservation } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => base44.entities.Reservation.filter({ id: reservationId }).then(r => r[0]),
    enabled: !!reservationId
  });

  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ['restaurant', reservation?.restaurant_id],
    queryFn: () => base44.entities.Restaurant.filter({ id: reservation.restaurant_id }).then(r => r[0]),
    enabled: !!reservation?.restaurant_id
  });

  if (loadingReservation || loadingRestaurant) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!reservation || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Reservation not found</p>
          <button onClick={() => navigate(createPageUrl('Home'))} className="text-blue-600">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <ReviewSubmissionForm
          reservation={reservation}
          restaurant={restaurant}
          onSubmitSuccess={() => {
            setTimeout(() => navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`), 2000);
          }}
        />
      </div>
    </div>
  );
}
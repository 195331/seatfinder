import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Clock, AlertTriangle } from 'lucide-react';

export default function StaffNotifications({ restaurant }) {
  const { data: upcomingReservations = [] } = useQuery({
    queryKey: ['upcomingReservations', restaurant?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const reservations = await base44.entities.Reservation.filter({
        restaurant_id: restaurant.id,
        reservation_date: today,
        status: 'approved'
      });

      const now = new Date();
      const in30Min = new Date(now.getTime() + 30 * 60000);

      return reservations.filter(r => {
        const resTime = new Date(`${r.reservation_date}T${r.reservation_time}`);
        return resTime >= now && resTime <= in30Min;
      });
    },
    refetchInterval: 60000, // Check every minute
    enabled: !!restaurant?.id
  });

  const { data: potentialIssues = [] } = useQuery({
    queryKey: ['potentialIssues', restaurant?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const reservations = await base44.entities.Reservation.filter({
        restaurant_id: restaurant.id,
        reservation_date: today,
        status: 'approved'
      }, 'reservation_time');

      const issues = [];
      
      for (let i = 0; i < reservations.length - 1; i++) {
        const current = reservations[i];
        const next = reservations[i + 1];
        
        if (current.table_id === next.table_id) {
          const currentTime = new Date(`${current.reservation_date}T${current.reservation_time}`);
          const nextTime = new Date(`${next.reservation_date}T${next.reservation_time}`);
          const gapMinutes = (nextTime - currentTime) / 60000;
          
          if (gapMinutes < 90) {
            issues.push({
              type: 'short_gap',
              message: `⚠️ Only ${Math.round(gapMinutes)} min gap between bookings on table ${current.table_id}`,
              severity: 'warning'
            });
          }
        }
      }

      const tables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const occupancy = (reservations.length / tables.length) * 100;
      
      if (occupancy > 90) {
        issues.push({
          type: 'high_occupancy',
          message: `🔥 ${Math.round(occupancy)}% occupancy today - consider waitlist management`,
          severity: 'info'
        });
      }

      return issues;
    },
    refetchInterval: 300000, // Check every 5 minutes
    enabled: !!restaurant?.id
  });

  useEffect(() => {
    if (upcomingReservations.length > 0) {
      upcomingReservations.forEach(res => {
        const resTime = new Date(`${res.reservation_date}T${res.reservation_time}`);
        const minutesUntil = Math.round((resTime - new Date()) / 60000);
        
        toast.info(
          `Upcoming: ${res.user_name} - Party of ${res.party_size} in ${minutesUntil} min`,
          { icon: <Clock className="w-4 h-4" /> }
        );
      });
    }
  }, [upcomingReservations.length]);

  useEffect(() => {
    if (potentialIssues.length > 0) {
      potentialIssues.forEach(issue => {
        if (issue.severity === 'warning') {
          toast.warning(issue.message, { icon: <AlertTriangle className="w-4 h-4" /> });
        }
      });
    }
  }, [potentialIssues.length]);

  return null;
}
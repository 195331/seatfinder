import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Calendar, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AchievementBadges from '@/components/social/AchievementBadges';

export default function Leaderboard({ currentUser }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('all-time'); // 'all-time', 'month', 'week'

  const { data: allReviews = [] } = useQuery({
    queryKey: ['allReviews'],
    queryFn: () => base44.entities.Review.filter({ is_hidden: false }, '-created_date', 1000),
  });

  const { data: allReservations = [] } = useQuery({
    queryKey: ['allReservations'],
    queryFn: () => base44.entities.Reservation.filter({ status: 'approved' }, '-created_date', 1000),
  });

  const getFilteredData = (data, dateField = 'created_date') => {
    if (period === 'all-time') return data;
    
    const now = new Date();
    const cutoff = period === 'week' 
      ? new Date(now.setDate(now.getDate() - 7))
      : new Date(now.setMonth(now.getMonth() - 1));
    
    return data.filter(item => new Date(item[dateField]) >= cutoff);
  };

  // Top Reviewers
  const topReviewers = React.useMemo(() => {
    const filteredReviews = getFilteredData(allReviews);
    const reviewerCounts = {};
    
    filteredReviews.forEach(review => {
      if (!review.user_id) return;
      if (!reviewerCounts[review.user_id]) {
        reviewerCounts[review.user_id] = {
          userId: review.user_id,
          userName: review.user_name || 'Anonymous',
          count: 0,
          avgRating: 0,
          totalRating: 0
        };
      }
      reviewerCounts[review.user_id].count++;
      reviewerCounts[review.user_id].totalRating += review.rating || 0;
    });

    return Object.values(reviewerCounts)
      .map(r => ({ ...r, avgRating: r.totalRating / r.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allReviews, period]);

  // Most Active Diners
  const mostActiveDiners = React.useMemo(() => {
    const filteredReservations = getFilteredData(allReservations, 'reservation_date');
    const dinerCounts = {};
    
    filteredReservations.forEach(reservation => {
      if (!reservation.user_id) return;
      if (!dinerCounts[reservation.user_id]) {
        dinerCounts[reservation.user_id] = {
          userId: reservation.user_id,
          userName: reservation.user_name,
          count: 0,
          totalGuests: 0
        };
      }
      dinerCounts[reservation.user_id].count++;
      dinerCounts[reservation.user_id].totalGuests += reservation.party_size || 0;
    });

    return Object.values(dinerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allReservations, period]);

  const getMedalColor = (index) => {
    if (index === 0) return 'text-yellow-500';
    if (index === 1) return 'text-slate-400';
    if (index === 2) return 'text-amber-600';
    return 'text-slate-300';
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Community Leaderboard</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Top diners and reviewers</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={setPeriod} className="mb-6">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all-time" className="gap-1.5">
              <TrendingUp className="w-4 h-4" />
              All Time
            </TabsTrigger>
            <TabsTrigger value="month" className="gap-1.5">
              <Calendar className="w-4 h-4" />
              This Month
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5">
              <Star className="w-4 h-4" />
              This Week
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs defaultValue="reviewers">
          <TabsList className="w-full bg-slate-50">
            <TabsTrigger value="reviewers" className="flex-1">Top Reviewers</TabsTrigger>
            <TabsTrigger value="diners" className="flex-1">Most Active</TabsTrigger>
          </TabsList>

          <TabsContent value="reviewers" className="mt-4">
            <div className="space-y-2">
              {topReviewers.map((reviewer, index) => (
                <div
                  key={reviewer.userId}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer",
                    currentUser?.id === reviewer.userId && "bg-purple-50 hover:bg-purple-100"
                  )}
                  onClick={() => navigate(createPageUrl('UserProfile') + `?id=${reviewer.userId}`)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Trophy className={cn("w-6 h-6", getMedalColor(index))} />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">#{index + 1}</span>
                      <span className="font-medium text-slate-700">{reviewer.userName}</span>
                      {currentUser?.id === reviewer.userId && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AchievementBadges userId={reviewer.userId} variant="compact" />
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{reviewer.count}</p>
                      <p className="text-xs text-slate-500">reviews</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-medium text-slate-700">{reviewer.avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="diners" className="mt-4">
            <div className="space-y-2">
              {mostActiveDiners.map((diner, index) => (
                <div
                  key={diner.userId}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer",
                    currentUser?.id === diner.userId && "bg-purple-50 hover:bg-purple-100"
                  )}
                  onClick={() => navigate(createPageUrl('UserProfile') + `?id=${diner.userId}`)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Trophy className={cn("w-6 h-6", getMedalColor(index))} />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">#{index + 1}</span>
                      <span className="font-medium text-slate-700">{diner.userName}</span>
                      {currentUser?.id === diner.userId && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AchievementBadges userId={diner.userId} variant="compact" />
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{diner.count}</p>
                      <p className="text-xs text-slate-500">reservations</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Star, MessageSquare, ChevronRight } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';
import FollowButton from '@/components/social/FollowButton';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import moment from 'moment';

function Avatar({ name, size = 'md' }) {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-red-500',
    'from-indigo-500 to-violet-500',
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-lg';
  return (
    <div className={cn(`rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold shrink-0`, colors[idx], sizeClass)}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

export default function PeopleSection({ currentUser }) {
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Fetch recent public reviews
  const { data: recentReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['discoverReviews'],
    queryFn: () => base44.entities.Review.list('-created_date', 50),
  });

  // Fetch all users to enrich reviewer names
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsersDiscover'],
    queryFn: () => base44.entities.User.list(),
  });

  // Fetch restaurants to show restaurant name on reviews
  const { data: restaurants = [] } = useQuery({
    queryKey: ['allRestaurantsDiscover'],
    queryFn: () => base44.entities.Restaurant.filter({ status: 'approved' }),
  });

  // Fetch follow counts for top reviewers
  const { data: allFollows = [] } = useQuery({
    queryKey: ['allFollowsDiscover'],
    queryFn: () => base44.entities.Follow.list(),
  });

  const visibleReviews = recentReviews.filter(r => !r.is_hidden && r.user_id && r.comment);

  // Build top reviewers from review data
  const reviewerMap = {};
  visibleReviews.forEach(r => {
    if (!r.user_id) return;
    if (!reviewerMap[r.user_id]) {
      reviewerMap[r.user_id] = {
        user_id: r.user_id,
        user_name: r.user_name || 'Foodie',
        review_count: 0,
        avg_rating: 0,
        ratings: [],
        latest_review: null,
      };
    }
    reviewerMap[r.user_id].review_count++;
    reviewerMap[r.user_id].ratings.push(r.rating);
    if (!reviewerMap[r.user_id].latest_review || r.created_date > reviewerMap[r.user_id].latest_review.created_date) {
      reviewerMap[r.user_id].latest_review = r;
    }
  });

  const topReviewers = Object.values(reviewerMap)
    .map(u => ({
      ...u,
      avg_rating: u.ratings.length ? (u.ratings.reduce((a, b) => a + b, 0) / u.ratings.length).toFixed(1) : '—',
      follower_count: allFollows.filter(f => f.following_id === u.user_id).length,
    }))
    .filter(u => currentUser?.id !== u.user_id)
    .sort((a, b) => b.review_count - a.review_count)
    .slice(0, 8);

  const displayedReviews = showAllReviews ? visibleReviews.slice(0, 20) : visibleReviews.slice(0, 6);

  if (reviewsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (visibleReviews.length === 0 && topReviewers.length === 0) return null;

  return (
    <div className="space-y-10">
      {/* Top Reviewers */}
      {topReviewers.length > 0 && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Top Foodies to Follow</h2>
              <p className="text-slate-500 text-sm mt-0.5">Active reviewers in your community</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topReviewers.map((reviewer, i) => (
              <motion.div key={reviewer.user_id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Link to={`${createPageUrl('UserProfile')}?id=${reviewer.user_id}`}>
                        <Avatar name={reviewer.user_name} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`${createPageUrl('UserProfile')}?id=${reviewer.user_id}`}>
                          <p className="font-semibold text-slate-900 truncate hover:text-purple-700 transition-colors">
                            {reviewer.user_name}
                          </p>
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {reviewer.review_count} reviews
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {reviewer.avg_rating}
                          </span>
                        </div>
                        {reviewer.follower_count > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">{reviewer.follower_count} followers</p>
                        )}
                      </div>
                    </div>
                    <FollowButton
                      currentUser={currentUser}
                      targetUserId={reviewer.user_id}
                      targetUserName={reviewer.user_name}
                      targetUserEmail={reviewer.user_email}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews Feed */}
      {visibleReviews.length > 0 && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Community Reviews</h2>
              <p className="text-slate-500 text-sm mt-0.5">What fellow diners are saying</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedReviews.map((review, i) => {
              const restaurant = restaurants.find(r => r.id === review.restaurant_id);
              const isOwnReview = currentUser?.id === review.user_id;

              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-0 shadow-md hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      {/* Reviewer header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <Link to={`${createPageUrl('UserProfile')}?id=${review.user_id}`}>
                            <Avatar name={review.user_name || 'Foodie'} size="sm" />
                          </Link>
                          <div>
                            <Link to={`${createPageUrl('UserProfile')}?id=${review.user_id}`}>
                              <p className="font-semibold text-slate-900 text-sm hover:text-purple-700 transition-colors">
                                {review.user_name || 'Anonymous Foodie'}
                              </p>
                            </Link>
                            <p className="text-xs text-slate-400">{moment(review.created_date).fromNow()}</p>
                          </div>
                        </div>
                        {!isOwnReview && currentUser && (
                          <FollowButton
                            currentUser={currentUser}
                            targetUserId={review.user_id}
                            targetUserName={review.user_name}
                            targetUserEmail={review.user_email}
                          />
                        )}
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 mb-2">
                        {[1,2,3,4,5].map(s => (
                          <Star
                            key={s}
                            className={cn('w-3.5 h-3.5', s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200')}
                          />
                        ))}
                        <span className="text-xs text-slate-500 ml-1">{review.rating}/5</span>
                      </div>

                      {/* Comment */}
                      <p className="text-slate-700 text-sm leading-relaxed flex-1 line-clamp-3">
                        {review.comment}
                      </p>

                      {/* Restaurant tag */}
                      {restaurant && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs gap-1">
                            🍽️ {restaurant.name}
                          </Badge>
                          {restaurant.neighborhood && (
                            <span className="text-xs text-slate-400">{restaurant.neighborhood}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {visibleReviews.length > 6 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAllReviews(v => !v)}
                className="inline-flex items-center gap-2 text-sm text-purple-700 font-medium hover:text-purple-900 transition-colors"
              >
                {showAllReviews ? 'Show less' : `See ${visibleReviews.length - 6} more reviews`}
                <ChevronRight className={cn('w-4 h-4 transition-transform', showAllReviews && 'rotate-90')} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
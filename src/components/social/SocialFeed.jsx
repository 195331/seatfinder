import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Heart, MessageCircle, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import FollowButton from './FollowButton';

export default function SocialFeed({ currentUser }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('following');

  // Get following
  const { data: following = [] } = useQuery({
    queryKey: ['following', currentUser?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const followingIds = following.map(f => f.following_id);

  // Get recent reviews from followed users
  const { data: followingReviews = [] } = useQuery({
    queryKey: ['followingReviews', followingIds.join(',')],
    queryFn: async () => {
      if (followingIds.length === 0) return [];
      const reviews = await base44.entities.Review.filter({ is_hidden: false }, '-created_date', 50);
      return reviews.filter(r => followingIds.includes(r.user_id));
    },
    enabled: followingIds.length > 0,
  });

  // Get all recent activity
  const { data: allReviews = [] } = useQuery({
    queryKey: ['allRecentReviews'],
    queryFn: () => base44.entities.Review.filter({ is_hidden: false }, '-created_date', 50),
  });



  const renderReview = (review) => (
    <Card key={review.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
            {review.user_name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => navigate(createPageUrl('UserProfile') + `?id=${review.user_id}`)}
                className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors"
              >
                {review.user_name || 'Anonymous'}
              </button>
              {currentUser && review.user_id !== currentUser.id && (
                <FollowButton
                  currentUser={currentUser}
                  targetUserId={review.user_id}
                  targetUserName={review.user_name}
                  targetUserEmail={review.user_email}
                />
              )}
            </div>
            <p className="text-sm text-slate-500 mb-2">
              {new Date(review.created_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>

            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={cn(
                    "w-4 h-4",
                    star <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  )}
                />
              ))}
            </div>

            {review.comment && (
              <p className="text-slate-700 text-sm mb-3">{review.comment}</p>
            )}

            {review.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {review.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-slate-100">
              <TabsTrigger value="following" className="flex-1 gap-2">
                <Users className="w-4 h-4" />
                Following
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex-1 gap-2">
                <TrendingUp className="w-4 h-4" />
                Trending
              </TabsTrigger>

            </TabsList>

            <TabsContent value="following" className="space-y-3 mt-4">
              {followingIds.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 mb-2">You're not following anyone yet</p>
                  <p className="text-sm text-slate-500">Follow friends to see their activity</p>
                </div>
              ) : followingReviews.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">No recent activity from people you follow</p>
                </div>
              ) : (
                followingReviews.map(renderReview)
              )}
            </TabsContent>

            <TabsContent value="trending" className="space-y-3 mt-4">
              {allReviews.slice(0, 10).map(renderReview)}
            </TabsContent>


          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, MapPin, Calendar, Star, Heart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowButton from '@/components/social/FollowButton';
import AchievementBadges from '@/components/social/AchievementBadges';
import moment from 'moment';

export default function UserProfile() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('id');
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: profileUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.find(u => u.id === userId);
    },
    enabled: !!userId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['userReviews', userId],
    queryFn: () => base44.entities.Review.filter({ user_id: userId, is_hidden: false }, '-created_date'),
    enabled: !!userId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['userReservations', userId],
    queryFn: () => base44.entities.Reservation.filter({ user_id: userId, status: 'approved' }, '-created_date'),
    enabled: !!userId,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['followers', userId],
    queryFn: () => base44.entities.Follow.filter({ following_id: userId }),
    enabled: !!userId,
  });

  const { data: following = [] } = useQuery({
    queryKey: ['following', userId],
    queryFn: () => base44.entities.Follow.filter({ follower_id: userId }),
    enabled: !!userId,
  });

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-3xl font-bold">
                  {profileUser.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{profileUser.full_name}</h1>
                  <p className="text-slate-500 mt-1">Member since {moment(profileUser.created_date).format('MMMM YYYY')}</p>
                  
                  <div className="flex items-center gap-4 mt-4">
                    <div className="text-center">
                      <p className="font-bold text-lg text-slate-900">{reviews.length}</p>
                      <p className="text-xs text-slate-500">Reviews</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg text-slate-900">{reservations.length}</p>
                      <p className="text-xs text-slate-500">Visits</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg text-slate-900">{followers.length}</p>
                      <p className="text-xs text-slate-500">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg text-slate-900">{following.length}</p>
                      <p className="text-xs text-slate-500">Following</p>
                    </div>
                  </div>
                </div>
              </div>
              <FollowButton
                currentUser={currentUser}
                targetUserId={userId}
                targetUserName={profileUser.full_name}
                targetUserEmail={profileUser.email}
              />
            </div>

            {reviews.length > 0 && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="text-2xl font-bold text-slate-900">{avgRating}</span>
                  </div>
                  <p className="text-sm text-slate-600">Average rating given</p>
                </div>
              </div>
            )}

            <div className="mt-6">
              <AchievementBadges userId={userId} variant="full" />
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="reviews">
          <TabsList className="w-full bg-white shadow-sm">
            <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="mt-6 space-y-4">
            {reviews.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">No reviews yet</p>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-slate-900">{review.rating}</span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {moment(review.created_date).format('MMM D, YYYY')}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-slate-700 mb-3">{review.comment}</p>
                    )}
                    {review.tags?.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {review.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6 space-y-4">
            {reservations.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">No activity yet</p>
                </CardContent>
              </Card>
            ) : (
              reservations.slice(0, 20).map((reservation) => (
                <Card key={reservation.id} className="border-0 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Visited a restaurant</p>
                        <p className="text-sm text-slate-500">
                          Party of {reservation.party_size} • {moment(reservation.reservation_date).format('MMM D, YYYY')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
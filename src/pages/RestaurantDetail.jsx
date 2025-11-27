import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Heart, Phone, Navigation, Globe, Clock, Users, 
  Star, ChevronRight, MapPin, Send, Minus, Plus, ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import OccupancyBadge from "@/components/ui/OccupancyBadge";
import SeatingBar from "@/components/ui/SeatingBar";
import PriceLevel from "@/components/ui/PriceLevel";
import StarRating from "@/components/ui/StarRating";
import moment from 'moment';
import { cn } from "@/lib/utils";

export default function RestaurantDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');

  const [currentUser, setCurrentUser] = useState(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const user = await base44.auth.me();
          setCurrentUser(user);
          setGuestName(user.full_name || '');
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Track view event
  useEffect(() => {
    if (restaurantId) {
      base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        event_type: 'view',
        user_id: currentUser?.id
      }).catch(() => {});
    }
  }, [restaurantId, currentUser]);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas', restaurantId],
    queryFn: () => base44.entities.RestaurantArea.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }),
    enabled: !!restaurantId,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurantId, 
      status: 'waiting' 
    }),
    enabled: !!restaurantId,
  });

  const isFavorite = favorites.some(f => f.restaurant_id === restaurantId);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        navigate(createPageUrl('Login'));
        return;
      }
      const existingFav = favorites.find(f => f.restaurant_id === restaurantId);
      if (existingFav) {
        await base44.entities.Favorite.delete(existingFav.id);
        await base44.entities.AnalyticsEvent.create({
          restaurant_id: restaurantId,
          event_type: 'favorite_remove',
          user_id: currentUser.id
        });
      } else {
        await base44.entities.Favorite.create({
          user_id: currentUser.id,
          restaurant_id: restaurantId
        });
        await base44.entities.AnalyticsEvent.create({
          restaurant_id: restaurantId,
          event_type: 'favorite_add',
          user_id: currentUser.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
    }
  });

  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.WaitlistEntry.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        guest_name: guestName,
        guest_phone: guestPhone,
        party_size: partySize,
        status: 'waiting'
      });
      await base44.entities.AnalyticsEvent.create({
        restaurant_id: restaurantId,
        event_type: 'waitlist_join',
        user_id: currentUser?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist']);
      setShowWaitlistDialog(false);
    }
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Review.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || 'Anonymous',
        rating: reviewRating,
        comment: reviewComment
      });
      // Update restaurant average
      const allReviews = [...reviews, { rating: reviewRating }];
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await base44.entities.Restaurant.update(restaurantId, {
        average_rating: avgRating,
        review_count: allReviews.length
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews']);
      queryClient.invalidateQueries(['restaurant']);
      setShowReviewDialog(false);
      setReviewComment('');
      setReviewRating(5);
    }
  });

  const trackClick = async (eventType) => {
    await base44.entities.AnalyticsEvent.create({
      restaurant_id: restaurantId,
      event_type: eventType,
      user_id: currentUser?.id
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Skeleton className="h-64 w-full" />
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Restaurant not found</h2>
          <Button onClick={() => navigate(createPageUrl('Home'))} className="mt-4">
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  const estimatedWait = waitlist.length * 10; // Simple estimate: 10 min per party

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero */}
      <div className="relative h-72 md:h-96">
        <img
          src={restaurant.cover_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Navigation */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-white/90 backdrop-blur-sm hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavoriteMutation.mutate()}
            className={cn(
              "rounded-full backdrop-blur-sm",
              isFavorite 
                ? "bg-red-500/90 text-white hover:bg-red-600" 
                : "bg-white/90 hover:bg-white"
            )}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </Button>
        </div>

        {/* Title */}
        <div className="absolute bottom-6 left-4 right-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {restaurant.name}
          </h1>
          <div className="flex items-center gap-3 text-white/90">
            <span>{restaurant.cuisine}</span>
            <span className="w-1 h-1 rounded-full bg-white/60" />
            <PriceLevel level={restaurant.price_level || 2} size="md" />
            <span className="w-1 h-1 rounded-full bg-white/60" />
            <StarRating 
              rating={restaurant.average_rating} 
              count={restaurant.review_count}
              showCount={true}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Live Seating Card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Live Seating</h3>
                  <p className="text-slate-500 text-sm">
                    Updated {restaurant.seating_updated_at 
                      ? moment(restaurant.seating_updated_at).fromNow() 
                      : 'recently'}
                  </p>
                </div>
              </div>
              <OccupancyBadge
                available={restaurant.available_seats}
                total={restaurant.total_seats}
                isFull={restaurant.is_full}
                size="lg"
              />
            </div>
            <SeatingBar 
              available={restaurant.available_seats} 
              total={restaurant.total_seats}
              height="h-3"
            />

            {/* Area breakdown */}
            {areas.length > 0 && (
              <div className="mt-6 pt-6 border-t space-y-3">
                <h4 className="font-medium text-slate-700">Seating Areas</h4>
                {areas.filter(a => a.is_open).map((area) => (
                  <div key={area.id} className="flex items-center justify-between">
                    <span className="text-slate-600">{area.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {area.available_seats} / {area.max_seats} seats
                      </span>
                      <Badge variant={area.available_seats > 0 ? "default" : "secondary"}>
                        {area.available_seats > 0 ? 'Open' : 'Full'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <a 
            href={`tel:${restaurant.phone}`}
            onClick={() => trackClick('call_click')}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Call</span>
          </a>
          <a 
            href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('directions_click')}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Directions</span>
          </a>
          <a 
            href={restaurant.website || restaurant.menu_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('website_click')}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Website</span>
          </a>
        </div>

        {/* Waitlist */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Join Waitlist</h3>
                <p className="text-slate-500 text-sm">
                  {waitlist.length} {waitlist.length === 1 ? 'party' : 'parties'} ahead • Est. wait: {estimatedWait} min
                </p>
              </div>
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            
            <Dialog open={showWaitlistDialog} onOpenChange={setShowWaitlistDialog}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-full h-12 text-base gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Users className="w-5 h-5" />
                  Join Waitlist
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join Waitlist</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Party Size</label>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPartySize(Math.max(1, partySize - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-2xl font-semibold w-12 text-center">{partySize}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPartySize(partySize + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Name</label>
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Phone (optional)</label>
                    <Input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="For notifications"
                    />
                  </div>
                  <Button 
                    className="w-full rounded-full h-12 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => joinWaitlistMutation.mutate()}
                    disabled={!guestName || joinWaitlistMutation.isPending}
                  >
                    {joinWaitlistMutation.isPending ? 'Joining...' : 'Confirm'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Photos */}
        {restaurant.photos?.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {restaurant.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`${restaurant.name} photo ${index + 1}`}
                    className="h-32 w-auto rounded-xl object-cover shrink-0"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold">{restaurant.address}</h3>
                <p className="text-slate-500 text-sm">{restaurant.neighborhood}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reviews</CardTitle>
            {currentUser && (
              <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    Write a Review
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Write a Review</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className="p-1"
                          >
                            <Star className={cn(
                              "w-8 h-8 transition-colors",
                              star <= reviewRating 
                                ? "fill-amber-400 text-amber-400" 
                                : "text-slate-300"
                            )} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Comment</label>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your experience..."
                        rows={4}
                      />
                    </div>
                    <Button 
                      className="w-full rounded-full h-12"
                      onClick={() => submitReviewMutation.mutate()}
                      disabled={submitReviewMutation.isPending}
                    >
                      {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No reviews yet. Be the first!</p>
            ) : (
              reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{review.user_name}</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{review.rating}</span>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-slate-600 text-sm">{review.comment}</p>
                  )}
                  <p className="text-slate-400 text-xs mt-2">
                    {moment(review.created_date).fromNow()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
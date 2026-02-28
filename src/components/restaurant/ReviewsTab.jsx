import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, Camera, X, Loader2, CheckCircle, ImageIcon, UtensilsCrossed, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReviewCard from './ReviewCard';
import ReviewSummary from './ReviewSummary';

// Star rating component
function StarPicker({ label, value, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0);
  const starSize = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  return (
    <div className="space-y-1">
      {label && <Label className="text-sm font-medium text-slate-700">{label}</Label>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={cn(
                starSize, 'transition-colors',
                star <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
              )}
            />
          </button>
        ))}
        {value > 0 && <span className="self-center text-sm text-slate-500 ml-1">{value}/5</span>}
      </div>
    </div>
  );
}

// Ambience vibe slider (1=Cozy, 5=Energetic)
function VibePicker({ value, onChange }) {
  const labels = ['', 'Cozy', 'Chill', 'Balanced', 'Lively', 'Energetic'];
  const colors = ['', 'bg-emerald-500', 'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">Ambience / Vibe</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-medium transition-all border-2',
              value === v
                ? `${colors[v]} text-white border-transparent shadow-md`
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {labels[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Photo upload section
function PhotoUploader({ photos, onPhotosChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('food'); // 'food' | 'interior' | 'exterior'

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length + photos.length > 8) {
      toast.error('Maximum 8 photos allowed');
      return;
    }
    setUploading(true);
    try {
      const results = await Promise.all(files.map(f => base44.integrations.Core.UploadFile({ file: f })));
      const newPhotos = results.map(r => ({ url: r.file_url, category: uploadCategory }));
      onPhotosChange([...photos, ...newPhotos]);
      toast.success('Photos uploaded!');
    } catch {
      toast.error('Failed to upload photos');
    }
    setUploading(false);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-slate-700">Add Photos (Optional)</Label>
      
      {/* Category selector */}
      <div className="flex gap-2">
        {[
          { value: 'food', label: '🍽️ Food', icon: UtensilsCrossed },
          { value: 'interior', label: '🏠 Inside', icon: ImageIcon },
          { value: 'exterior', label: '🌆 Outside', icon: Camera },
        ].map(cat => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setUploadCategory(cat.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              uploadCategory === cat.value
                ? 'bg-slate-900 text-white border-transparent'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Uploaded photos grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative">
              <img
                src={photo.url || photo}
                alt={`Upload ${idx + 1}`}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                {photo.category === 'food' ? '🍽️' : photo.category === 'interior' ? '🏠' : '🌆'}
              </span>
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 8 && (
        <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors">
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
          {uploading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            : <><Camera className="w-4 h-4 text-slate-500" /> Add {uploadCategory} photos ({photos.length}/8)</>
          }
        </label>
      )}
    </div>
  );
}

// Review submission form
function WriteReviewForm({ restaurant, currentUser, onSuccess }) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState({ overall: 0, food: 0, service: 0, value: 0 });
  const [vibeRating, setVibeRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      if (ratings.overall === 0) {
        throw new Error('Please give an overall rating');
      }

      const photoUrls = photos.map(p => p.url || p);

      await base44.entities.Review.create({
        restaurant_id: restaurant.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        rating: ratings.overall,
        food_rating: ratings.food || null,
        service_rating: ratings.service || null,
        value_rating: ratings.value || null,
        ambiance_rating: vibeRating || null,
        vibe_rating: vibeRating || null,
        comment,
        photos: photoUrls,
        tags: [],
        is_hidden: false
      });

      // Update restaurant rating average
      const allReviews = await base44.entities.Review.filter({ restaurant_id: restaurant.id, is_hidden: false });
      const totalRating = allReviews.reduce((s, r) => s + r.rating, 0);
      const newAvg = totalRating / allReviews.length;

      // Update ambience average from vibe_rating
      const vibeReviews = allReviews.filter(r => r.vibe_rating);
      const vibeAvg = vibeReviews.length > 0
        ? vibeReviews.reduce((s, r) => s + r.vibe_rating, 0) / vibeReviews.length
        : null;

      await base44.entities.Restaurant.update(restaurant.id, {
        average_rating: Math.round(newAvg * 10) / 10,
        review_count: allReviews.length,
        ...(vibeAvg !== null ? { avg_vibe_rating: vibeAvg } : {})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews', restaurant.id]);
      queryClient.invalidateQueries(['restaurant', restaurant.id]);
      setSubmitted(true);
      toast.success('Thank you for your review!');
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message || 'Failed to submit review')
  });

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold mb-1">Review submitted!</h3>
        <p className="text-slate-500 text-sm">Your feedback helps others discover great dining experiences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StarPicker
        label="Overall Rating *"
        value={ratings.overall}
        onChange={(v) => setRatings(prev => ({ ...prev, overall: v }))}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StarPicker
          label="Food Quality"
          value={ratings.food}
          onChange={(v) => setRatings(prev => ({ ...prev, food: v }))}
          size="sm"
        />
        <StarPicker
          label="Service"
          value={ratings.service}
          onChange={(v) => setRatings(prev => ({ ...prev, service: v }))}
          size="sm"
        />
        <StarPicker
          label="Value for Money"
          value={ratings.value}
          onChange={(v) => setRatings(prev => ({ ...prev, value: v }))}
          size="sm"
        />
      </div>

      <VibePicker value={vibeRating} onChange={setVibeRating} />

      <div>
        <Label>Your Review</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us about your experience — food, service, atmosphere..."
          className="mt-2 min-h-[120px]"
        />
      </div>

      <PhotoUploader photos={photos} onPhotosChange={setPhotos} />

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={ratings.overall === 0 || submitMutation.isPending}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        size="lg"
      >
        {submitMutation.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
          : 'Submit Review'
        }
      </Button>
    </div>
  );
}

// Photo gallery from all reviews
function ReviewPhotoGallery({ reviews }) {
  const [filter, setFilter] = useState('all');
  
  const allPhotos = useMemo(() => {
    return reviews.flatMap(r =>
      (r.photos || []).map(p => ({
        url: typeof p === 'string' ? p : p.url,
        category: typeof p === 'string' ? 'general' : (p.category || 'general'),
        reviewerName: r.user_name || 'Diner',
        rating: r.rating
      }))
    );
  }, [reviews]);

  const filtered = filter === 'all' ? allPhotos : allPhotos.filter(p => p.category === filter);

  if (allPhotos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="w-4 h-4" />
          Guest Photos ({allPhotos.length})
        </CardTitle>
        <div className="flex gap-2 mt-2">
          {['all', 'food', 'interior', 'exterior'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                filter === cat
                  ? 'bg-slate-900 text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {cat === 'all' ? '📷 All' : cat === 'food' ? '🍽️ Food' : cat === 'interior' ? '🏠 Inside' : '🌆 Outside'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtered.map((photo, idx) => (
            <div key={idx} className="relative group aspect-square">
              <img
                src={photo.url}
                alt={`Guest photo ${idx + 1}`}
                className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(photo.url, '_blank')}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs">{photo.reviewerName}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main reviews tab
export default function ReviewsTab({ restaurant, reviews, currentUser }) {
  const [showForm, setShowForm] = useState(false);

  // Check if current user already reviewed
  const alreadyReviewed = useMemo(() =>
    currentUser && reviews.some(r => r.user_id === currentUser.id),
    [reviews, currentUser]
  );

  const allPhotos = useMemo(() =>
    reviews.flatMap(r => (r.photos || []).filter(Boolean)),
    [reviews]
  );

  return (
    <div className="space-y-6">
      {/* AI Summary — only if there are real reviews with comments */}
      <ReviewSummary
        reviews={reviews}
        restaurantName={restaurant.name}
        restaurantId={restaurant.id}
        currentUser={currentUser}
        expanded
      />

      {/* Photo Gallery from all reviews */}
      <ReviewPhotoGallery reviews={reviews} />

      {/* Write a Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Reviews ({reviews.length})</span>
            {!alreadyReviewed && currentUser && !showForm && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="sm"
              >
                <Star className="w-4 h-4 mr-1.5" />
                Write a Review
              </Button>
            )}
            {!currentUser && (
              <Button
                onClick={() => base44.auth.redirectToLogin(window.location.href)}
                variant="outline"
                size="sm"
              >
                Sign in to Review
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showForm && currentUser && !alreadyReviewed && (
            <div className="mb-8 pb-8 border-b">
              <h3 className="font-semibold text-slate-900 mb-4">Share your experience at {restaurant.name}</h3>
              <WriteReviewForm
                restaurant={restaurant}
                currentUser={currentUser}
                onSuccess={() => setShowForm(false)}
              />
            </div>
          )}

          {alreadyReviewed && (
            <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-700">
              ✓ You've already reviewed this restaurant. Thank you!
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Star className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No reviews yet</p>
              <p className="text-sm mt-1">Be the first to share your experience!</p>
              {currentUser && !showForm && (
                <Button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600"
                  size="sm"
                >
                  Write the first review
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUser={currentUser}
                  isOwner={currentUser?.id === restaurant.owner_id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
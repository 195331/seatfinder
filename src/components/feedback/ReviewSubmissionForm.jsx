import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReviewSubmissionForm({ reservation, restaurant, onSubmitSuccess }) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState({
    overall: 0,
    food: 0,
    service: 0,
    ambiance: 0
  });
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      await base44.entities.Review.create({
        restaurant_id: restaurant.id,
        user_id: user.id,
        user_name: user.full_name,
        rating: ratings.overall,
        comment,
        tags: [],
        vibe_rating: ratings.ambiance,
        noise_level: 3,
        is_hidden: false
      });

      const totalReviews = restaurant.review_count || 0;
      const currentAvg = restaurant.average_rating || 0;
      const newAvg = ((currentAvg * totalReviews) + ratings.overall) / (totalReviews + 1);

      await base44.entities.Restaurant.update(restaurant.id, {
        average_rating: newAvg,
        review_count: totalReviews + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews']);
      queryClient.invalidateQueries(['restaurants']);
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
      onSubmitSuccess?.();
    }
  });

  const RatingStars = ({ label, value, onChange }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "w-8 h-8 transition-colors",
                star <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-300"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (submitted) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Thank you!</h3>
          <p className="text-slate-600">Your feedback helps make dining better for everyone.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>How was your experience at {restaurant.name}?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RatingStars
          label="Overall Experience"
          value={ratings.overall}
          onChange={(val) => setRatings({ ...ratings, overall: val })}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RatingStars
            label="Food Quality"
            value={ratings.food}
            onChange={(val) => setRatings({ ...ratings, food: val })}
          />
          <RatingStars
            label="Service"
            value={ratings.service}
            onChange={(val) => setRatings({ ...ratings, service: val })}
          />
          <RatingStars
            label="Ambiance"
            value={ratings.ambiance}
            onChange={(val) => setRatings({ ...ratings, ambiance: val })}
          />
        </div>

        <div>
          <Label>Tell us more about your experience</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you love? What could be better?"
            className="mt-2 min-h-[120px]"
          />
        </div>

        <Button
          onClick={() => submitMutation.mutate()}
          disabled={ratings.overall === 0 || submitMutation.isPending}
          className="w-full"
          size="lg"
        >
          {submitMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
          ) : (
            'Submit Review'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
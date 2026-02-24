import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ReviewCard({ review, currentUser, isOwner }) {
  const queryClient = useQueryClient();
  const [showResponse, setShowResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [showPhotos, setShowPhotos] = useState(false);

  const respondMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.Review.update(review.id, {
        restaurant_response: responseText,
        restaurant_response_date: new Date().toISOString(),
        restaurant_response_by: currentUser.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviews']);
      toast.success('Response posted');
      setShowResponse(false);
      setResponseText('');
    }
  });

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "w-4 h-4",
            star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </div>
  );

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
          {review.user_name?.[0] || 'U'}
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold">{review.user_name || 'Anonymous'}</h4>
              <p className="text-xs text-slate-500">
                {new Date(review.created_date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {renderStars(review.rating)}
              <span className="text-sm font-medium ml-1">{review.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Detailed Ratings */}
          {(review.food_rating || review.service_rating || review.ambiance_rating || review.value_rating) && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              {review.food_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-medium">Food:</span>
                  {renderStars(review.food_rating)}
                </div>
              )}
              {review.service_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-medium">Service:</span>
                  {renderStars(review.service_rating)}
                </div>
              )}
              {review.ambiance_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-medium">Ambiance:</span>
                  {renderStars(review.ambiance_rating)}
                </div>
              )}
              {review.value_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-medium">Value:</span>
                  {renderStars(review.value_rating)}
                </div>
              )}
            </div>
          )}

          {review.comment && (
            <p className="text-slate-700 mb-3">{review.comment}</p>
          )}

          {/* Tags */}
          {review.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {review.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Photos */}
          {review.photos?.length > 0 && (
            <div className="mb-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {review.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo}
                    alt={`Review photo ${idx + 1}`}
                    className="w-24 h-24 rounded-xl object-cover cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                    onClick={() => window.open(photo, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Restaurant Response */}
          {review.restaurant_response && (
            <div className="mt-3 pl-4 border-l-2 border-emerald-500 bg-emerald-50 p-3 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-emerald-600">Restaurant Response</Badge>
                <span className="text-xs text-slate-500">
                  {new Date(review.restaurant_response_date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-slate-700">{review.restaurant_response}</p>
            </div>
          )}

          {/* Owner Response Section */}
          {isOwner && !review.restaurant_response && (
            <div className="mt-3">
              {!showResponse ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResponse(true)}
                  className="gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Respond to Review
                </Button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Thank the customer and address their feedback..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => respondMutation.mutate()}
                      disabled={!responseText.trim() || respondMutation.isPending}
                    >
                      Post Response
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowResponse(false);
                        setResponseText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
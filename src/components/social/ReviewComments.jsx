import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function ReviewComments({ reviewId, currentUser }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['reviewComments', reviewId],
    queryFn: () => base44.entities.ReviewComment.filter({ review_id: reviewId, is_hidden: false }, '-created_date'),
    enabled: showComments,
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.ReviewComment.create({
        review_id: reviewId,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email,
        comment: newComment
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviewComments']);
      setNewComment('');
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      await base44.entities.ReviewComment.delete(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviewComments']);
    }
  });

  return (
    <div className="mt-3">
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Add comment'}
      </button>

      {showComments && (
        <div className="mt-3 space-y-3 pl-4 border-l-2 border-slate-200">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-900">{comment.user_name}</span>
                    <span className="text-xs text-slate-400">{moment(comment.created_date).fromNow()}</span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.comment}</p>
                </div>
                {currentUser?.id === comment.user_id && (
                  <button
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {currentUser && (
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="text-sm"
                rows={2}
              />
              <Button
                size="sm"
                onClick={() => addCommentMutation.mutate()}
                disabled={!newComment.trim() || addCommentMutation.isPending}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
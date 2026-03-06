import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from 'lucide-react';

export default function FollowButton({ currentUser, targetUserId, targetUserName, targetUserEmail }) {
  const queryClient = useQueryClient();

  const { data: follows = [] } = useQuery({
    queryKey: ['follows', currentUser?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const isFollowing = follows.some(f => f.following_id === targetUserId);

  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      const existingFollow = follows.find(f => f.following_id === targetUserId);
      if (existingFollow) {
        await base44.entities.Follow.delete(existingFollow.id);
      } else {
        await base44.entities.Follow.create({
          follower_id: currentUser.id,
          follower_email: currentUser.email,
          follower_name: currentUser.full_name,
          following_id: targetUserId,
          following_email: targetUserEmail,
          following_name: targetUserName
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['follows']);
    }
  });

  if (!currentUser) return null;
  // Allow following any userId (real user or bot) except yourself
  if (currentUser.id === targetUserId) return null;

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={() => toggleFollowMutation.mutate()}
      disabled={toggleFollowMutation.isPending}
      className="gap-2"
    >
      {isFollowing ? (
        <>
          <UserCheck className="w-4 h-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Follow
        </>
      )}
    </Button>
  );
}
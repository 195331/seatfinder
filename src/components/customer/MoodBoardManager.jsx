import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Heart, Share2, Trash2, Edit2, Sparkles, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import RestaurantCard from './RestaurantCard';
import { cn } from "@/lib/utils";

export default function MoodBoardManager({ currentUser, allRestaurants, onRestaurantClick }) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardEmoji, setNewBoardEmoji] = useState('✨');
  const [selectedBoard, setSelectedBoard] = useState(null);

  const MOOD_EMOJIS = ['✨', '💕', '🌙', '☀️', '🍷', '🎉', '🌸', '🔥', '💫', '🌊'];

  // Fetch user's mood boards (stored as FilterPreset with special flag)
  const { data: moodBoards = [] } = useQuery({
    queryKey: ['moodBoards', currentUser?.id],
    queryFn: () => base44.entities.FilterPreset.filter({ 
      user_id: currentUser.id 
    }),
    enabled: !!currentUser,
  });

  // Fetch favorites to show in boards
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['boardRestaurants', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const uniqueRestaurantIds = [...new Set(favorites.map(f => f.restaurant_id))];
      const restaurantPromises = uniqueRestaurantIds.map(id => 
        base44.entities.Restaurant.filter({ id }).then(r => r[0])
      );
      const results = await Promise.all(restaurantPromises);
      return results.filter(Boolean);
    },
    enabled: favorites.length > 0,
  });

  const createBoardMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.FilterPreset.create({
        user_id: currentUser.id,
        name: newBoardName,
        icon: newBoardEmoji,
        filters: { mood_board: true, restaurant_ids: [] }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moodBoards']);
      setShowCreateDialog(false);
      setNewBoardName('');
      setNewBoardEmoji('✨');
      toast.success('Mood board created!');
    }
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId) => base44.entities.FilterPreset.delete(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries(['moodBoards']);
      setSelectedBoard(null);
      toast.success('Mood board deleted');
    }
  });

  const addToBoardMutation = useMutation({
    mutationFn: async ({ boardId, restaurantId }) => {
      const board = moodBoards.find(b => b.id === boardId);
      const currentIds = board.filters.restaurant_ids || [];
      if (!currentIds.includes(restaurantId)) {
        await base44.entities.FilterPreset.update(boardId, {
          filters: { ...board.filters, restaurant_ids: [...currentIds, restaurantId] }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moodBoards']);
      toast.success('Added to board!');
    }
  });

  const removeFromBoardMutation = useMutation({
    mutationFn: async ({ boardId, restaurantId }) => {
      const board = moodBoards.find(b => b.id === boardId);
      const currentIds = board.filters.restaurant_ids || [];
      await base44.entities.FilterPreset.update(boardId, {
        filters: { ...board.filters, restaurant_ids: currentIds.filter(id => id !== restaurantId) }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moodBoards']);
    }
  });

  const shareBoard = async (board) => {
    const boardRestaurants = restaurants.filter(r => 
      (board.filters.restaurant_ids || []).includes(r.id)
    );
    const text = `Check out my "${board.name}" mood board on SeatFinder!\n\n${boardRestaurants.map(r => `🍽️ ${r.name}`).join('\n')}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: board.name, text });
        toast.success('Board shared!');
      } catch (error) {
        // Fallback to clipboard if share fails
        navigator.clipboard.writeText(text);
        toast.success('Board copied to clipboard!');
      }
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Board copied to clipboard!');
    }
  };

  const selectedBoardRestaurants = selectedBoard 
    ? restaurants.filter(r => (selectedBoard.filters.restaurant_ids || []).includes(r.id))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mood Boards</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Board
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mood Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Board Name</label>
                <Input 
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Date Night Spots, Weekend Brunch..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Choose an Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {MOOD_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewBoardEmoji(emoji)}
                      className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition-all",
                        newBoardEmoji === emoji 
                          ? "bg-emerald-100 ring-2 ring-emerald-500" 
                          : "bg-slate-100 hover:bg-slate-200"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => createBoardMutation.mutate()}
                disabled={!newBoardName || createBoardMutation.isPending}
                className="w-full"
              >
                {createBoardMutation.isPending ? 'Creating...' : 'Create Board'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {moodBoards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">Create Your First Mood Board</h3>
            <p className="text-slate-500 text-sm mb-4">
              Organize your favorite restaurants by vibe, occasion, or cuisine
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {moodBoards.map(board => {
            const boardRestaurantCount = (board.filters.restaurant_ids || []).length;
            return (
              <button
                key={board.id}
                onClick={() => setSelectedBoard(board)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all hover:scale-105",
                  selectedBoard?.id === board.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="text-3xl mb-2">{board.icon}</div>
                <p className="font-medium text-sm text-slate-900">{board.name}</p>
                <p className="text-xs text-slate-500 mt-1">{boardRestaurantCount} places</p>
              </button>
            );
          })}
        </div>
      )}

      {selectedBoard && (
        <>
          {/* AI Suggestions */}
          {allRestaurants && allRestaurants.length > 0 && (
            <div className="mb-4">
              <MoodBoardAI
                moodBoard={selectedBoard}
                restaurants={allRestaurants}
                onRestaurantClick={onRestaurantClick}
              />
            </div>
          )}
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedBoard.icon}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedBoard.name}</h3>
                    <p className="text-sm text-slate-500">{selectedBoardRestaurants.length} restaurants</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shareBoard(selectedBoard)}
                    className="gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBoardMutation.mutate(selectedBoard.id)}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>

            {selectedBoardRestaurants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No restaurants in this board yet</p>
                <p className="text-sm text-slate-400 mt-1">Add restaurants from your favorites</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedBoardRestaurants.map(restaurant => (
                  <div key={restaurant.id} className="relative">
                    <RestaurantCard restaurant={restaurant} compact />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromBoardMutation.mutate({ 
                        boardId: selectedBoard.id, 
                        restaurantId: restaurant.id 
                      })}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Quick Add to Board - show for favorites not in any board */}
      {selectedBoard && restaurants.filter(r => 
        !(selectedBoard.filters.restaurant_ids || []).includes(r.id)
      ).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-3">Add from Favorites</h4>
            <div className="flex gap-2 flex-wrap">
              {restaurants
                .filter(r => !(selectedBoard.filters.restaurant_ids || []).includes(r.id))
                .slice(0, 5)
                .map(restaurant => (
                  <Button
                    key={restaurant.id}
                    variant="outline"
                    size="sm"
                    onClick={() => addToBoardMutation.mutate({ 
                      boardId: selectedBoard.id, 
                      restaurantId: restaurant.id 
                    })}
                    className="gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    {restaurant.name}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
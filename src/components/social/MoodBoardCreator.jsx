import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Heart, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

const THEMES = [
  { value: 'date_night', label: 'Date Night', icon: '💕' },
  { value: 'celebration', label: 'Celebration', icon: '🎉' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'casual', label: 'Casual', icon: '😊' },
  { value: 'fine_dining', label: 'Fine Dining', icon: '🍷' },
  { value: 'brunch', label: 'Brunch', icon: '🥞' },
  { value: 'late_night', label: 'Late Night', icon: '🌙' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'custom', label: 'Custom', icon: '✨' }
];

export default function MoodBoardCreator({ currentUser, allRestaurants, onClose }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('custom');
  const [selectedRestaurants, setSelectedRestaurants] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const queryClient = useQueryClient();

  const { data: moodBoards = [] } = useQuery({
    queryKey: ['moodBoards', currentUser?.id],
    queryFn: () => base44.entities.MoodBoard.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  const createMoodBoardMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.MoodBoard.create({
        user_id: currentUser.id,
        name,
        description,
        theme,
        restaurant_ids: selectedRestaurants,
        is_public: isPublic
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['moodBoards']);
      toast.success('Mood board created!');
      setOpen(false);
      resetForm();
      if (onClose) onClose();
    }
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setTheme('custom');
    setSelectedRestaurants([]);
    setIsPublic(true);
    setSearchTerm('');
  };

  const handleToggleRestaurant = (restaurantId) => {
    setSelectedRestaurants(prev =>
      prev.includes(restaurantId)
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId]
    );
  };

  const filteredRestaurants = allRestaurants.filter(r =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        <Plus className="w-4 h-4" />
        Create Mood Board
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a Mood Board</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Perfect Date Night Spots"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Curated restaurants for romantic evenings..."
                rows={2}
              />
            </div>

            {/* Theme Selection */}
            <div>
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === t.value
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{t.icon}</span>
                    <span className="text-xs font-medium text-slate-900">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label className="flex items-center gap-2">
                {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                Make public (others can view and like)
              </Label>
            </div>

            {/* Restaurant Selection */}
            <div>
              <Label>Add Restaurants ({selectedRestaurants.length})</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search restaurants..."
                className="mt-2 mb-3"
              />
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                {filteredRestaurants.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    onClick={() => handleToggleRestaurant(restaurant.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRestaurants.includes(restaurant.id)
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedRestaurants.includes(restaurant.id)}
                        onCheckedChange={() => handleToggleRestaurant(restaurant.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{restaurant.name}</p>
                        <p className="text-sm text-slate-500">{restaurant.cuisine}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMoodBoardMutation.mutate()}
                disabled={!name || selectedRestaurants.length === 0 || createMoodBoardMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                Create Mood Board
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
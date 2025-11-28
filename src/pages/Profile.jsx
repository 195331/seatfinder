import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FOOD_AVATARS = [
  { id: 'pizza', emoji: '🍕', name: 'Pizza' },
  { id: 'burger', emoji: '🍔', name: 'Burger' },
  { id: 'sushi', emoji: '🍣', name: 'Sushi' },
  { id: 'taco', emoji: '🌮', name: 'Taco' },
  { id: 'ramen', emoji: '🍜', name: 'Ramen' },
  { id: 'salad', emoji: '🥗', name: 'Salad' },
  { id: 'steak', emoji: '🥩', name: 'Steak' },
  { id: 'pasta', emoji: '🍝', name: 'Pasta' },
  { id: 'icecream', emoji: '🍦', name: 'Ice Cream' },
  { id: 'donut', emoji: '🍩', name: 'Donut' },
  { id: 'cake', emoji: '🎂', name: 'Cake' },
  { id: 'cookie', emoji: '🍪', name: 'Cookie' },
  { id: 'fries', emoji: '🍟', name: 'Fries' },
  { id: 'hotdog', emoji: '🌭', name: 'Hot Dog' },
  { id: 'sandwich', emoji: '🥪', name: 'Sandwich' },
  { id: 'croissant', emoji: '🥐', name: 'Croissant' },
  { id: 'bagel', emoji: '🥯', name: 'Bagel' },
  { id: 'pancakes', emoji: '🥞', name: 'Pancakes' },
  { id: 'waffle', emoji: '🧇', name: 'Waffle' },
  { id: 'bacon', emoji: '🥓', name: 'Bacon' },
  { id: 'egg', emoji: '🍳', name: 'Egg' },
  { id: 'cheese', emoji: '🧀', name: 'Cheese' },
  { id: 'popcorn', emoji: '🍿', name: 'Popcorn' },
  { id: 'pretzel', emoji: '🥨', name: 'Pretzel' },
  { id: 'dumpling', emoji: '🥟', name: 'Dumpling' },
  { id: 'curry', emoji: '🍛', name: 'Curry' },
  { id: 'bento', emoji: '🍱', name: 'Bento' },
  { id: 'shrimp', emoji: '🍤', name: 'Shrimp' },
  { id: 'lobster', emoji: '🦞', name: 'Lobster' },
  { id: 'cupcake', emoji: '🧁', name: 'Cupcake' },
];

export default function Profile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(createPageUrl('Profile'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
        setFullName(user.full_name || '');
        setSelectedAvatar(user.avatar || null);
        setIsNewUser(!user.profile_complete);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const handleSave = async () => {
    if (!selectedAvatar) {
      toast.error("Please select an avatar");
      return;
    }
    
    setIsSaving(true);
    try {
      await base44.auth.updateMe({
        avatar: selectedAvatar,
        profile_complete: true
      });

      if (isNewUser) {
        // Create welcome notification
        await base44.entities.Notification.create({
          user_id: currentUser.id,
          user_email: currentUser.email,
          type: 'welcome',
          title: 'Welcome to SeatFinder!',
          message: 'Your account is all set up. Start exploring restaurants and making reservations!'
        });
      }

      toast.success("Profile saved!");
      navigate(createPageUrl('Home'));
    } catch (e) {
      toast.error("Failed to save profile");
    }
    setIsSaving(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {!isNewUser && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="font-bold text-lg">
                {isNewUser ? 'Complete Your Profile' : 'Edit Profile'}
              </h1>
              <p className="text-sm text-slate-500">
                {isNewUser ? 'Choose your food avatar!' : 'Update your profile'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Current Avatar Preview */}
        <Card className="border-0 shadow-lg">
          <CardContent className="py-8 text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-5xl mb-4">
              {selectedAvatar ? FOOD_AVATARS.find(a => a.id === selectedAvatar)?.emoji : '🍽️'}
            </div>
            <h2 className="text-xl font-semibold">{fullName || currentUser.email}</h2>
            <p className="text-slate-500">{currentUser.email}</p>
          </CardContent>
        </Card>

        {/* Avatar Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Choose Your Food Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
              {FOOD_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={cn(
                    "relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all hover:scale-105",
                    selectedAvatar === avatar.id
                      ? "bg-emerald-100 ring-2 ring-emerald-500 ring-offset-2"
                      : "bg-slate-100 hover:bg-slate-200"
                  )}
                >
                  <span className="text-3xl">{avatar.emoji}</span>
                  {selectedAvatar === avatar.id && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !selectedAvatar}
          className="w-full h-12 rounded-full text-base bg-emerald-600 hover:bg-emerald-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {isNewUser ? 'Complete Setup' : 'Save Changes'}
            </>
          )}
        </Button>
      </main>
    </div>
  );
}
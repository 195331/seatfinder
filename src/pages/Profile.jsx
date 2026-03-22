import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';
import { Check, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FOOD_AVATARS = [
  { id: 'pizza', emoji: '🍕' }, { id: 'burger', emoji: '🍔' },
  { id: 'sushi', emoji: '🍣' }, { id: 'taco', emoji: '🌮' },
  { id: 'ramen', emoji: '🍜' }, { id: 'salad', emoji: '🥗' },
  { id: 'steak', emoji: '🥩' }, { id: 'pasta', emoji: '🍝' },
  { id: 'icecream', emoji: '🍦' }, { id: 'donut', emoji: '🍩' },
  { id: 'cake', emoji: '🎂' }, { id: 'cookie', emoji: '🍪' },
  { id: 'fries', emoji: '🍟' }, { id: 'hotdog', emoji: '🌭' },
  { id: 'sandwich', emoji: '🥪' }, { id: 'croissant', emoji: '🥐' },
  { id: 'bagel', emoji: '🥯' }, { id: 'pancakes', emoji: '🥞' },
  { id: 'waffle', emoji: '🧇' }, { id: 'bacon', emoji: '🥓' },
  { id: 'egg', emoji: '🍳' }, { id: 'cheese', emoji: '🧀' },
  { id: 'popcorn', emoji: '🍿' }, { id: 'pretzel', emoji: '🥨' },
  { id: 'dumpling', emoji: '🥟' }, { id: 'curry', emoji: '🍛' },
  { id: 'bento', emoji: '🍱' }, { id: 'shrimp', emoji: '🍤' },
  { id: 'lobster', emoji: '🦞' }, { id: 'cupcake', emoji: '🧁' },
];

export default function Profile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate(createPageUrl('Landing'));
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          full_name: profile?.full_name || session.user.user_metadata?.full_name || '',
          ...profile,
        });

        setSelectedAvatar(profile?.avatar || null);
        setIsNewUser(!profile?.profile_complete);

        // If profile already complete, skip straight to Home
        if (profile?.profile_complete) {
          navigate(createPageUrl('Home'));
          return;
        }
      } catch (e) {
        navigate(createPageUrl('Home'));
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.full_name,
          avatar: selectedAvatar,
          profile_complete: true,
        });

      if (error) throw error;

      toast.success('Profile saved!');
      navigate(createPageUrl('Home'));
    } catch (e) {
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    navigate(createPageUrl('Home'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
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
              <p className="text-sm text-slate-500">Choose your food avatar!</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip →
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Avatar Preview */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-5xl mx-auto mb-4">
            {selectedAvatar
              ? FOOD_AVATARS.find(a => a.id === selectedAvatar)?.emoji
              : '🍽️'}
          </div>
          <h2 className="text-xl font-semibold">{currentUser.full_name || currentUser.email}</h2>
          <p className="text-slate-500 text-sm">{currentUser.email}</p>
        </div>

        {/* Avatar Grid */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-1">Choose a Food Avatar</h3>
          <p className="text-sm text-slate-500 mb-4">Pick an emoji that represents you</p>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
            {FOOD_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={cn(
                  "relative aspect-square rounded-xl flex items-center justify-center text-3xl transition-all hover:scale-105",
                  selectedAvatar === avatar.id
                    ? "bg-emerald-100 ring-2 ring-emerald-500 ring-offset-2"
                    : "bg-slate-100 hover:bg-slate-200"
                )}
              >
                {avatar.emoji}
                {selectedAvatar === avatar.id && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !selectedAvatar}
          className="w-full h-12 rounded-full text-base bg-emerald-600 hover:bg-emerald-700"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <><Check className="w-4 h-4 mr-2" />Complete Setup</>
          )}
        </Button>

        <p className="text-center text-sm text-slate-400">
          You can always change this later in settings
        </p>
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TASTE_OPTIONS = [
  { id: 'vegetarian_friendly', label: 'Vegetarian-friendly', icon: '🥗' },
  { id: 'outdoor_seating', label: 'Outdoor seating', icon: '🌿' },
  { id: 'quiet_atmosphere', label: 'Quiet atmosphere', icon: '🤫' },
  { id: 'kid_friendly', label: 'Kid-friendly', icon: '👨‍👩‍👧‍👦' },
  { id: 'bar_seating', label: 'Bar seating', icon: '🍸' }
];

export default function TasteProfile({ currentUser }) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState(currentUser?.taste_profile || {});

  const updateMutation = useMutation({
    mutationFn: (tasteProfile) => base44.auth.updateMe({ taste_profile: tasteProfile }),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success('Taste profile updated');
    }
  });

  const togglePreference = (id) => {
    const updated = { ...profile, [id]: !profile[id] };
    setProfile(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taste Profile</CardTitle>
        <p className="text-sm text-slate-500">Help us recommend restaurants you'll love</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {TASTE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => togglePreference(option.id)}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
              profile[option.id]
                ? "bg-emerald-50 border-emerald-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            )}
          >
            <span className="text-2xl">{option.icon}</span>
            <span className="flex-1 text-left font-medium text-slate-900">{option.label}</span>
            {profile[option.id] && (
              <Check className="w-5 h-5 text-emerald-600" />
            )}
          </button>
        ))}
        
        <Button
          onClick={() => updateMutation.mutate(profile)}
          disabled={updateMutation.isPending}
          className="w-full mt-4"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
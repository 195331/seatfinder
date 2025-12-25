import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SEATING_PREFS = [
  { id: 'booth', label: 'Booth' },
  { id: 'window', label: 'Window' },
  { id: 'bar', label: 'Bar' },
  { id: 'patio', label: 'Patio' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'quiet', label: 'Quiet' }
];

export default function ExpressProfileSetup({ open, onOpenChange, currentUser }) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({
    default_party_size: currentUser?.express_profile?.default_party_size || 2,
    phone: currentUser?.express_profile?.phone || '',
    seating_prefs: currentUser?.express_profile?.seating_prefs || []
  });

  const saveMutation = useMutation({
    mutationFn: () => base44.auth.updateMe({ express_profile: profile }),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      toast.success('Express profile saved! Reserve in 2 taps now.');
      onOpenChange(false);
    }
  });

  const togglePref = (pref) => {
    setProfile({
      ...profile,
      seating_prefs: profile.seating_prefs.includes(pref)
        ? profile.seating_prefs.filter(p => p !== pref)
        : [...profile.seating_prefs, pref]
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Express Profile Setup
          </DialogTitle>
          <p className="text-sm text-slate-500">Book reservations in 2 taps with your saved preferences</p>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Default Party Size</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={profile.default_party_size}
              onChange={(e) => setProfile({ ...profile, default_party_size: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              type="tel"
              placeholder="For confirmations & updates"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Seating Preferences (optional)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {SEATING_PREFS.map(pref => (
                <button
                  key={pref.id}
                  onClick={() => togglePref(pref.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg border transition-all flex items-center gap-2",
                    profile.seating_prefs.includes(pref.id)
                      ? "bg-purple-100 border-purple-300 text-purple-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {profile.seating_prefs.includes(pref.id) && <Check className="w-4 h-4" />}
                  {pref.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!profile.phone || saveMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Express Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
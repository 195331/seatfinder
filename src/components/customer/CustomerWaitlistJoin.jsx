import React, { useState } from 'react';
import { Users, Plus, Clock, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import moment from 'moment';

export default function CustomerWaitlistJoin({ restaurantId, currentUser }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ guest_name: currentUser?.full_name || '', guest_phone: '', party_size: 2 });
  const [joined, setJoined] = useState(false);

  const { data: waitlist = [] } = useQuery({
    queryKey: ['publicWaitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter(
      { restaurant_id: restaurantId },
      '-created_date'
    ),
    enabled: !!restaurantId,
    refetchInterval: 30000,
  });

  const waitingEntries = waitlist.filter(e => ['waiting', 'notified', 'confirmed'].includes(e?.status));

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!form.guest_name || !form.guest_phone) throw new Error('Name and phone are required');
      // Check for existing active entry for this restaurant
      if (currentUser) {
        const existing = waitingEntries.find(e => e.user_id === currentUser.id);
        if (existing) throw new Error("You're already on the waitlist for this restaurant.");
      }
      return base44.entities.WaitlistEntry.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id || null,
        guest_name: form.guest_name,
        guest_phone: form.guest_phone,
        party_size: Number(form.party_size) || 2,
        status: 'waiting',
        position: waitingEntries.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['publicWaitlist', restaurantId]);
      toast.success("You've been added to the waitlist!");
      setShowForm(false);
      setJoined(true);
    },
    onError: (e) => toast.error(e.message || 'Failed to join waitlist'),
  });

  // Find this user's active entry
  const myEntry = currentUser
    ? waitingEntries.find(e => e.user_id === currentUser.id)
    : null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="w-5 h-5 text-purple-500" />
            Waitlist
          </CardTitle>
          {!myEntry && !joined && (
            <Button
              size="sm"
              className="rounded-full bg-slate-900 hover:bg-slate-800 gap-1.5"
              onClick={() => {
                if (!currentUser) {
                  base44.auth.redirectToLogin(window.location.href);
                  return;
                }
                setShowForm(v => !v);
              }}
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* My active entry */}
        {myEntry && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-emerald-800">You're on the waitlist!</span>
            </div>
            <p className="text-sm text-emerald-700">
              Position #{waitingEntries.findIndex(e => e.id === myEntry.id) + 1} · Party of {myEntry.party_size}
              {myEntry.estimated_wait_minutes ? ` · ~${myEntry.estimated_wait_minutes} min wait` : ''}
            </p>
          </div>
        )}

        {/* Join form */}
        {showForm && !myEntry && (
          <div className="space-y-3 border rounded-xl p-4 bg-slate-50">
            <div>
              <Label className="text-xs text-slate-600">Your Name</Label>
              <Input
                value={form.guest_name}
                onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                placeholder="Jane Smith"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Phone Number</Label>
              <Input
                value={form.guest_phone}
                onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                type="tel"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Party Size</Label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setForm(f => ({ ...f, party_size: n }))}
                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition-all ${
                      form.party_size === n
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-full bg-slate-900 hover:bg-slate-800"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? 'Joining...' : 'Join Waitlist'}
              </Button>
            </div>
          </div>
        )}

        {/* Queue preview */}
        {waitingEntries.length === 0 && !showForm && !myEntry ? (
          <p className="text-center text-slate-400 text-sm py-4">No one waiting</p>
        ) : waitingEntries.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              {waitingEntries.length} {waitingEntries.length === 1 ? 'party' : 'parties'} ahead
            </div>
            {waitingEntries.slice(0, 4).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 text-sm text-slate-600 py-1">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center font-medium text-slate-500">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-800">{entry.guest_name || 'Guest'}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  <Users className="w-3 h-3 mr-1" />
                  {entry.party_size}
                </Badge>
              </div>
            ))}
            {waitingEntries.length > 4 && (
              <p className="text-xs text-slate-400 text-center pt-1">+{waitingEntries.length - 4} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
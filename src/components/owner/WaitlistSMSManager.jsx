import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Clock, MessageSquare, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function WaitlistSMSManager({ restaurantId, restaurantName }) {
  const queryClient = useQueryClient();
  const [confirmationWindow, setConfirmationWindow] = useState(5); // minutes

  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['waitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
  });

  const notifyMutation = useMutation({
    mutationFn: async (entry) => {
      const token = Math.random().toString(36).substring(7);
      const confirmUrl = `${window.location.origin}/confirm-waitlist?token=${token}`;
      
      // Send SMS
      await base44.integrations.Core.SendSMS?.({
        to: entry.guest_phone,
        body: `Your table at ${restaurantName} is ready! Please confirm you're on your way within ${confirmationWindow} minutes: ${confirmUrl}`
      });

      // Update entry
      await base44.entities.WaitlistEntry.update(entry.id, {
        status: 'notified',
        notified_at: new Date().toISOString(),
        confirmation_token: token
      });

      // Set auto-skip timer
      setTimeout(async () => {
        const updated = await base44.entities.WaitlistEntry.filter({ id: entry.id });
        if (updated[0]?.status === 'notified') {
          await base44.entities.WaitlistEntry.update(entry.id, { status: 'skipped' });
          queryClient.invalidateQueries(['waitlist']);
          toast.error(`${entry.guest_name} didn't confirm - moved to next party`);
        }
      }, confirmationWindow * 60 * 1000);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist']);
      toast.success('SMS sent!');
    },
    onError: (error) => {
      toast.error('Failed to send SMS: ' + error.message);
    }
  });

  const manualSeatingMutation = useMutation({
    mutationFn: (entry) => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'seated',
      seated_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist']);
      toast.success('Marked as seated');
    }
  });

  const waitingEntries = waitlistEntries.filter(e => e.status === 'waiting');
  const notifiedEntries = waitlistEntries.filter(e => e.status === 'notified');
  const confirmedEntries = waitlistEntries.filter(e => e.status === 'confirmed');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Waitlist SMS Manager
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-500" />
            <Select value={confirmationWindow.toString()} onValueChange={(v) => setConfirmationWindow(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 minutes</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Waiting Queue */}
        <div>
          <h4 className="font-medium text-slate-700 mb-3">Waiting ({waitingEntries.length})</h4>
          <div className="space-y-2">
            {waitingEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-700">#{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{entry.guest_name}</p>
                    <p className="text-sm text-slate-500">
                      Party of {entry.party_size} • {entry.guest_phone}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => notifyMutation.mutate(entry)}
                  disabled={notifyMutation.isPending}
                  className="gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Notify
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Notified (awaiting confirmation) */}
        {notifiedEntries.length > 0 && (
          <div>
            <h4 className="font-medium text-amber-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Awaiting Confirmation ({notifiedEntries.length})
            </h4>
            <div className="space-y-2">
              {notifiedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{entry.guest_name}</p>
                    <p className="text-sm text-slate-600">
                      Notified {moment(entry.notified_at).fromNow()} • Party of {entry.party_size}
                    </p>
                  </div>
                  <Button
                    onClick={() => manualSeatingMutation.mutate(entry)}
                    variant="outline"
                    size="sm"
                  >
                    Manual Seat
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed (en route) */}
        {confirmedEntries.length > 0 && (
          <div>
            <h4 className="font-medium text-emerald-700 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Confirmed - En Route ({confirmedEntries.length})
            </h4>
            <div className="space-y-2">
              {confirmedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{entry.guest_name}</p>
                    <p className="text-sm text-slate-600">
                      Confirmed {moment(entry.confirmed_at).fromNow()} • Party of {entry.party_size}
                    </p>
                  </div>
                  <Button
                    onClick={() => manualSeatingMutation.mutate(entry)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Seat Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Log */}
        <div className="pt-4 border-t">
          <h4 className="font-medium text-slate-700 mb-3">Recent Activity</h4>
          <div className="space-y-2">
            {waitlistEntries
              .filter(e => ['seated', 'skipped', 'cancelled'].includes(e.status))
              .slice(0, 5)
              .map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-sm text-slate-600">
                  {entry.status === 'seated' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                  {entry.status === 'skipped' && <XCircle className="w-4 h-4 text-red-600" />}
                  {entry.status === 'cancelled' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  <span>
                    {entry.guest_name} • {entry.status} • {moment(entry.seated_at || entry.updated_date).fromNow()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
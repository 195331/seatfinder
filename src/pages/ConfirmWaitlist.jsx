import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ConfirmWaitlist() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const [confirmed, setConfirmed] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['waitlistConfirm', token],
    queryFn: async () => {
      const entries = await base44.entities.WaitlistEntry.filter({ confirmation_token: token });
      return entries[0];
    },
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: () => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    }),
    onSuccess: () => setConfirmed(true)
  });

  const cancelMutation = useMutation({
    mutationFn: () => base44.entities.WaitlistEntry.update(entry.id, {
      status: 'cancelled'
    }),
    onSuccess: () => setCancelled(true)
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!entry || entry.status !== 'notified') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h2>
            <p className="text-slate-600">
              This confirmation link is no longer valid. Please contact the restaurant directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-20 h-20 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">You're confirmed!</h2>
            <p className="text-lg text-slate-700 mb-4">
              Your table is waiting. See you soon!
            </p>
            <p className="text-sm text-slate-500">
              Party of {entry.party_size}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Cancelled</h2>
            <p className="text-slate-600">
              We've removed you from the waitlist. You can rejoin anytime from the app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Your Table is Ready!</h1>
            <p className="text-slate-600">
              {entry.guest_name}, party of {entry.party_size}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="w-full h-16 text-lg bg-emerald-600 hover:bg-emerald-700"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  I'm on my way!
                </>
              )}
            </Button>

            <Button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              variant="outline"
              className="w-full h-12"
            >
              {cancelMutation.isPending ? 'Cancelling...' : "Can't make it"}
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            Please confirm within 5 minutes or we'll move to the next party
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
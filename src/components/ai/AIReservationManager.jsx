import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, X, Clock, Users, Loader2, AlertTriangle, CalendarDays, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AIReservationManager({ restaurantId, restaurantName, reservations, tables }) {
  const queryClient = useQueryClient();
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load rules from DB
  const { data: dbRules = [] } = useQuery({
    queryKey: ['reservationRules', restaurantId],
    queryFn: () => base44.entities.ReservationRule.filter({ restaurant_id: restaurantId }, 'priority'),
    enabled: !!restaurantId,
  });

  // Derive effective rule summary from active auto-approve rules
  const rules = useMemo(() => {
    const active = dbRules.filter(r => r.is_active && r.action === 'auto_approve');
    if (active.length === 0) {
      return { maxPartySize: null, minAdvanceHours: null, maxAdvanceDays: null, requireTableAvailability: null, daysOfWeek: [], timeSlots: [] };
    }
    // Use the most permissive values across all active auto-approve rules
    const maxPartySize = Math.max(...active.map(r => r.conditions?.max_party_size || 999).filter(v => v !== 999));
    const minAdvanceHours = Math.min(...active.map(r => r.conditions?.min_advance_hours || 0));
    const maxAdvanceDays = Math.max(...active.map(r => r.conditions?.max_advance_days || 0));
    const requireTableAvailability = active.some(r => r.conditions?.require_table_availability !== false);
    const daysOfWeek = [...new Set(active.flatMap(r => r.conditions?.days_of_week || []))].sort((a, b) => a - b);
    const timeSlots = [...new Set(active.flatMap(r => r.conditions?.time_slots || []))];
    return {
      maxPartySize: isFinite(maxPartySize) ? maxPartySize : null,
      minAdvanceHours,
      maxAdvanceDays: maxAdvanceDays > 0 ? maxAdvanceDays : null,
      requireTableAvailability,
      daysOfWeek,
      timeSlots,
    };
  }, [dbRules]);

  const pendingReservations = reservations.filter(r => r.status === 'pending');

  const processReservationMutation = useMutation({
    mutationFn: async ({ reservation, decision, reason }) => {
      // Update reservation status
      await base44.entities.Reservation.update(reservation.id, {
        status: decision,
        owner_response_at: new Date().toISOString()
      });

      // Create notification
      const isApproved = decision === 'approved';
      await base44.entities.Notification.create({
        user_id: reservation.user_id,
        user_email: reservation.user_email,
        type: isApproved ? 'reservation_approved' : 'reservation_declined',
        title: isApproved ? 'Reservation Confirmed!' : 'Reservation Update',
        message: isApproved
          ? `Your reservation for ${reservation.party_size} guests on ${reservation.reservation_date} at ${reservation.reservation_time} has been confirmed.`
          : `Your reservation request could not be confirmed. ${reason || 'Please try a different time.'}`,
        restaurant_name: restaurantName,
        reservation_id: reservation.id
      });

      // Send email
      if (reservation.user_email && !reservation.user_email.includes('@pending')) {
        await base44.integrations.Core.SendEmail({
          to: reservation.user_email,
          subject: isApproved 
            ? `Reservation confirmed at ${restaurantName}`
            : `Reservation update from ${restaurantName}`,
          body: isApproved
            ? `Your reservation is confirmed!\n\nDetails:\n- Date: ${reservation.reservation_date}\n- Time: ${reservation.reservation_time}\n- Party: ${reservation.party_size} guests\n\nSee you soon!`
            : `We're sorry, but your reservation request could not be confirmed.\n\n${reason || 'Please try a different time or contact us directly.'}`
        });
      }

      // If approved, update table status
      if (isApproved && reservation.table_id) {
        await base44.entities.Table.update(reservation.table_id, {
          status: 'reserved'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
      queryClient.invalidateQueries(['tables']);
    }
  });

  const evaluateReservation = (reservation) => {
    const issues = [];
    let canAutoApprove = true;

    // No active auto-approve rules = manual review
    const activeAutoApprove = dbRules.filter(r => r.is_active && r.action === 'auto_approve');
    if (activeAutoApprove.length === 0) {
      issues.push('No active auto-approve rules configured');
      return { canAutoApprove: false, issues };
    }

    // Check party size
    if (rules.maxPartySize !== null && reservation.party_size > rules.maxPartySize) {
      issues.push(`Party size (${reservation.party_size}) exceeds max of ${rules.maxPartySize}`);
      canAutoApprove = false;
    }

    // Check advance booking time
    const reservationDate = new Date(`${reservation.reservation_date}T${reservation.reservation_time || '00:00'}`);
    const now = new Date();
    const hoursUntil = (reservationDate - now) / (1000 * 60 * 60);

    if (rules.minAdvanceHours !== null && hoursUntil < rules.minAdvanceHours) {
      issues.push(`Too short notice (min ${rules.minAdvanceHours}h required)`);
      canAutoApprove = false;
    }

    if (rules.maxAdvanceDays !== null && hoursUntil > rules.maxAdvanceDays * 24) {
      issues.push(`Booking too far in advance (max ${rules.maxAdvanceDays} days)`);
      canAutoApprove = false;
    }

    // Check day of week
    if (rules.daysOfWeek.length > 0) {
      const resvDay = new Date(reservation.reservation_date).getDay();
      if (!rules.daysOfWeek.includes(resvDay)) {
        issues.push(`Day not covered by any auto-approve rule`);
        canAutoApprove = false;
      }
    }

    // Check time slot
    if (rules.timeSlots.length > 0 && reservation.reservation_time) {
      const t = reservation.reservation_time;
      const inSlot = rules.timeSlots.some(slot => {
        const [start, end] = slot.split('-');
        return t >= start && t <= end;
      });
      if (!inSlot) {
        issues.push(`Time not within allowed slots`);
        canAutoApprove = false;
      }
    }

    // Check table availability
    if (rules.requireTableAvailability && reservation.table_id) {
      const table = tables.find(t => t.id === reservation.table_id);
      if (!table || table.status !== 'free') {
        issues.push('Requested table not available');
        canAutoApprove = false;
      }
      if (table && table.capacity < reservation.party_size) {
        issues.push('Table too small for party');
        canAutoApprove = false;
      }
    }

    return { canAutoApprove, issues };
  };

  const runAutoApproval = async () => {
    if (!autoApproveEnabled) return;
    
    setProcessing(true);
    let approved = 0;
    let flagged = 0;

    for (const reservation of pendingReservations) {
      const { canAutoApprove, issues } = evaluateReservation(reservation);
      
      if (canAutoApprove) {
        await processReservationMutation.mutateAsync({
          reservation,
          decision: 'approved',
          reason: null
        });
        approved++;
      } else {
        flagged++;
      }
    }

    setProcessing(false);
    
    if (approved > 0) {
      toast.success(`Auto-approved ${approved} reservation${approved > 1 ? 's' : ''}`);
    }
    if (flagged > 0) {
      toast.info(`${flagged} reservation${flagged > 1 ? 's' : ''} require manual review`);
    }
  };

  useEffect(() => {
    if (autoApproveEnabled && pendingReservations.length > 0) {
      runAutoApproval();
    }
  }, [autoApproveEnabled, pendingReservations.length]);

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          AI Reservation Manager
          <Badge className="bg-violet-100 text-violet-700 ml-2">Auto</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Approve Toggle */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-violet-100">
          <div>
            <Label className="font-medium">Auto-Approve Reservations</Label>
            <p className="text-sm text-slate-500">
              Automatically approve reservations matching your rules
            </p>
          </div>
          <Switch
            checked={autoApproveEnabled}
            onCheckedChange={setAutoApproveEnabled}
          />
        </div>

        {/* Rules Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Max Party Size</p>
            <p className="font-semibold">{rules.maxPartySize} guests</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Min Advance Notice</p>
            <p className="font-semibold">{rules.minAdvanceHours} hours</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Max Advance Booking</p>
            <p className="font-semibold">{rules.maxAdvanceDays} days</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Table Availability</p>
            <p className="font-semibold">{rules.requireTableAvailability ? 'Required' : 'Optional'}</p>
          </div>
        </div>

        {/* Pending Review */}
        {pendingReservations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Pending Review ({pendingReservations.length})
              </span>
              {processing && (
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              )}
            </div>
            
            {pendingReservations.slice(0, 3).map(reservation => {
              const { canAutoApprove, issues } = evaluateReservation(reservation);
              
              return (
                <div 
                  key={reservation.id}
                  className={`p-3 rounded-xl border ${
                    canAutoApprove 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span className="font-medium text-sm">{reservation.user_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {reservation.party_size} guests
                      </Badge>
                    </div>
                    {canAutoApprove ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Auto-approve ready
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Manual review
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <Clock className="w-3 h-3" />
                    {reservation.reservation_date} at {reservation.reservation_time}
                  </div>

                  {issues.length > 0 && (
                    <div className="text-xs text-amber-700">
                      {issues.join(' • ')}
                    </div>
                  )}

                  {!canAutoApprove && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => processReservationMutation.mutate({
                          reservation,
                          decision: 'approved'
                        })}
                        disabled={processReservationMutation.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8"
                        onClick={() => processReservationMutation.mutate({
                          reservation,
                          decision: 'declined',
                          reason: issues.join('. ')
                        })}
                        disabled={processReservationMutation.isPending}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pendingReservations.length === 0 && (
          <div className="text-center py-4 text-slate-500">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">All reservations processed!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
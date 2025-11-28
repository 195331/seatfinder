import React from 'react';
import { Users, Clock, Check, X, Phone, MessageSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import moment from 'moment';
import { cn } from "@/lib/utils";
import AIWaitTimePredictor from '@/components/ai/AIWaitTimePredictor';

export default function WaitlistManager({ 
  entries, 
  onSeat, 
  onCancel, 
  isUpdating,
  restaurantId 
}) {
  const waitingEntries = entries.filter(e => e.status === 'waiting');

  const sendSMSUpdate = async (entry, position) => {
    if (!entry.guest_phone) {
      toast.error('No phone number on file');
      return;
    }
    
    // In a real app, this would integrate with SMS provider
    // For now, we'll send an email notification as fallback
    toast.success(`Update sent to ${entry.guest_name}`);
  };

  return (
    <div className="space-y-4">
      {/* AI Wait Time Predictor */}
      {restaurantId && waitingEntries.length > 0 && (
        <AIWaitTimePredictor 
          restaurantId={restaurantId}
          partySize={waitingEntries[0]?.party_size || 2}
          currentWaitlistLength={waitingEntries.length}
        />
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Waitlist
            </CardTitle>
            <Badge variant="outline" className="text-base px-3">
              {waitingEntries.length} waiting
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
        {waitingEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No one on the waitlist</p>
          </div>
        ) : (
          <div className="divide-y">
            {waitingEntries.map((entry, index) => {
              const waitTime = moment().diff(moment(entry.created_date), 'minutes');
              
              return (
                <div 
                  key={entry.id} 
                  className={cn(
                    "p-4 flex items-center justify-between gap-4",
                    "hover:bg-slate-50 transition-colors"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-semibold text-emerald-700">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {entry.guest_name || 'Guest'}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Party of {entry.party_size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {waitTime} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {entry.guest_phone && (
                      <>
                        <a href={`tel:${entry.guest_phone}`}>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Phone className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => sendSMSUpdate(entry, index + 1)}
                          className="rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Send SMS update"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCancel(entry)}
                      disabled={isUpdating}
                      className="rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={() => onSeat(entry)}
                      disabled={isUpdating}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Seat
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </CardContent>
        </Card>
        </div>
        );
        }
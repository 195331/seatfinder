import React, { useState, useEffect } from 'react';
import { Users, Clock, Bell, X, CheckCircle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function WaitlistStatus({ entry, position, totalWaiting, onLeave }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!entry?.created_date) return;
    
    const updateElapsed = () => {
      const mins = moment().diff(moment(entry.created_date), 'minutes');
      setElapsed(mins);
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [entry?.created_date]);

  if (!entry) return null;

  const statusConfig = {
    waiting: { color: 'bg-amber-500', label: 'Waiting', icon: Clock },
    notified: { color: 'bg-blue-500', label: 'Your table is ready!', icon: Bell },
    seated: { color: 'bg-emerald-500', label: 'Seated', icon: CheckCircle },
    cancelled: { color: 'bg-slate-400', label: 'Cancelled', icon: X }
  };

  const status = statusConfig[entry.status] || statusConfig.waiting;
  const StatusIcon = status.icon;
  const progressPercent = position && totalWaiting ? ((totalWaiting - position + 1) / totalWaiting) * 100 : 0;

  return (
    <Card className={cn(
      "overflow-hidden border-2",
      entry.status === 'notified' && "border-blue-500 bg-blue-50"
    )}>
      <CardContent className="p-4">
        {entry.status === 'notified' ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
              <Bell className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">Your Table is Ready!</h3>
            <p className="text-blue-700 mt-1">Please check in with the host</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", status.color)} />
                <span className="font-medium">{status.label}</span>
              </div>
              <Badge variant="outline">
                <Users className="w-3 h-3 mr-1" />
                Party of {entry.party_size}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-3xl font-bold text-slate-900">#{position || '-'}</p>
                <p className="text-xs text-slate-500">Position in line</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-3xl font-bold text-slate-900">
                  {entry.estimated_wait_minutes || Math.max(5, (position || 1) * 8)}
                </p>
                <p className="text-xs text-slate-500">Est. minutes</p>
              </div>
            </div>

            {position && totalWaiting && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{totalWaiting - position + 1} parties seated</span>
                  <span>{position - 1} ahead of you</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Waiting for {elapsed} min</span>
              {entry.status === 'waiting' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onLeave?.(entry)}
                >
                  Leave Waitlist
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
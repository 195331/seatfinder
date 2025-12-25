import React from 'react';
import { Clock, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function FreshnessIndicator({ lastUpdate, size = 'sm', showBadge = true, showText = true }) {
  if (!lastUpdate) {
    return showBadge ? (
      <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-600 border-slate-200">
        <HelpCircle className="w-3 h-3" />
        Unknown
      </Badge>
    ) : null;
  }

  const minutesAgo = moment().diff(moment(lastUpdate), 'minutes');
  
  // Verified Live: 0-10 min
  // May be stale: 11-30 min  
  // Unknown: 31+ min
  
  const getFreshnessState = () => {
    if (minutesAgo <= 10) {
      return {
        label: 'Verified Live',
        icon: CheckCircle,
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
        timeText: moment(lastUpdate).fromNow()
      };
    } else if (minutesAgo <= 30) {
      return {
        label: 'May be stale',
        icon: AlertCircle,
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        dotColor: 'bg-amber-500',
        timeText: moment(lastUpdate).fromNow()
      };
    } else {
      return {
        label: 'Unknown',
        icon: HelpCircle,
        className: 'bg-slate-100 text-slate-600 border-slate-200',
        dotColor: 'bg-slate-400',
        timeText: moment(lastUpdate).fromNow()
      };
    }
  };

  const state = getFreshnessState();
  const Icon = state.icon;

  if (showBadge) {
    return (
      <Badge variant="outline" className={cn("gap-1", state.className, size === 'lg' && 'text-sm px-3 py-1')}>
        <Icon className={cn("w-3 h-3", size === 'lg' && 'w-4 h-4')} />
        {state.label}
      </Badge>
    );
  }

  if (showText) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", state.dotColor)} />
        <span>{state.timeText}</span>
      </div>
    );
  }

  return null;
}

export function getIsVerifiedLive(lastUpdate) {
  if (!lastUpdate) return false;
  const minutesAgo = moment().diff(moment(lastUpdate), 'minutes');
  return minutesAgo <= 10;
}

export function getIsStale(lastUpdate) {
  if (!lastUpdate) return true;
  const minutesAgo = moment().diff(moment(lastUpdate), 'minutes');
  return minutesAgo > 30;
}
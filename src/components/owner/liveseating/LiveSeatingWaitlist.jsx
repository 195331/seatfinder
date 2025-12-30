import React from 'react';
import { Users, Clock, Plus, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function LiveSeatingWaitlist({ 
  waitlist, 
  reservations, 
  onAddWaitlist, 
  onSelectEntry,
  selectedEntry 
}) {
  const arrivingSoon = (reservations || []).filter(r => {
    const resTime = moment(`${r.reservation_date} ${r.reservation_time}`);
    const diff = resTime.diff(moment(), 'minutes');
    return diff > 0 && diff <= 30;
  });

  return (
    <div className="space-y-4">
      {/* Waitlist */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Waitlist
              {waitlist.length > 0 && (
                <Badge className="bg-purple-600">{waitlist.length}</Badge>
              )}
            </CardTitle>
            <Button size="sm" onClick={onAddWaitlist} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 max-h-80 overflow-y-auto">
          {(waitlist || []).length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No one waiting
            </div>
          ) : (
            <div className="space-y-1">
              {(waitlist || []).map((entry, index) => {
                const waitTime = moment().diff(moment(entry.created_date), 'minutes');
                const isSelected = selectedEntry?.id === entry.id;
                
                return (
                  <div
                    key={entry.id}
                    onClick={() => onSelectEntry(isSelected ? null : entry)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all",
                      isSelected ? "bg-purple-100 border-2 border-purple-400" : "bg-slate-50 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-700">
                        {index + 1}
                      </div>
                      <span className="font-medium text-sm text-slate-900">
                        {entry.guest_name || 'Walk-in'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 ml-8">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {entry.party_size}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {waitTime}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Arriving Soon */}
      {(arrivingSoon || []).length > 0 && (
        <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Arriving Soon
              <Badge className="bg-blue-600">{arrivingSoon.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {(arrivingSoon || []).map(res => {
                const resTime = moment(`${res.reservation_date} ${res.reservation_time}`);
                const minsUntil = resTime.diff(moment(), 'minutes');
                
                return (
                  <div key={res.id} className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{res.user_name}</span>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {minsUntil}m
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>{resTime.format('h:mm A')}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {res.party_size}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
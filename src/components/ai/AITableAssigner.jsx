import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Users, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AITableAssigner({ restaurantId, waitlistEntries, tables, onAssignmentMade }) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = async () => {
    setLoading(true);
    
    const waitingEntries = waitlistEntries.filter(e => e.status === 'waiting');
    const availableTables = tables.filter(t => t.status === 'free');
    
    const newSuggestions = [];
    
    for (const entry of waitingEntries.slice(0, 5)) {
      // Find best matching table
      const suitableTables = availableTables
        .filter(t => t.capacity >= entry.party_size)
        .sort((a, b) => {
          // Prefer tables that are closest to party size (minimize waste)
          const wasteA = a.capacity - entry.party_size;
          const wasteB = b.capacity - entry.party_size;
          return wasteA - wasteB;
        });
      
      if (suitableTables.length > 0) {
        const bestTable = suitableTables[0];
        newSuggestions.push({
          entry,
          table: bestTable,
          reason: bestTable.capacity === entry.party_size 
            ? 'Perfect fit' 
            : `Best available (${bestTable.capacity - entry.party_size} extra seats)`
        });
        // Remove from available pool
        availableTables.splice(availableTables.indexOf(bestTable), 1);
      }
    }
    
    setSuggestions(newSuggestions);
    setLoading(false);
  };

  const createPendingAssignment = useMutation({
    mutationFn: async ({ entry, table }) => {
      // Create a pending reservation for owner approval
      await base44.entities.Reservation.create({
        restaurant_id: restaurantId,
        table_id: table.id,
        user_id: entry.user_id,
        user_name: entry.guest_name,
        user_email: entry.guest_phone ? `waitlist-${entry.id}@pending` : null,
        party_size: entry.party_size,
        reservation_date: new Date().toISOString().split('T')[0],
        reservation_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        notes: `AI-suggested from waitlist. Table ${table.label} for ${entry.party_size} guests.`
      });

      // Update waitlist entry status
      await base44.entities.WaitlistEntry.update(entry.id, {
        status: 'notified',
        estimated_wait_minutes: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist']);
      queryClient.invalidateQueries(['reservations']);
      toast.success('Assignment sent to owner for approval');
      if (onAssignmentMade) onAssignmentMade();
    }
  });

  const dismissSuggestion = (index) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Table Assignments
          <Badge className="bg-indigo-100 text-indigo-700 ml-2">Beta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-600 mb-4">
              Let AI match waitlisted parties with available tables
            </p>
            <Button 
              onClick={generateSuggestions}
              disabled={loading}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{suggestion.entry.guest_name}</p>
                      <p className="text-xs text-slate-500">Party of {suggestion.entry.party_size}</p>
                    </div>
                  </div>
                  
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  
                  <div className="px-3 py-1 bg-emerald-50 rounded-lg">
                    <p className="font-medium text-sm text-emerald-700">Table {suggestion.table.label}</p>
                    <p className="text-xs text-emerald-600">{suggestion.reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissSuggestion(index)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createPendingAssignment.mutate(suggestion)}
                    disabled={createPendingAssignment.isPending}
                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="w-3 h-3" />
                    Send
                  </Button>
                </div>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={generateSuggestions}
              className="w-full mt-2"
            >
              Refresh Suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
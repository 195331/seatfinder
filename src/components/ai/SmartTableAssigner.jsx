import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SmartTableAssigner({ reservation, restaurant, onTableAssigned, preferences = [] }) {
  const suggestTableMutation = useMutation({
    mutationFn: async () => {
      const tables = await base44.entities.Table.filter({ restaurant_id: restaurant.id, status: 'free' });
      const reservations = await base44.entities.Reservation.filter({
        restaurant_id: restaurant.id,
        reservation_date: reservation.reservation_date,
        status: 'approved'
      });

      const prompt = `
You are a restaurant seating optimizer. Suggest the best table for this reservation:

Reservation:
- Party size: ${reservation.party_size}
- Time: ${reservation.reservation_time}
- Duration: ~90 minutes
- Special requests: ${reservation.special_requests || 'none'}
- Seating preferences: ${preferences.length > 0 ? preferences.join(', ') : 'none'}

Available Tables:
${tables.map(t => `- ${t.label}: ${t.capacity} seats, position (${t.position_x}, ${t.position_y}), shape: ${t.shape}`).join('\n')}

Other Reservations Today:
${reservations.map(r => `- ${r.reservation_time}: ${r.party_size} people`).join('\n')}

Optimize for:
1. Table capacity matching (avoid wasting large tables on small parties)
2. Seating preferences (quiet/corner = edges, window/view = near walls, bar area, outdoor/patio if specified, private/romantic = small table at edges)
3. Minimize gaps between bookings
4. Strategic placement (window seats for dates, central for groups, round tables for parties of 2)

Return JSON:
{
  "suggested_table_id": "best table ID",
  "table_label": "table name",
  "reasoning": "why this table is optimal",
  "alternative_table_id": "backup option or null"
}
      `;

      return await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggested_table_id: { type: "string" },
            table_label: { type: "string" },
            reasoning: { type: "string" },
            alternative_table_id: { type: "string" }
          }
        }
      });
    },
    onSuccess: async (suggestion) => {
      await base44.entities.Reservation.update(reservation.id, {
        table_id: suggestion.suggested_table_id
      });
      
      toast.success(`Assigned to ${suggestion.table_label}: ${suggestion.reasoning}`);
      onTableAssigned?.(suggestion);
    }
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => suggestTableMutation.mutate()}
      disabled={suggestTableMutation.isPending || reservation.table_id}
      className="gap-2"
    >
      {suggestTableMutation.isPending ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
      ) : (
        <><Sparkles className="w-4 h-4" /> AI Assign Table</>
      )}
    </Button>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, DollarSign, Calendar, Star } from 'lucide-react';
import { toast } from "sonner";

export default function AICustomerPersona({ customerId, restaurantId }) {
  const [persona, setPersona] = useState(null);
  const [newNote, setNewNote] = useState('');

  const { data: reservations = [] } = useQuery({
    queryKey: ['customerReservations', customerId, restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ 
      user_id: customerId,
      restaurant_id: restaurantId 
    }),
    enabled: !!customerId && !!restaurantId,
  });

  const { data: preOrders = [] } = useQuery({
    queryKey: ['customerPreOrders', customerId, restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ 
      user_id: customerId,
      restaurant_id: restaurantId 
    }),
    enabled: !!customerId && !!restaurantId,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['customerNotes', customerId, restaurantId],
    queryFn: () => base44.entities.CustomerNote.filter({ 
      customer_id: customerId,
      restaurant_id: restaurantId 
    }, '-created_date'),
    enabled: !!customerId && !!restaurantId,
  });

  const generatePersonaMutation = useMutation({
    mutationFn: async () => {
      const totalSpent = preOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const frequentItems = {};
      preOrders.forEach(order => {
        (order.items || []).forEach(item => {
          frequentItems[item.name] = (frequentItems[item.name] || 0) + 1;
        });
      });

      const prompt = `Analyze this customer's behavior and create a detailed persona:

Visit History: ${reservations.length} reservations
Total Spent: $${totalSpent.toFixed(2)}
Frequent Orders: ${Object.entries(frequentItems).map(([name, count]) => `${name} (${count}x)`).join(', ') || 'None'}
Dietary Preferences: ${[...new Set(reservations.flatMap(r => r.dietary_needs || []))].join(', ') || 'None'}
Occasions: ${reservations.map(r => r.occasion).filter(o => o !== 'none').join(', ') || 'Regular dining'}

Create a concise customer persona (3-4 sentences) covering:
- Dining preferences and patterns
- Estimated customer lifetime value
- Recommended service approach
- Personalization opportunities

Return just the persona text.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      return result;
    },
    onSuccess: (data) => {
      setPersona(data);
      toast.success('Persona generated!');
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.CustomerNote.create({
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_email: reservations[0]?.user_email,
        note: newNote,
        note_type: 'general',
        staff_id: user.id,
        staff_name: user.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customerNotes']);
      setNewNote('');
      toast.success('Note saved');
    }
  });

  const totalSpent = preOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const avgOrderValue = preOrders.length > 0 ? totalSpent / preOrders.length : 0;

  return (
    <div className="space-y-6">
      {/* Customer Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-slate-500">Visits</p>
            </div>
            <p className="text-2xl font-bold">{reservations.length}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-slate-500">Lifetime Value</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">${totalSpent.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-slate-500">Avg Order</p>
            </div>
            <p className="text-2xl font-bold">${avgOrderValue.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Persona */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Customer Persona
            </CardTitle>
            <Button
              onClick={() => generatePersonaMutation.mutate()}
              disabled={generatePersonaMutation.isPending || reservations.length === 0}
              variant="outline"
              className="gap-2"
            >
              {generatePersonaMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Persona
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {persona ? (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <p className="text-slate-700 leading-relaxed">{persona}</p>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-6">
              Generate AI persona to understand this customer better
            </p>
          )}
        </CardContent>
      </Card>

      {/* Staff Notes */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Staff Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add Note</Label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Customer preferences, allergies, VIP status, etc."
                rows={2}
              />
              <Button
                onClick={() => addNoteMutation.mutate()}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                className="w-full"
              >
                {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
              </Button>
            </div>

            {notes.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                {notes.map(note => (
                  <div key={note.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-700">{note.note}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      By {note.staff_name} • {new Date(note.created_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Calendar, Clock, Users, MapPin, Loader2, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addDays, parse } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReservationConcierge({ 
  restaurant, 
  tables = [], 
  currentUser,
  onReservationComplete 
}) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [preOrderItems, setPreOrderItems] = useState([]);
  const [showPreOrderEdit, setShowPreOrderEdit] = useState(false);

  const [request, setRequest] = useState({
    partySize: 2,
    preferredDate: format(new Date(), 'yyyy-MM-dd'),
    preferredTime: '19:00',
    specialRequests: '',
    seatingPreference: '',
    seatingPreferenceOther: '',
    dietaryNeeds: [],
    occasion: 'none'
  });

  // Fetch menu items for pre-order
  const [menuItems, setMenuItems] = useState([]);
  useEffect(() => {
    if (restaurant?.enable_preorder) {
      base44.entities.MenuItem.filter({ restaurant_id: restaurant.id })
        .then(items => setMenuItems(items))
        .catch(() => {});
    }
  }, [restaurant?.id, restaurant?.enable_preorder]);

  const getAISuggestions = async () => {
    setIsLoading(true);
    try {
      // Split tables: free vs unavailable (occupied/reserved)
      const freeTables = tables.filter(t => t.status === 'free');
      const unavailableTables = tables.filter(t => t.status !== 'free');

      const effectiveSeatingPref = request.seatingPreference === 'other'
        ? request.seatingPreferenceOther
        : request.seatingPreference;

      // Build context
      const userPrefs = currentUser?.preferences || {};
      
      const prompt = `You are a restaurant reservation AI concierge. Help find the best reservation time and specific table.

Restaurant: ${restaurant.name}
Restaurant features: ${restaurant.has_outdoor ? 'outdoor seating, ' : ''}${restaurant.has_bar_seating ? 'bar seating, ' : ''}${restaurant.is_kid_friendly ? 'kid-friendly' : ''}

AVAILABLE (free) tables right now:
${freeTables.length > 0 ? freeTables.map(t => `- Table "${t.label}" (ID: ${t.id}): ${t.capacity} seats, shape: ${t.shape || 'standard'}${t.zone_type ? ', zone: ' + t.zone_type : ''}${t.layer ? ', area: ' + t.layer : ''}`).join('\n') : 'None currently free'}

UNAVAILABLE tables (occupied or reserved — do NOT suggest these):
${unavailableTables.length > 0 ? unavailableTables.map(t => `- Table "${t.label}" (ID: ${t.id}): ${t.capacity} seats [${t.status}]`).join('\n') : 'None'}

User request:
- Party size: ${request.partySize}
- Preferred date: ${request.preferredDate}
- Preferred time: ${request.preferredTime}
- Seating preference: ${effectiveSeatingPref || 'None'}
- Special requests: ${request.specialRequests || 'None'}
- Dietary needs: ${request.dietaryNeeds.length > 0 ? request.dietaryNeeds.join(', ') : 'None'}
- Occasion: ${request.occasion !== 'none' ? request.occasion : 'None'}

User preferences:
- Favorite cuisines: ${userPrefs.favorite_cuisines?.join(', ') || 'Not specified'}
- Dietary restrictions: ${userPrefs.dietary_restrictions?.join(', ') || 'None'}

Instructions:
1. Pick the SPECIFIC best free table by its exact label (e.g., "T3", "Bar 2") and ID. Never suggest an unavailable table.
2. Match table capacity as closely as possible to party size (don't seat 2 at a 10-person table).
3. Honor the seating preference: match zone_type or label hints (e.g., "quiet" → quiet zone, "bar" → bar label/zone, "outdoor" → outdoor area/layer).
4. If no free table fits perfectly, suggest the closest alternative and explain why.
5. Suggest 2 alternative time slots on the same date if tables could free up.
6. If it's a special occasion, prioritize ambiance-appropriate tables.

Return JSON:
{
  "primary_suggestion": {
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "table_id": "exact table ID from the list above",
    "table_label": "exact table label",
    "table_capacity": number,
    "seating_area": "brief area description",
    "reasoning": "specific reason this table and time are the best match"
  },
  "alternatives": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "table_id": "exact table ID or null",
      "table_label": "table label or null",
      "table_capacity": number,
      "reasoning": "brief reason"
    }
  ],
  "special_notes": "any tips or considerations",
  "pre_order_suggestion": "suggestion about pre-ordering if applicable"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            primary_suggestion: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                time: { type: 'string' },
                table_id: { type: 'string' },
                table_label: { type: 'string' },
                table_capacity: { type: 'number' },
                seating_area: { type: 'string' },
                reasoning: { type: 'string' }
              }
            },
            alternatives: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  time: { type: 'string' },
                  table_id: { type: 'string' },
                  table_label: { type: 'string' },
                  table_capacity: { type: 'number' },
                  reasoning: { type: 'string' }
                }
              }
            },
            special_notes: { type: 'string' },
            pre_order_suggestion: { type: 'string' }
          }
        }
      });

      setSuggestions(response);
    } catch (error) {
      toast.error('Failed to get AI suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmReservationMutation = useMutation({
    mutationFn: async (suggestionData) => {
      if (!currentUser) throw new Error('Not authenticated');

      // Find suitable table
      const suitableTable = tables.find(t => 
        t.status === 'free' && 
        t.capacity >= request.partySize &&
        t.capacity <= suggestionData.table_capacity + 2
      );

      if (!suitableTable) throw new Error('No suitable table available');

      // Create reservation
      const reservationData = {
        restaurant_id: restaurant.id,
        table_id: suitableTable.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email,
        party_size: request.partySize,
        reservation_date: suggestionData.date,
        reservation_time: suggestionData.time,
        status: restaurant.instant_confirm_enabled ? 'approved' : 'pending',
        special_requests: request.specialRequests,
        dietary_needs: request.dietaryNeeds,
        occasion: request.occasion,
        notes: `${request.seatingPreference ? request.seatingPreference + ' seating. ' : ''}AI suggested: ${suggestionData.reasoning}`
      };

      const reservation = await base44.entities.Reservation.create(reservationData);

      // Create pre-order if items selected
      if (preOrderItems.length > 0) {
        await base44.entities.PreOrder.create({
          reservation_id: reservation.id,
          restaurant_id: restaurant.id,
          user_id: currentUser.id,
          items: preOrderItems,
          special_instructions: request.specialRequests || '',
          total_amount: preOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: 'pending'
        });
      }

      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
      queryClient.invalidateQueries(['tables']);
      toast.success(restaurant?.instant_confirm_enabled ? 'Reservation confirmed!' : 'Reservation request sent!');
      setIsOpen(false);
      setSuggestions(null);
      setSelectedSuggestion(null);
      setPreOrderItems([]);
      onReservationComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create reservation');
    }
  });

  const handleAddToPreOrder = (menuItem) => {
    const existing = preOrderItems.find(i => i.menu_item_id === menuItem.id);
    if (existing) {
      setPreOrderItems(prev => prev.map(i => 
        i.menu_item_id === menuItem.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setPreOrderItems(prev => [...prev, {
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1
      }]);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        AI Reservation Assistant
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Reservation Concierge
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!suggestions ? (
              <>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-purple-900">
                      Tell me your preferences and I'll find the perfect time and table for you, handle special requests, and suggest alternatives if needed.
                    </p>
                  </CardContent>
                </Card>

                {/* Request Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Party Size</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={request.partySize}
                      onChange={(e) => setRequest(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Preferred Date</label>
                      <input
                        type="date"
                        value={request.preferredDate}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => setRequest(prev => ({ ...prev, preferredDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Preferred Time</label>
                      <select
                        value={request.preferredTime}
                        onChange={(e) => setRequest(prev => ({ ...prev, preferredTime: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="11:00">11:00 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="13:00">1:00 PM</option>
                        <option value="17:00">5:00 PM</option>
                        <option value="18:00">6:00 PM</option>
                        <option value="19:00">7:00 PM</option>
                        <option value="20:00">8:00 PM</option>
                        <option value="21:00">9:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Seating Preference</label>
                    <select
                      value={request.seatingPreference}
                      onChange={(e) => setRequest(prev => ({ ...prev, seatingPreference: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">No preference</option>
                      <option value="window">Window seat</option>
                      <option value="quiet">Quiet corner</option>
                      <option value="outdoor">Outdoor</option>
                      <option value="bar">Bar seating</option>
                      <option value="booth">Booth</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Occasion</label>
                    <select
                      value={request.occasion}
                      onChange={(e) => setRequest(prev => ({ ...prev, occasion: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="none">Regular dining</option>
                      <option value="birthday">Birthday</option>
                      <option value="anniversary">Anniversary</option>
                      <option value="date">Date night</option>
                      <option value="business">Business meeting</option>
                      <option value="celebration">Celebration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Special Requests</label>
                    <textarea
                      value={request.specialRequests}
                      onChange={(e) => setRequest(prev => ({ ...prev, specialRequests: e.target.value }))}
                      placeholder="Any special requirements? (e.g., high chair, wheelchair access, allergies)"
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <Button
                    onClick={getAISuggestions}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Finding perfect options...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* AI Suggestions */}
                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-purple-900 mb-2">✨ Best Match</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <span>{format(new Date(suggestions.primary_suggestion.date), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span>{suggestions.primary_suggestion.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span>Table for up to {suggestions.primary_suggestion.table_capacity} guests</span>
                      </div>
                      {suggestions.primary_suggestion.seating_area && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-purple-600" />
                          <span>{suggestions.primary_suggestion.seating_area}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-purple-800 mt-3 italic">
                      {suggestions.primary_suggestion.reasoning}
                    </p>
                    <Button
                      onClick={() => confirmReservationMutation.mutate(suggestions.primary_suggestion)}
                      disabled={confirmReservationMutation.isPending}
                      className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                    >
                      {confirmReservationMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        'Confirm This Reservation'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Alternative Suggestions */}
                {suggestions.alternatives?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Alternative Options</h3>
                    <div className="space-y-2">
                      {suggestions.alternatives.map((alt, idx) => (
                        <Card key={idx} className="hover:border-purple-300 cursor-pointer transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3 text-sm">
                                  <span>{format(new Date(alt.date), 'MMM d')}</span>
                                  <span>•</span>
                                  <span>{alt.time}</span>
                                  <span>•</span>
                                  <span>{alt.table_capacity} seats</span>
                                </div>
                                <p className="text-xs text-slate-600">{alt.reasoning}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmReservationMutation.mutate(alt)}
                                disabled={confirmReservationMutation.isPending}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Notes */}
                {suggestions.special_notes && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <p className="text-sm text-blue-900">💡 {suggestions.special_notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Pre-Order Option */}
                {restaurant?.enable_preorder && suggestions.pre_order_suggestion && (
                  <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="p-4">
                      <p className="text-sm text-orange-900 mb-3">{suggestions.pre_order_suggestion}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreOrderEdit(true)}
                        className="border-orange-300"
                      >
                        {preOrderItems.length > 0 ? `Edit Pre-Order (${preOrderItems.length} items)` : 'Add Pre-Order'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Button
                  variant="outline"
                  onClick={() => setSuggestions(null)}
                  className="w-full"
                >
                  Try Different Preferences
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Order Edit Dialog */}
      <Dialog open={showPreOrderEdit} onOpenChange={setShowPreOrderEdit}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Pre-Order Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {menuItems.map(item => (
              <Card key={item.id} className="hover:border-purple-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      <p className="text-sm font-semibold text-purple-600 mt-2">${item.price?.toFixed(2)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddToPreOrder(item)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              onClick={() => setShowPreOrderEdit(false)}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
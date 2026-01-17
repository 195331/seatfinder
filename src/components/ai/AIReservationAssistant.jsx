import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AIReservationAssistant({ restaurant, currentUser, onReservationCreated }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm your AI reservation assistant for ${restaurant.name}. You can tell me things like "Book a table for 4 at 7 PM tomorrow" or "Table for 2 next Friday at 6:30 PM".` }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const processRequestMutation = useMutation({
    mutationFn: async (userMessage) => {
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setInput('');

      const tables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const existingReservations = await base44.entities.Reservation.filter({ restaurant_id: restaurant.id });

      const prompt = `
You are a reservation assistant. Parse this natural language reservation request and respond with JSON:

Request: "${userMessage}"
Restaurant: ${restaurant.name}
Available Tables: ${tables.map(t => `${t.label} (${t.capacity} seats)`).join(', ')}

Return JSON:
{
  "understood": true/false,
  "party_size": number,
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "guest_name": "string or null",
  "suggested_table_id": "best table ID or null",
  "message": "friendly confirmation or ask for clarification",
  "action": "create_reservation" or "need_more_info" or "waitlist"
}

Consider current date: ${new Date().toISOString().split('T')[0]}
For relative dates like "tomorrow", "next Friday", calculate the actual date.
Suggest the best table based on party size and availability.
      `;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            understood: { type: "boolean" },
            party_size: { type: "number" },
            date: { type: "string" },
            time: { type: "string" },
            guest_name: { type: "string" },
            suggested_table_id: { type: "string" },
            message: { type: "string" },
            action: { type: "string" }
          }
        }
      });

      return aiResponse;
    },
    onSuccess: async (aiResponse) => {
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse.message }]);

      if (aiResponse.action === 'create_reservation' && aiResponse.suggested_table_id) {
        try {
          const reservation = await base44.entities.Reservation.create({
            restaurant_id: restaurant.id,
            table_id: aiResponse.suggested_table_id,
            user_id: currentUser.id,
            user_name: aiResponse.guest_name || currentUser.full_name,
            user_email: currentUser.email,
            party_size: aiResponse.party_size,
            reservation_date: aiResponse.date,
            reservation_time: aiResponse.time,
            status: restaurant.instant_confirm_enabled ? 'approved' : 'pending'
          });

          setMessages(prev => [...prev, {
            role: 'system',
            content: `✅ Reservation ${restaurant.instant_confirm_enabled ? 'confirmed' : 'requested'}!`,
            reservation
          }]);

          toast.success('Reservation created!');
          onReservationCreated?.(reservation);
        } catch (err) {
          setMessages(prev => [...prev, { role: 'system', content: '❌ Failed to create reservation. Please try again.' }]);
        }
      } else if (aiResponse.action === 'waitlist') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'The restaurant is fully booked. Would you like me to add you to the waitlist?' }]);
      }
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'system', content: '❌ Sorry, I had trouble processing that. Please try again.' }]);
    }
  });

  const handleSend = () => {
    if (!input.trim() || processRequestMutation.isPending) return;
    processRequestMutation.mutate(input);
  };

  return (
    <Card className="border-0 shadow-lg">
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">AI Reservation Assistant</h3>
            <p className="text-xs text-slate-600">Natural language booking</p>
          </div>
        </div>
      </div>

      <div className="h-96 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-2",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2",
                msg.role === 'user' 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : msg.role === 'system'
                  ? "bg-slate-100 text-slate-800"
                  : "bg-white border border-slate-200"
              )}
            >
              <p className="text-sm">{msg.content}</p>
              {msg.reservation && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs">
                  <p>📅 {msg.reservation.reservation_date} at {msg.reservation.reservation_time}</p>
                  <p>👥 Party of {msg.reservation.party_size}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {processRequestMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="E.g., 'Table for 4 tomorrow at 7 PM'"
            disabled={processRequestMutation.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || processRequestMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import moment from 'moment';

export default function RestaurantChat({ restaurant, currentUser, triggerButton }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Generate or fetch thread ID
  useEffect(() => {
    if (open && currentUser && restaurant) {
      const id = `${currentUser.id}_${restaurant.id}`;
      setThreadId(id);
    }
  }, [open, currentUser, restaurant]);

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => base44.entities.Message.filter({ thread_id: threadId }, 'created_date'),
    enabled: !!threadId && open,
  });

  // Real-time subscription
  useEffect(() => {
    if (!threadId || !open) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.thread_id === threadId) {
        queryClient.invalidateQueries(['messages', threadId]);
      }
    });
    return unsub;
  }, [threadId, open, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text) => {
      await base44.entities.Message.create({
        restaurant_id: restaurant.id,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name,
        sender_email: currentUser.email,
        message: text,
        is_from_restaurant: false,
        thread_id: threadId,
        is_read: false
      });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries(['messages', threadId]);
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  if (!currentUser) {
    return (
      <Button onClick={() => base44.auth.redirectToLogin(window.location.href)}>
        <MessageCircle className="w-4 h-4 mr-2" />
        Message Restaurant
      </Button>
    );
  }

  return (
    <>
      {triggerButton ? (
        React.cloneElement(triggerButton, { onClick: () => setOpen(true) })
      ) : (
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          className="gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Message Restaurant
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  {restaurant.name}
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Ask about menu, reservations, or special requests
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Start a conversation with {restaurant.name}</p>
                <p className="text-sm mt-2">Typical response time: 1-2 hours</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isFromUser = msg.sender_id === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isFromUser ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`p-3 rounded-2xl ${
                          isFromUser
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-900'
                        }`}
                      >
                        {!isFromUser && (
                          <p className="text-xs font-semibold mb-1 opacity-70">
                            {restaurant.name}
                          </p>
                        )}
                        <p className="text-sm">{msg.message}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 px-2">
                        {moment(msg.created_date).fromNow()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
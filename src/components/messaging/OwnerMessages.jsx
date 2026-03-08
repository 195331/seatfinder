import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function OwnerMessages({ restaurantId, currentUser }) {
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = React.useRef(null);
  const queryClient = useQueryClient();

  // Fetch all messages for this restaurant
  const { data: messages = [] } = useQuery({
    queryKey: ['ownerMessages', restaurantId],
    queryFn: () => base44.entities.Message.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
  });

  // Real-time subscription
  React.useEffect(() => {
    if (!restaurantId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.restaurant_id === restaurantId) {
        queryClient.invalidateQueries(['ownerMessages', restaurantId]);
      }
    });
    return unsub;
  }, [restaurantId, queryClient]);

  // Auto-scroll when thread dialog is open
  useEffect(() => {
    if (selectedThread) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [selectedThread?.messages?.length]);

  // Group by thread
  const threads = useMemo(() => {
    const grouped = {};
    messages.forEach(msg => {
      if (!grouped[msg.thread_id]) {
        grouped[msg.thread_id] = {
          thread_id: msg.thread_id,
          customer_name: msg.sender_name,
          customer_email: msg.sender_email,
          messages: [],
          unread_count: 0,
          last_message_at: msg.created_date
        };
      }
      grouped[msg.thread_id].messages.push(msg);
      if (!msg.is_read && !msg.is_from_restaurant) {
        grouped[msg.thread_id].unread_count += 1;
      }
    });
    return Object.values(grouped).sort((a, b) =>
      new Date(b.last_message_at) - new Date(a.last_message_at)
    );
  }, [messages]);

  const sendReplyMutation = useMutation({
    mutationFn: async ({ threadId, message }) => {
      await base44.entities.Message.create({
        restaurant_id: restaurantId,
        sender_id: currentUser?.id || 'restaurant',
        sender_name: currentUser?.full_name || 'Restaurant',
        sender_email: currentUser?.email || '',
        message,
        is_from_restaurant: true,
        thread_id: threadId,
        is_read: false
      });
    },
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries(['ownerMessages']);
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (threadId) => {
      const threadMessages = messages.filter(m => 
        m.thread_id === threadId && !m.is_read && !m.is_from_restaurant
      );
      await Promise.all(
        threadMessages.map(msg => 
          base44.entities.Message.update(msg.id, { is_read: true })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ownerMessages']);
    }
  });

  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    if (thread.unread_count > 0) {
      markAsReadMutation.mutate(thread.thread_id);
    }
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            Customer Messages
          </CardTitle>
          {totalUnread > 0 && (
            <Badge className="bg-blue-600 text-white">
              {totalUnread} unread
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() => handleThreadClick(thread)}
                className="w-full p-4 text-left rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-900">{thread.customer_name}</p>
                    <p className="text-xs text-slate-500">{thread.customer_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {moment(thread.last_message_at).fromNow()}
                    </p>
                    {thread.unread_count > 0 && (
                      <Badge className="mt-1 bg-blue-600 text-white">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">
                  {thread.messages[thread.messages.length - 1]?.message}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Thread Dialog */}
        {selectedThread && (
          <Dialog open={!!selectedThread} onOpenChange={() => setSelectedThread(null)}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
              <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle>
                  Conversation with {selectedThread.customer_name}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                {selectedThread.messages.map((msg, idx) => {
                  const isFromRestaurant = msg.is_from_restaurant;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isFromRestaurant ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%]`}>
                        <div
                          className={`p-3 rounded-2xl ${
                            isFromRestaurant
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-900'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 px-2">
                          {moment(msg.created_date).fromNow()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && replyText.trim()) {
                        sendReplyMutation.mutate({
                          threadId: selectedThread.thread_id,
                          message: replyText
                        });
                      }
                    }}
                    placeholder="Type your reply..."
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (replyText.trim()) {
                        sendReplyMutation.mutate({
                          threadId: selectedThread.thread_id,
                          message: replyText
                        });
                      }
                    }}
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sendReplyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
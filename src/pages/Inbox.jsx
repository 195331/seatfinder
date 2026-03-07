import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Bell, Check, CheckCheck, Trash2, Calendar,
  Store, MessageCircle, Send, Loader2, ChevronLeft
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import moment from 'moment';
import { cn } from "@/lib/utils";

// ─── Notifications Tab ───────────────────────────────────────────────────────
function NotificationsTab({ currentUser }) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const getIcon = (type) => {
    switch (type) {
      case 'reservation_approved': return <Check className="w-5 h-5 text-emerald-600" />;
      case 'reservation_declined': return <Calendar className="w-5 h-5 text-red-500" />;
      case 'reservation_request': return <Calendar className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'reservation_approved': return 'bg-emerald-50 border-emerald-200';
      case 'reservation_declined': return 'bg-red-50 border-red-200';
      case 'reservation_request': return 'bg-amber-50 border-amber-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'reservation_approved': return 'bg-emerald-100';
      case 'reservation_declined': return 'bg-red-100';
      case 'reservation_request': return 'bg-amber-100';
      default: return 'bg-blue-100';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );

  return (
    <div>
      {unreadCount > 0 && (
        <div className="flex justify-end mb-3">
          <Button variant="ghost" size="sm" onClick={() => markAllReadMutation.mutate()} className="gap-1.5">
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        </div>
      )}
      {notifications.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No notifications</h2>
            <p className="text-slate-500">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "border transition-all cursor-pointer hover:shadow-md",
                !n.is_read ? getColor(n.type) : "bg-white border-slate-200"
              )}
              onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", getIconBg(n.type))}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={cn("font-medium", !n.is_read && "font-semibold")}>{n.title}</h3>
                      {!n.is_read && <Badge className="bg-blue-500 shrink-0">New</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                    {n.restaurant_name && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                        <Store className="w-3 h-3" />{n.restaurant_name}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-2">{moment(n.created_date).fromNow()}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}>
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Message Thread View ──────────────────────────────────────────────────────
function MessageThread({ thread, currentUser, onBack }) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', thread.thread_id],
    queryFn: () => base44.entities.Message.filter({ thread_id: thread.thread_id }, 'created_date'),
    enabled: !!thread.thread_id,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.thread_id === thread.thread_id) {
        queryClient.invalidateQueries(['messages', thread.thread_id]);
        queryClient.invalidateQueries(['customerThreads', currentUser?.id]);
      }
    });
    return unsub;
  }, [thread.thread_id, currentUser?.id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.entities.Message.create({
      restaurant_id: thread.restaurant_id,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name,
      sender_email: currentUser.email,
      message: msg,
      is_from_restaurant: false,
      thread_id: thread.thread_id,
      is_read: false
    }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries(['messages', thread.thread_id]);
      queryClient.invalidateQueries(['customerThreads', currentUser?.id]);
    }
  });

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Thread header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">{thread.restaurant_name}</p>
          <p className="text-xs text-slate-500">Restaurant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Start your conversation with {thread.restaurant_name}</p>
          </div>
        ) : messages.map((msg) => {
          const isOwn = !msg.is_from_restaurant;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div className={cn("px-4 py-2.5 rounded-2xl text-sm", isOwn
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-900"
                )}>
                  {!isOwn && <p className="text-xs font-semibold mb-1 opacity-60">{thread.restaurant_name}</p>}
                  {msg.message}
                </div>
                <p className="text-xs text-slate-400 mt-1 px-2 text-right">{moment(msg.created_date).fromNow()}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && text.trim() && sendMutation.mutate(text)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            onClick={() => text.trim() && sendMutation.mutate(text)}
            disabled={!text.trim() || sendMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
function MessagesTab({ currentUser }) {
  const [selectedThread, setSelectedThread] = useState(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['customerThreads', currentUser?.id],
    queryFn: () => base44.entities.Message.filter({ sender_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  // Also fetch messages sent TO this user (restaurant replies)
  const { data: replies = [] } = useQuery({
    queryKey: ['customerReplies', currentUser?.id],
    queryFn: async () => {
      // Get all messages in threads the user participates in
      const userThreadIds = [...new Set(messages.map(m => m.thread_id))];
      if (userThreadIds.length === 0) return [];
      const allThreadMessages = await Promise.all(
        userThreadIds.map(tid => base44.entities.Message.filter({ thread_id: tid }, 'created_date'))
      );
      return allThreadMessages.flat();
    },
    enabled: messages.length > 0,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe(() => {
      queryClient.invalidateQueries(['customerThreads', currentUser?.id]);
      queryClient.invalidateQueries(['customerReplies', currentUser?.id]);
    });
    return unsub;
  }, [currentUser?.id, queryClient]);

  // Fetch restaurant names for threads
  const threadIds = [...new Set(messages.map(m => m.thread_id))];
  const restaurantIds = [...new Set(messages.map(m => m.restaurant_id).filter(Boolean))];

  const { data: restaurants = [] } = useQuery({
    queryKey: ['threadRestaurants', restaurantIds.join('|')],
    queryFn: async () => {
      const results = await Promise.all(
        restaurantIds.map(id => base44.entities.Restaurant.filter({ id }))
      );
      return results.flat();
    },
    enabled: restaurantIds.length > 0,
  });

  const restaurantMap = React.useMemo(() => {
    const m = {};
    restaurants.forEach(r => { m[r.id] = r; });
    return m;
  }, [restaurants]);

  const allMessages = React.useMemo(() => {
    const combined = [...messages, ...replies];
    const seen = new Set();
    return combined.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  }, [messages, replies]);

  // Group into threads
  const threads = React.useMemo(() => {
    const grouped = {};
    allMessages.forEach(msg => {
      if (!grouped[msg.thread_id]) {
        grouped[msg.thread_id] = {
          thread_id: msg.thread_id,
          restaurant_id: msg.restaurant_id,
          restaurant_name: restaurantMap[msg.restaurant_id]?.name || 'Restaurant',
          messages: [],
          unread_count: 0,
          last_message_at: msg.created_date,
        };
      }
      grouped[msg.thread_id].messages.push(msg);
      if (!msg.is_read && msg.is_from_restaurant) {
        grouped[msg.thread_id].unread_count += 1;
      }
      if (new Date(msg.created_date) > new Date(grouped[msg.thread_id].last_message_at)) {
        grouped[msg.thread_id].last_message_at = msg.created_date;
      }
    });
    return Object.values(grouped).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  }, [allMessages, restaurantMap]);

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  if (selectedThread) {
    return <MessageThread thread={selectedThread} currentUser={currentUser} onBack={() => setSelectedThread(null)} />;
  }

  if (threads.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No messages yet</h2>
          <p className="text-slate-500">Message a restaurant from its profile page to start a conversation.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => {
        const lastMsg = thread.messages[thread.messages.length - 1];
        return (
          <button
            key={thread.thread_id}
            onClick={() => setSelectedThread(thread)}
            className="w-full p-4 text-left rounded-xl border bg-white hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={cn("font-medium text-slate-900", thread.unread_count > 0 && "font-semibold")}>
                    {thread.restaurant_name}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">{moment(thread.last_message_at).fromNow()}</p>
                    {thread.unread_count > 0 && (
                      <Badge className="bg-blue-600 text-white text-xs h-5 px-1.5">{thread.unread_count}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-500 truncate">{lastMsg?.message}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────
export default function Inbox() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) { base44.auth.redirectToLogin(createPageUrl('Inbox')); return; }
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ['unreadMessages', currentUser?.id],
    queryFn: () => base44.entities.Message.filter({ sender_id: currentUser.id }, '-created_date', 1),
    enabled: !!currentUser,
  });

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Inbox</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!currentUser ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <Tabs defaultValue="notifications">
            <TabsList className="w-full mb-6 bg-white shadow-sm rounded-full p-1">
              <TabsTrigger value="notifications" className="flex-1 rounded-full gap-2">
                <Bell className="w-4 h-4" />
                Notifications
                {unreadNotifCount > 0 && (
                  <Badge className="bg-red-500 text-white text-xs h-5 px-1.5 ml-1">{unreadNotifCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex-1 rounded-full gap-2">
                <MessageCircle className="w-4 h-4" />
                Messages
              </TabsTrigger>
            </TabsList>
            <TabsContent value="notifications">
              <NotificationsTab currentUser={currentUser} />
            </TabsContent>
            <TabsContent value="messages">
              <MessagesTab currentUser={currentUser} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
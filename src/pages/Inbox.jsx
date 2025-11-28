import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Bell, Check, CheckCheck, Trash2, Calendar, Store } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import moment from 'moment';
import { cn } from "@/lib/utils";

export default function Inbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(createPageUrl('Inbox'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'reservation_approved':
        return <Check className="w-5 h-5 text-emerald-600" />;
      case 'reservation_declined':
        return <Calendar className="w-5 h-5 text-red-500" />;
      case 'reservation_request':
        return <Calendar className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'reservation_approved':
        return 'bg-emerald-50 border-emerald-200';
      case 'reservation_declined':
        return 'bg-red-50 border-red-200';
      case 'reservation_request':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-48" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg">Inbox</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-slate-500">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                className="gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {notifications.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No notifications</h2>
              <p className="text-slate-500">You're all caught up!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  "border transition-all cursor-pointer hover:shadow-md",
                  !notification.is_read ? getNotificationColor(notification.type) : "bg-white border-slate-200"
                )}
                onClick={() => !notification.is_read && markReadMutation.mutate(notification.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      notification.type === 'reservation_approved' && "bg-emerald-100",
                      notification.type === 'reservation_declined' && "bg-red-100",
                      notification.type === 'reservation_request' && "bg-amber-100",
                      notification.type === 'welcome' && "bg-blue-100"
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={cn(
                          "font-medium",
                          !notification.is_read && "font-semibold"
                        )}>
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <Badge className="bg-blue-500 shrink-0">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                      {notification.restaurant_name && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                          <Store className="w-3 h-3" />
                          {notification.restaurant_name}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {moment(notification.created_date).fromNow()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
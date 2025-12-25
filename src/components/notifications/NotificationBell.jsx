import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check, Clock, MapPin, Star, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import moment from 'moment';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell({ currentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => base44.entities.Notification.filter({ 
      user_id: currentUser.id 
    }, '-created_date', 50),
    enabled: !!currentUser,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => 
        base44.entities.Notification.update(n.id, { is_read: true })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const getIcon = (type) => {
    switch (type) {
      case 'table_ready': return <Clock className="w-4 h-4 text-emerald-600" />;
      case 'reservation_approved': return <Check className="w-4 h-4 text-green-600" />;
      case 'reservation_declined': return <X className="w-4 h-4 text-red-600" />;
      case 'reservation_request': return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'restaurant_available': return <MapPin className="w-4 h-4 text-blue-600" />;
      case 'high_priority_reservation': return <Star className="w-4 h-4 text-purple-600" />;
      case 'large_party_alert': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default: return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const handleNotificationClick = (notification) => {
    markAsReadMutation.mutate(notification.id);
    setOpen(false);
    
    if (notification.reservation_id) {
      navigate(createPageUrl('MyReservations'));
    } else if (notification.restaurant_id) {
      navigate(createPageUrl('RestaurantDetail') + `?id=${notification.restaurant_id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer",
                    !notification.is_read && "bg-blue-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {notification.message}
                      </p>
                      {notification.restaurant_name && (
                        <p className="text-xs text-slate-500 mt-1">
                          {notification.restaurant_name}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {moment(notification.created_date).fromNow()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                      className="flex-shrink-0 h-6 w-6"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
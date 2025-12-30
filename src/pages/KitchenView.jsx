import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, ChefHat, Clock, Users, CheckCircle2, PlayCircle, 
  AlertCircle, Calendar, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import moment from 'moment';
import { toast } from "sonner";

export default function KitchenView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('restaurant_id');
  
  const [currentUser, setCurrentUser] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // upcoming, in_progress, completed

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
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

  // Fetch reservations with pre-orders
  const { data: reservations = [], isLoading: loadingReservations } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurantId,
      status: ['approved', 'pending']
    }),
    enabled: !!restaurantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: preOrders = [], isLoading: loadingPreOrders } = useQuery({
    queryKey: ['preOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
    refetchInterval: 30000,
  });

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  // Update kitchen status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ preOrderId, status }) => {
      const updateData = { kitchen_status: status };
      if (status === 'in_progress') {
        updateData.kitchen_started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.kitchen_completed_at = new Date().toISOString();
      }
      return base44.entities.PreOrder.update(preOrderId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['preOrders']);
      toast.success('Order status updated');
    }
  });

  // Combine reservations with pre-orders
  const ordersWithReservations = preOrders
    .map(order => {
      const reservation = reservations.find(r => r.id === order.reservation_id);
      return reservation ? { ...order, reservation } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = moment(`${a.reservation.reservation_date} ${a.reservation.reservation_time}`);
      const bTime = moment(`${b.reservation.reservation_date} ${b.reservation.reservation_time}`);
      return aTime.diff(bTime);
    });

  // Filter orders
  const filteredOrders = ordersWithReservations.filter(order => {
    if (filter === 'upcoming') return order.kitchen_status === 'pending';
    if (filter === 'in_progress') return order.kitchen_status === 'in_progress';
    if (filter === 'completed') return order.kitchen_status === 'completed';
    return true;
  });

  // Get counts
  const upcomingCount = ordersWithReservations.filter(o => o.kitchen_status === 'pending').length;
  const inProgressCount = ordersWithReservations.filter(o => o.kitchen_status === 'in_progress').length;
  const completedCount = ordersWithReservations.filter(o => o.kitchen_status === 'completed').length;

  const isLoading = loadingReservations || loadingPreOrders;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl('OwnerDashboard') + `?id=${restaurantId}`)}
                className="rounded-full text-white hover:bg-slate-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-emerald-400" />
                  <h1 className="font-bold text-xl">Kitchen View</h1>
                </div>
                <p className="text-sm text-slate-400">{restaurant?.name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries(['preOrders']);
                queryClient.invalidateQueries(['reservations']);
              }}
              className="gap-2 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setFilter('upcoming')}
              className={cn(
                "p-4 rounded-xl border transition-all",
                filter === 'upcoming'
                  ? "bg-amber-500/20 border-amber-500"
                  : "bg-slate-700 border-slate-600 hover:border-slate-500"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold">{upcomingCount}</p>
                  <p className="text-sm text-slate-400">Upcoming</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilter('in_progress')}
              className={cn(
                "p-4 rounded-xl border transition-all",
                filter === 'in_progress'
                  ? "bg-blue-500/20 border-blue-500"
                  : "bg-slate-700 border-slate-600 hover:border-slate-500"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                  <p className="text-sm text-slate-400">In Progress</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilter('completed')}
              className={cn(
                "p-4 rounded-xl border transition-all",
                filter === 'completed'
                  ? "bg-emerald-500/20 border-emerald-500"
                  : "bg-slate-700 border-slate-600 hover:border-slate-500"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold">{completedCount}</p>
                  <p className="text-sm text-slate-400">Completed</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 rounded-2xl bg-slate-800" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 text-lg mb-2">No {filter} orders</p>
            <p className="text-slate-500 text-sm">Pre-orders will appear here</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map(order => {
              const resTime = moment(`${order.reservation.reservation_date} ${order.reservation.reservation_time}`);
              const timeUntil = resTime.diff(moment(), 'minutes');
              const isUrgent = timeUntil <= 30 && timeUntil > 0;

              return (
                <Card key={order.id} className={cn(
                  "border-0 bg-slate-800 shadow-xl",
                  isUrgent && order.kitchen_status === 'pending' && "border-2 border-amber-500"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-white text-xl">
                            {order.reservation.user_name}
                          </CardTitle>
                          {isUrgent && order.kitchen_status === 'pending' && (
                            <Badge className="bg-amber-500 text-white animate-pulse">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {resTime.format('MMM D, h:mm A')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Party of {order.reservation.party_size}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {timeUntil > 0 ? `in ${timeUntil}m` : 'Now'}
                          </span>
                        </div>
                      </div>

                      {/* Status Actions */}
                      <div className="flex gap-2">
                        {order.kitchen_status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ 
                              preOrderId: order.id, 
                              status: 'in_progress' 
                            })}
                            className="bg-blue-600 hover:bg-blue-700 gap-2"
                          >
                            <PlayCircle className="w-4 h-4" />
                            Start
                          </Button>
                        )}
                        {order.kitchen_status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ 
                              preOrderId: order.id, 
                              status: 'completed' 
                            })}
                            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Complete
                          </Button>
                        )}
                        {order.kitchen_status === 'completed' && (
                          <Badge className="bg-emerald-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Done
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Order Items */}
                    <div className="space-y-3 mb-4">
                      {(order.items || []).map((item, idx) => (
                        <div 
                          key={idx}
                          className="flex items-start justify-between p-3 bg-slate-700 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-lg text-emerald-400">
                                {item.quantity}x
                              </span>
                              <span className="font-semibold text-white">
                                {item.name}
                              </span>
                            </div>
                            {item.item_notes && (
                              <p className="text-sm text-amber-400 mt-1 flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                {item.item_notes}
                              </p>
                            )}
                          </div>
                          <span className="text-slate-400 font-medium">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Special Instructions */}
                    {order.special_instructions && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-xs text-amber-400 font-semibold mb-1">
                          SPECIAL INSTRUCTIONS:
                        </p>
                        <p className="text-white">{order.special_instructions}</p>
                      </div>
                    )}

                    {/* Total */}
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Order Total</span>
                        <span className="text-2xl font-bold text-white">
                          ${order.total_amount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Pay at restaurant</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
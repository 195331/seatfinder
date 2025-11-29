import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  LogOut, ChevronRight, Calendar, Award, Heart, 
  Store, Shield, Loader2, Clock, Gift, X,
  Camera, Pencil
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

const FOOD_AVATARS = [
  { id: 'pizza', emoji: '🍕' },
  { id: 'burger', emoji: '🍔' },
  { id: 'sushi', emoji: '🍣' },
  { id: 'taco', emoji: '🌮' },
  { id: 'ramen', emoji: '🍜' },
  { id: 'salad', emoji: '🥗' },
  { id: 'steak', emoji: '🥩' },
  { id: 'pasta', emoji: '🍝' },
  { id: 'icecream', emoji: '🍦' },
  { id: 'donut', emoji: '🍩' },
  { id: 'cake', emoji: '🎂' },
  { id: 'cookie', emoji: '🍪' },
  { id: 'fries', emoji: '🍟' },
  { id: 'hotdog', emoji: '🌭' },
  { id: 'sandwich', emoji: '🥪' },
  { id: 'croissant', emoji: '🥐' },
  { id: 'dumpling', emoji: '🥟' },
  { id: 'curry', emoji: '🍛' },
  { id: 'shrimp', emoji: '🍤' },
  { id: 'cupcake', emoji: '🧁' },
];

export default function ProfileDrawer({ currentUser, onLogout }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar);

  // Fetch reservations
  const { data: reservations = [] } = useQuery({
    queryKey: ['myReservations', currentUser?.id],
    queryFn: () => base44.entities.Reservation.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser && open,
  });

  // Fetch waitlist entries
  const { data: waitlistEntries = [] } = useQuery({
    queryKey: ['myWaitlist', currentUser?.id],
    queryFn: () => base44.entities.WaitlistEntry.filter({ user_id: currentUser.id, status: 'waiting' }),
    enabled: !!currentUser && open,
  });

  // Fetch loyalty memberships
  const { data: loyaltyMemberships = [] } = useQuery({
    queryKey: ['myLoyalty', currentUser?.id],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ user_id: currentUser.id }),
    enabled: !!currentUser && open,
  });

  // Fetch restaurants for loyalty display
  const { data: restaurants = [] } = useQuery({
    queryKey: ['loyaltyRestaurants', loyaltyMemberships],
    queryFn: async () => {
      if (loyaltyMemberships.length === 0) return [];
      const ids = loyaltyMemberships.map(l => l.restaurant_id);
      const results = await Promise.all(ids.map(id => 
        base44.entities.Restaurant.filter({ id }).then(r => r[0])
      ));
      return results.filter(Boolean);
    },
    enabled: loyaltyMemberships.length > 0 && open,
  });

  // Fetch loyalty programs
  const { data: programs = [] } = useQuery({
    queryKey: ['loyaltyPrograms', loyaltyMemberships],
    queryFn: async () => {
      if (loyaltyMemberships.length === 0) return [];
      const ids = loyaltyMemberships.map(l => l.program_id).filter(Boolean);
      const results = await Promise.all(ids.map(id => 
        base44.entities.LoyaltyProgram.filter({ id }).then(r => r[0])
      ));
      return results.filter(Boolean);
    },
    enabled: loyaltyMemberships.length > 0 && open,
  });

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: (avatar) => base44.auth.updateMe({ avatar }),
    onSuccess: () => {
      toast.success('Avatar updated!');
      setEditingAvatar(false);
      queryClient.invalidateQueries(['currentUser']);
    }
  });

  const upcomingReservations = reservations.filter(r => 
    r.status !== 'cancelled' && new Date(r.reservation_date) >= new Date()
  );
  const pastReservations = reservations.filter(r => 
    r.status === 'cancelled' || new Date(r.reservation_date) < new Date()
  );

  const getUserAvatar = () => {
    if (currentUser?.profile_image) {
      return null; // Will use image instead
    }
    if (currentUser?.avatar) {
      const avatar = FOOD_AVATARS.find(a => a.id === currentUser.avatar);
      return avatar?.emoji || currentUser.full_name?.[0] || currentUser.email?.[0]?.toUpperCase();
    }
    return currentUser?.full_name?.[0] || currentUser?.email?.[0]?.toUpperCase() || 'S';
  };

  const hasProfileImage = !!currentUser?.profile_image;

  const getRestaurantForLoyalty = (loyalty) => {
    return restaurants.find(r => r.id === loyalty.restaurant_id);
  };

  const getProgramForLoyalty = (loyalty) => {
    return programs.find(p => p.id === loyalty.program_id);
  };

  if (!currentUser) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center hover:opacity-90 transition-opacity">
          {hasProfileImage ? (
            <img 
              src={currentUser.profile_image} 
              alt={currentUser.full_name || 'Profile'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl text-white">
              {getUserAvatar()}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          {/* Profile Header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl overflow-hidden">
                  {hasProfileImage ? (
                    <img 
                      src={currentUser.profile_image} 
                      alt={currentUser.full_name || 'Profile'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getUserAvatar()
                  )}
                </div>
                <button 
                  onClick={() => setEditingAvatar(true)}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg"
                >
                  <Pencil className="w-4 h-4 text-emerald-600" />
                </button>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">{currentUser.full_name || 'User'}</h2>
                <p className="text-sm opacity-90">{currentUser.email}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Avatar Editor */}
          {editingAvatar && (
            <div className="p-4 bg-slate-50 border-b">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">Choose Avatar</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setEditingAvatar(false)}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {FOOD_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatar(avatar.id);
                      updateAvatarMutation.mutate(avatar.id);
                    }}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-2xl transition-all",
                      selectedAvatar === avatar.id || currentUser.avatar === avatar.id
                        ? "bg-emerald-100 ring-2 ring-emerald-500"
                        : "bg-white hover:bg-slate-100"
                    )}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4 bg-slate-100">
              <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
              <TabsTrigger value="reservations" className="flex-1">
                Reservations
                {upcomingReservations.length > 0 && (
                  <Badge className="ml-1.5 bg-emerald-500 text-xs px-1.5">{upcomingReservations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rewards" className="flex-1">Rewards</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="profile" className="p-4 space-y-2 m-0">
                {/* User Role Badge */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl mb-2">
                  <span className="text-sm text-slate-500">Role:</span>
                  <span className="px-2 py-0.5 bg-slate-200 rounded text-sm font-medium capitalize">
                    {currentUser.role || currentUser.user_type || 'User'}
                  </span>
                </div>

                <Link to={createPageUrl('Profile')} onClick={() => setOpen(false)}>
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Pencil className="w-5 h-5 text-slate-600" />
                      <span>Edit Profile</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Link>

                <Link to={createPageUrl('Favorites')} onClick={() => setOpen(false)}>
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span>Favorites</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Link>

                {(currentUser.user_type === 'owner' || currentUser.role === 'admin') && (
                  <Link to={createPageUrl('OwnerDashboard')} onClick={() => setOpen(false)}>
                    <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-emerald-600" />
                        <span>My Restaurant</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </Link>
                )}

                {currentUser.role === 'admin' && (
                  <Link to={createPageUrl('AdminDashboard')} onClick={() => setOpen(false)}>
                    <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-purple-600" />
                        <span>Admin Dashboard</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </Link>
                )}

                {currentUser.user_type !== 'owner' && currentUser.role !== 'admin' && (
                  <Link to={createPageUrl('CreateRestaurant')} onClick={() => setOpen(false)}>
                    <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-slate-600" />
                        <span>List Your Restaurant</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </Link>
                )}

                <div className="pt-4 border-t mt-4">
                  <button 
                    onClick={() => {
                      setOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="reservations" className="p-4 space-y-4 m-0">
                {/* Active Waitlist */}
                {waitlistEntries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-slate-500 mb-2">ACTIVE WAITLIST</h3>
                    {waitlistEntries.map((entry) => (
                      <Card key={entry.id} className="mb-2 border-amber-200 bg-amber-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Party of {entry.party_size}</p>
                              <p className="text-sm text-amber-700">
                                Est. wait: {entry.estimated_wait_minutes || 15} mins
                              </p>
                            </div>
                            <Badge className="bg-amber-500">Waiting</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Upcoming Reservations */}
                <div>
                  <h3 className="font-semibold text-sm text-slate-500 mb-2">UPCOMING</h3>
                  {upcomingReservations.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm">No upcoming reservations</p>
                        <Button 
                          variant="link" 
                          className="mt-2 text-emerald-600"
                          onClick={() => {
                            setOpen(false);
                            navigate(createPageUrl('Home'));
                          }}
                        >
                          Find a restaurant
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    upcomingReservations.map((res) => (
                      <Card key={res.id} className="mb-2">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{res.user_name || 'Reservation'}</p>
                              <p className="text-sm text-slate-500">
                                {moment(res.reservation_date).format('MMM D')} at {res.reservation_time}
                              </p>
                              <p className="text-sm text-slate-500">Party of {res.party_size}</p>
                            </div>
                            <Badge className={cn(
                              res.status === 'approved' && "bg-emerald-500",
                              res.status === 'pending' && "bg-amber-500",
                              res.status === 'declined' && "bg-red-500"
                            )}>
                              {res.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Past Reservations */}
                {pastReservations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-slate-500 mb-2">PAST</h3>
                    {pastReservations.slice(0, 3).map((res) => (
                      <Card key={res.id} className="mb-2 opacity-60">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{res.user_name || 'Reservation'}</p>
                              <p className="text-sm text-slate-500">
                                {moment(res.reservation_date).format('MMM D, YYYY')}
                              </p>
                            </div>
                            <Badge variant="secondary">{res.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rewards" className="p-4 space-y-4 m-0">
                {loyaltyMemberships.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm mb-2">No rewards programs yet</p>
                      <p className="text-xs text-slate-400">
                        Join loyalty programs at your favorite restaurants to earn points and rewards!
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => {
                          setOpen(false);
                          navigate(createPageUrl('Home'));
                        }}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Browse Restaurants
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  loyaltyMemberships.map((loyalty) => {
                    const restaurant = getRestaurantForLoyalty(loyalty);
                    const program = getProgramForLoyalty(loyalty);
                    return (
                      <Card key={loyalty.id} className="overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold">{restaurant?.name || 'Restaurant'}</p>
                              <p className="text-sm opacity-90">{loyalty.current_tier} Member</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{loyalty.available_points}</p>
                              <p className="text-xs opacity-90">points</p>
                            </div>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">{loyalty.visits || 0} visits</span>
                            <span className="text-slate-500">
                              ${loyalty.total_spent?.toFixed(2) || '0.00'} spent
                            </span>
                          </div>
                          {program?.rewards?.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-slate-500 mb-2">AVAILABLE REWARDS</p>
                              {program.rewards.slice(0, 2).map((reward, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1">
                                  <span className="text-sm">{reward.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {reward.points_required} pts
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
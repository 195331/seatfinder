import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Settings, Heart, Calendar, Sparkles, Camera, 
  Edit3, MapPin, Clock, Check, X 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';
import RestaurantCard from '@/components/customer/RestaurantCard';

const FOOD_AVATARS = [
  { id: 'pizza', emoji: '🍕' },
  { id: 'burger', emoji: '🍔' },
  { id: 'sushi', emoji: '🍣' },
  { id: 'taco', emoji: '🌮' },
  { id: 'ramen', emoji: '🍜' },
  { id: 'salad', emoji: '🥗' },
  { id: 'steak', emoji: '🥩' },
  { id: 'pasta', emoji: '🍝' },
];

export default function UserProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(createPageUrl('UserProfile'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
        setBio(user.bio || '');
        setSelectedAvatar(user.avatar || null);
        setProfileImage(user.profile_image || null);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  // Fetch user data
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: () => base44.entities.Favorite.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['userReservations', currentUser?.id],
    queryFn: () => base44.entities.Reservation.filter({ user_id: currentUser.id }, '-created_date'),
    enabled: !!currentUser,
  });

  const { data: moodBoards = [] } = useQuery({
    queryKey: ['moodBoards', currentUser?.id],
    queryFn: () => base44.entities.FilterPreset.filter({ user_id: currentUser.id }),
    enabled: !!currentUser,
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['favoriteRestaurants', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const restaurantPromises = favorites.map(f => 
        base44.entities.Restaurant.filter({ id: f.restaurant_id }).then(r => r[0])
      );
      return Promise.all(restaurantPromises);
    },
    enabled: favorites.length > 0,
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProfileImage(file_url);
      setSelectedAvatar(null);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    }
    setUploading(false);
  };

  const handleSaveProfile = async () => {
    try {
      await base44.auth.updateMe({
        bio,
        avatar: selectedAvatar,
        profile_image: profileImage
      });
      setCurrentUser({ ...currentUser, bio, avatar: selectedAvatar, profile_image: profileImage });
      setEditMode(false);
      toast.success('Profile updated!');
    } catch (e) {
      toast.error('Failed to update profile');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Skeleton className="w-24 h-24 rounded-full" />
      </div>
    );
  }

  const upcomingReservations = reservations.filter(r => 
    r.status === 'approved' && new Date(r.reservation_date) >= new Date()
  );

  const pastReservations = reservations.filter(r => 
    r.status === 'approved' && new Date(r.reservation_date) < new Date()
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Profile</h1>
          <Link to={createPageUrl('Settings')}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8 border-0 shadow-xl overflow-hidden">
          <div className="relative h-32 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500" />
          <CardContent className="relative pt-16 pb-8">
            <div className="absolute -top-16 left-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-xl overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : selectedAvatar ? (
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-6xl">
                      {FOOD_AVATARS.find(a => a.id === selectedAvatar)?.emoji}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-6xl">
                      🍽️
                    </div>
                  )}
                </div>
                {editMode && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-purple-700"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="ml-44">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-slate-900">{currentUser.full_name}</h2>
                  <p className="text-slate-500 mt-1">{currentUser.email}</p>
                  
                  {editMode ? (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Write a short bio..."
                        maxLength={200}
                        className="resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveProfile} size="sm">
                          <Check className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => setEditMode(false)} variant="outline" size="sm">
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {bio && <p className="text-slate-600 mt-3 max-w-2xl">{bio}</p>}
                      <Button 
                        onClick={() => setEditMode(true)} 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{favorites.length}</p>
                    <p className="text-sm text-slate-500">Favorites</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{reservations.length}</p>
                    <p className="text-sm text-slate-500">Reservations</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{moodBoards.length}</p>
                    <p className="text-sm text-slate-500">Mood Boards</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="reservations" className="space-y-6">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="reservations" className="gap-2">
              <Calendar className="w-4 h-4" />
              Reservations
            </TabsTrigger>
            <TabsTrigger value="favorites" className="gap-2">
              <Heart className="w-4 h-4" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="moodboards" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Mood Boards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reservations" className="space-y-6">
            {/* Upcoming */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Upcoming</h3>
              {upcomingReservations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No upcoming reservations</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingReservations.map(reservation => (
                    <Card key={reservation.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-lg">{reservation.restaurant_name || 'Restaurant'}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {moment(reservation.reservation_date).format('MMM D, YYYY')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {reservation.reservation_time}
                              </span>
                              <span>{reservation.party_size} guests</span>
                            </div>
                          </div>
                          <Badge className="bg-emerald-600">Confirmed</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Past Reservations</h3>
              {pastReservations.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No past reservations</p>
              ) : (
                <div className="space-y-3">
                  {pastReservations.slice(0, 10).map(reservation => (
                    <Card key={reservation.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{reservation.restaurant_name || 'Restaurant'}</p>
                            <p className="text-sm text-slate-500">
                              {moment(reservation.reservation_date).format('MMM D, YYYY')} • {reservation.party_size} guests
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="favorites">
            {restaurants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Heart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No favorite restaurants yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {restaurants.map(restaurant => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    isFavorite={true}
                    onClick={() => navigate(createPageUrl('RestaurantDetail') + `?id=${restaurant.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="moodboards">
            {moodBoards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No mood boards created yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {moodBoards.map(board => (
                  <Card key={board.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-6 text-center">
                      <div className="text-4xl mb-3">{board.icon}</div>
                      <p className="font-medium text-slate-900">{board.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {(board.filters?.restaurant_ids || []).length} places
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
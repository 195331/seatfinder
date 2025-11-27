import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Shield, MapPin, Store, Users, Check, X, Eye, 
  AlertTriangle, Plus, Trash2, Search, MoreVertical
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import moment from 'moment';
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  
  // City form
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [cityForm, setCityForm] = useState({
    name: '',
    slug: '',
    state: '',
    latitude: '',
    longitude: '',
    is_active: true
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
          return;
        }
        const user = await base44.auth.me();
        if (user.role !== 'admin' && user.user_type !== 'admin') {
          navigate(createPageUrl('Home'));
          return;
        }
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  // Fetch data
  const { data: cities = [], isLoading: loadingCities } = useQuery({
    queryKey: ['adminCities'],
    queryFn: () => base44.entities.City.list(),
    enabled: !!currentUser,
  });

  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery({
    queryKey: ['adminRestaurants'],
    queryFn: () => base44.entities.Restaurant.list('-created_date', 100),
    enabled: !!currentUser,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
    enabled: !!currentUser,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['adminReviews'],
    queryFn: () => base44.entities.Review.list('-created_date', 50),
    enabled: !!currentUser,
  });

  // Mutations
  const createCityMutation = useMutation({
    mutationFn: () => base44.entities.City.create({
      ...cityForm,
      latitude: parseFloat(cityForm.latitude) || null,
      longitude: parseFloat(cityForm.longitude) || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminCities']);
      setShowCityDialog(false);
      setCityForm({ name: '', slug: '', state: '', latitude: '', longitude: '', is_active: true });
    }
  });

  const updateCityMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.City.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['adminCities'])
  });

  const deleteCityMutation = useMutation({
    mutationFn: (id) => base44.entities.City.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['adminCities'])
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Restaurant.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['adminRestaurants'])
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['adminUsers'])
  });

  const hideReviewMutation = useMutation({
    mutationFn: ({ id, hidden }) => base44.entities.Review.update(id, { is_hidden: hidden }),
    onSuccess: () => queryClient.invalidateQueries(['adminReviews'])
  });

  // Stats
  const pendingRestaurants = restaurants.filter(r => r.status === 'pending').length;
  const activeRestaurants = restaurants.filter(r => r.status === 'approved').length;
  const activeCities = cities.filter(c => c.is_active).length;
  const ownerCount = users.filter(u => u.user_type === 'owner').length;

  // Filtered data
  const filteredRestaurants = restaurants.filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!currentUser || loadingCities || loadingRestaurants) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-500">SeatFinder Platform</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activeCities}</p>
                  <p className="text-sm text-slate-500">Active Cities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activeRestaurants}</p>
                  <p className="text-sm text-slate-500">Restaurants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{pendingRestaurants}</p>
                  <p className="text-sm text-slate-500">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{ownerCount}</p>
                  <p className="text-sm text-slate-500">Owners</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white shadow-sm rounded-full p-1">
            <TabsTrigger value="overview" className="rounded-full">Overview</TabsTrigger>
            <TabsTrigger value="restaurants" className="rounded-full">
              Restaurants
              {pendingRestaurants > 0 && (
                <Badge className="ml-2 bg-amber-500">{pendingRestaurants}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cities" className="rounded-full">Cities</TabsTrigger>
            <TabsTrigger value="users" className="rounded-full">Users</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-full">Reviews</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Approvals */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  {restaurants.filter(r => r.status === 'pending').length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No pending approvals</p>
                  ) : (
                    <div className="space-y-3">
                      {restaurants.filter(r => r.status === 'pending').slice(0, 5).map(restaurant => (
                        <div 
                          key={restaurant.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                        >
                          <div>
                            <p className="font-medium">{restaurant.name}</p>
                            <p className="text-sm text-slate-500">{restaurant.address}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateRestaurantMutation.mutate({
                                id: restaurant.id,
                                data: { status: 'suspended' }
                              })}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateRestaurantMutation.mutate({
                                id: restaurant.id,
                                data: { status: 'approved' }
                              })}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Recent Restaurants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {restaurants.slice(0, 5).map(restaurant => (
                      <div 
                        key={restaurant.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                      >
                        <div>
                          <p className="font-medium">{restaurant.name}</p>
                          <p className="text-sm text-slate-500">
                            {moment(restaurant.created_date).fromNow()}
                          </p>
                        </div>
                        <Badge variant={
                          restaurant.status === 'approved' ? 'default' :
                          restaurant.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {restaurant.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Restaurants Tab */}
          <TabsContent value="restaurants">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Restaurants</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRestaurants.map(restaurant => {
                      const city = cities.find(c => c.id === restaurant.city_id);
                      return (
                        <TableRow key={restaurant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{restaurant.name}</p>
                              <p className="text-sm text-slate-500">{restaurant.cuisine}</p>
                            </div>
                          </TableCell>
                          <TableCell>{city?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              restaurant.status === 'approved' ? 'default' :
                              restaurant.status === 'pending' ? 'secondary' : 'destructive'
                            }>
                              {restaurant.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {restaurant.subscription_plan || 'free'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {moment(restaurant.created_date).format('MMM D, YYYY')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => updateRestaurantMutation.mutate({
                                    id: restaurant.id,
                                    data: { status: 'approved' }
                                  })}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateRestaurantMutation.mutate({
                                    id: restaurant.id,
                                    data: { status: 'suspended' }
                                  })}
                                  className="text-red-600"
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cities Tab */}
          <TabsContent value="cities">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cities</CardTitle>
                  <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
                    <DialogTrigger asChild>
                      <Button className="rounded-full gap-2">
                        <Plus className="w-4 h-4" />
                        Add City
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New City</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label>City Name</Label>
                          <Input
                            value={cityForm.name}
                            onChange={(e) => setCityForm(prev => ({ 
                              ...prev, 
                              name: e.target.value,
                              slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                            }))}
                            placeholder="Jersey City"
                            className="mt-1.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Slug</Label>
                            <Input
                              value={cityForm.slug}
                              onChange={(e) => setCityForm(prev => ({ ...prev, slug: e.target.value }))}
                              placeholder="jersey-city"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>State</Label>
                            <Input
                              value={cityForm.state}
                              onChange={(e) => setCityForm(prev => ({ ...prev, state: e.target.value }))}
                              placeholder="NJ"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Latitude</Label>
                            <Input
                              type="number"
                              step="any"
                              value={cityForm.latitude}
                              onChange={(e) => setCityForm(prev => ({ ...prev, latitude: e.target.value }))}
                              placeholder="40.7178"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label>Longitude</Label>
                            <Input
                              type="number"
                              step="any"
                              value={cityForm.longitude}
                              onChange={(e) => setCityForm(prev => ({ ...prev, longitude: e.target.value }))}
                              placeholder="-74.0431"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Active</Label>
                          <Switch
                            checked={cityForm.is_active}
                            onCheckedChange={(checked) => setCityForm(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>
                        <Button
                          onClick={() => createCityMutation.mutate()}
                          disabled={!cityForm.name || !cityForm.slug || createCityMutation.isPending}
                          className="w-full rounded-full"
                        >
                          {createCityMutation.isPending ? 'Creating...' : 'Create City'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>City</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Restaurants</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cities.map(city => (
                      <TableRow key={city.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{city.name}</p>
                            <p className="text-sm text-slate-500">{city.state}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">{city.slug}</TableCell>
                        <TableCell>
                          {restaurants.filter(r => r.city_id === city.id).length}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={city.is_active}
                            onCheckedChange={(checked) => updateCityMutation.mutate({
                              id: city.id,
                              data: { is_active: checked }
                            })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCityMutation.mutate(city.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Users</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.user_type || 'customer'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role || 'user'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {moment(user.created_date).format('MMM D, YYYY')}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!user.is_blocked}
                            onCheckedChange={(checked) => updateUserMutation.mutate({
                              id: user.id,
                              data: { is_blocked: !checked }
                            })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reviews.map(review => {
                    const restaurant = restaurants.find(r => r.id === review.restaurant_id);
                    return (
                      <div 
                        key={review.id}
                        className={cn(
                          "p-4 rounded-xl border",
                          review.is_hidden ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{review.user_name}</span>
                              <Badge variant="outline">{review.rating} ★</Badge>
                              {review.is_hidden && (
                                <Badge variant="destructive">Hidden</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mb-2">
                              on {restaurant?.name || 'Unknown'} • {moment(review.created_date).fromNow()}
                            </p>
                            <p className="text-slate-700">{review.comment}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => hideReviewMutation.mutate({
                              id: review.id,
                              hidden: !review.is_hidden
                            })}
                          >
                            {review.is_hidden ? (
                              <Eye className="w-4 h-4 mr-2" />
                            ) : (
                              <X className="w-4 h-4 mr-2" />
                            )}
                            {review.is_hidden ? 'Show' : 'Hide'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
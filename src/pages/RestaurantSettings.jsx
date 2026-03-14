import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Store, Users, Save, Trash2, Mail, Plus,
  Crown, Check, X, Clock, UtensilsCrossed
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import SubscriptionPlans from '@/components/subscription/SubscriptionPlans';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageUploader from '@/components/owner/ImageUploader';
import RestaurantImageManager from '@/components/owner/RestaurantImageManager';
import OpeningHoursEditor from '@/components/owner/OpeningHoursEditor';
import ReservationTimeSlotsEditor from '@/components/owner/ReservationTimeSlotsEditor';
import MenuBuilder from '@/components/owner/MenuBuilder';
import PreOrderSettings from '@/components/owner/PreOrderSettings';

const CUISINES = [
  "Italian", "Japanese", "Mexican", "Chinese", "Indian", "Thai", 
  "American", "Mediterranean", "Korean", "French", "Vietnamese", 
  "Seafood", "Steakhouse", "Pizza", "Sushi", "BBQ", "Vegetarian", "Cafe"
];

export default function RestaurantSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id');
  
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('host');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'general');

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

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', restaurantId],
    queryFn: () => base44.entities.RestaurantStaff.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (restaurant && !formData) {
      setFormData({ ...restaurant });
    }
  }, [restaurant, formData]);

  const updateRestaurantMutation = useMutation({
    mutationFn: (data) => base44.entities.Restaurant.update(restaurantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurant', restaurantId]);
    }
  });

  const inviteStaffMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.RestaurantStaff.create({
        restaurant_id: restaurantId,
        user_email: inviteEmail,
        role: inviteRole,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['staff']);
      setInviteEmail('');
      setShowInviteDialog(false);
    }
  });

  const removeStaffMutation = useMutation({
    mutationFn: (staffId) => base44.entities.RestaurantStaff.delete(staffId),
    onSuccess: () => queryClient.invalidateQueries(['staff'])
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateRestaurantMutation.mutate({
      name: formData.name,
      address: formData.address,
      neighborhood: formData.neighborhood,
      phone: formData.phone,
      website: formData.website,
      menu_url: formData.menu_url,
      cuisine: formData.cuisine,
      price_level: formData.price_level,
      total_seats: formData.total_seats,
      has_outdoor: formData.has_outdoor,
      has_bar_seating: formData.has_bar_seating,
      is_kid_friendly: formData.is_kid_friendly,
      enable_preorder: formData.enable_preorder,
      waitlist_enabled: formData.waitlist_enabled,
      preorder_deadline_minutes: formData.preorder_deadline_minutes,
      preorder_all_items_eligible: formData.preorder_all_items_eligible,
      preorder_minimum_spend: formData.preorder_minimum_spend,
      preorder_max_quantity: formData.preorder_max_quantity,
      preorder_allow_instructions: formData.preorder_allow_instructions,
      latitude: formData.latitude,
      longitude: formData.longitude,
      cover_image: formData.cover_image,
      opening_hours: formData.opening_hours,
    });
  };

  if (isLoading || !formData) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Settings</h1>
                <p className="text-sm text-slate-500">{restaurant?.name}</p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={updateRestaurantMutation.isPending}
              className="rounded-full gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white shadow-sm rounded-full p-1 flex-wrap">
            <TabsTrigger value="general" className="rounded-full">General</TabsTrigger>
            <TabsTrigger value="hours" className="rounded-full gap-1.5">
              <Clock className="w-4 h-4" />
              Hours
            </TabsTrigger>
            <TabsTrigger value="menu" className="rounded-full gap-1.5">
              <UtensilsCrossed className="w-4 h-4" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="preorder" className="rounded-full">Pre-Order</TabsTrigger>
            <TabsTrigger value="staff" className="rounded-full">Staff</TabsTrigger>
            <TabsTrigger value="subscription" className="rounded-full">Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Restaurant Images */}
            <RestaurantImageManager restaurant={restaurant} />

            {/* Basic Info */}
            <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Restaurant Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Neighborhood</Label>
              <Input
                value={formData.neighborhood || ''}
                onChange={(e) => updateField('neighborhood', e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={formData.website || ''}
                  onChange={(e) => updateField('website', e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Cuisine</Label>
              <Select 
                value={formData.cuisine} 
                onValueChange={(v) => updateField('cuisine', v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUISINES.map(cuisine => (
                    <SelectItem key={cuisine} value={cuisine}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price Level</Label>
              <div className="flex gap-2 mt-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateField('price_level', level)}
                    className={cn(
                      "px-4 py-2 rounded-xl border transition-all",
                      formData.price_level === level
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {'$'.repeat(level)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Total Seats</Label>
              <Input
                type="number"
                value={formData.total_seats}
                onChange={(e) => updateField('total_seats', parseInt(e.target.value) || 0)}
                className="mt-1.5"
              />
            </div>

            <div className="space-y-3 pt-4">
              <Label>Features</Label>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span>Outdoor Seating</span>
                <Switch
                  checked={formData.has_outdoor}
                  onCheckedChange={(checked) => updateField('has_outdoor', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span>Bar Seating</span>
                <Switch
                  checked={formData.has_bar_seating}
                  onCheckedChange={(checked) => updateField('has_bar_seating', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span>Kid Friendly</span>
                <Switch
                  checked={formData.is_kid_friendly}
                  onCheckedChange={(checked) => updateField('is_kid_friendly', checked)}
                />
              </div>

              {/* Waitlist toggle — only for pro/plus */}
              {['pro', 'plus'].includes(restaurant?.subscription_plan) ? (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <div>
                    <span className="font-medium text-slate-800">Public Waitlist</span>
                    <p className="text-xs text-slate-500 mt-0.5">Let guests join your waitlist from the restaurant page</p>
                  </div>
                  <Switch
                    checked={!!formData.waitlist_enabled}
                    onCheckedChange={(checked) => updateField('waitlist_enabled', checked)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl opacity-60">
                  <div>
                    <span className="font-medium text-slate-700">Public Waitlist</span>
                    <p className="text-xs text-slate-500 mt-0.5">Requires Pro plan — upgrade in the Subscription tab</p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              )}

            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="hours">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Opening Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpeningHoursEditor
                  hours={formData.opening_hours || {}}
                  onChange={(hours) => updateField('opening_hours', hours)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu">
            <MenuBuilder restaurantId={restaurantId} />
          </TabsContent>

          <TabsContent value="preorder">
            <PreOrderSettings 
              restaurant={restaurant}
              onSave={(preorderData) => {
                Object.keys(preorderData).forEach(key => {
                  updateField(key, preorderData[key]);
                });
                handleSave();
              }}
            />
          </TabsContent>

          <TabsContent value="staff">
        {/* Staff Management */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Staff Access
                </CardTitle>
                <CardDescription>
                  Invite team members to manage seating
                </CardDescription>
              </div>
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full gap-2">
                    <Plus className="w-4 h-4" />
                    Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="staff@example.com"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="host">Host</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => inviteStaffMutation.mutate()}
                      disabled={!inviteEmail || inviteStaffMutation.isPending}
                      className="w-full rounded-full"
                    >
                      {inviteStaffMutation.isPending ? 'Inviting...' : 'Send Invite'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No staff members yet. Invite your team to help manage seating.
              </p>
            ) : (
              <div className="space-y-3">
                {staff.map((member) => (
                  <div 
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-600">
                          {member.user_email?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{member.user_email}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                            {member.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                            {member.role}
                          </Badge>
                          {!member.is_active && (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStaffMutation.mutate(member.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionPlans 
              restaurantId={restaurantId} 
              currentPlan={restaurant?.subscription_plan || 'free'} 
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
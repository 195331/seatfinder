import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  User, Bell, Sparkles, MapPin, Heart, Utensils, Shield,
  CreditCard, Settings as SettingsIcon, ArrowLeft, Save
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TasteProfile from '@/components/profile/TasteProfile';
import { DIETARY_OPTIONS as DIETARY_RESTRICTIONS } from '@/components/customer/SpecialRequestsForm';

const CUISINES = [
  'Italian', 'Chinese', 'Japanese', 'Mexican', 'Indian', 
  'Thai', 'French', 'Mediterranean', 'American', 'Korean',
  'Vietnamese', 'Spanish', 'Greek', 'Middle Eastern'
];

const AMENITIES = [
  { id: 'outdoor', label: 'Outdoor Seating', icon: '🌳' },
  { id: 'bar', label: 'Bar Seating', icon: '🍸' },
  { id: 'kid_friendly', label: 'Kid-Friendly', icon: '👶' },
  { id: 'live_music', label: 'Live Music', icon: '🎵' },
  { id: 'parking', label: 'Parking Available', icon: '🅿️' },
  { id: 'wifi', label: 'Free WiFi', icon: '📶' },
];

export default function Settings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // User preferences
  const [preferences, setPreferences] = useState({
    favorite_cuisines: [],
    dietary_restrictions: [],
    preferred_amenities: [],
    notifications: {
      reservation_updates: true,
      waitlist_updates: true,
      promotional: false,
      ai_recommendations: true,
    },
    ai_settings: {
      enable_personalization: true,
      use_dining_history: true,
      show_confidence_scores: true,
    }
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
        setCurrentUser(user);
        
        // Load existing preferences
        if (user.preferences) {
          setPreferences(prev => ({ ...prev, ...user.preferences }));
        }
      } catch (e) {
        navigate(createPageUrl('Home'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await base44.auth.updateMe({ preferences });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCuisine = (cuisine) => {
    setPreferences(prev => ({
      ...prev,
      favorite_cuisines: prev.favorite_cuisines.includes(cuisine)
        ? prev.favorite_cuisines.filter(c => c !== cuisine)
        : [...prev.favorite_cuisines, cuisine]
    }));
  };

  const toggleRestriction = (restriction) => {
    setPreferences(prev => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions.includes(restriction)
        ? prev.dietary_restrictions.filter(r => r !== restriction)
        : [...prev.dietary_restrictions, restriction]
    }));
  };

  const toggleAmenity = (amenityId) => {
    setPreferences(prev => ({
      ...prev,
      preferred_amenities: prev.preferred_amenities.includes(amenityId)
        ? prev.preferred_amenities.filter(a => a !== amenityId)
        : [...prev.preferred_amenities, amenityId]
    }));
  };

  const updateNotification = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value }
    }));
  };

  const updateAISetting = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      ai_settings: { ...prev.ai_settings, [key]: value }
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
                <h1 className="text-xl font-bold text-slate-900">Settings</h1>
                <p className="text-sm text-slate-500">Manage your preferences</p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white shadow-sm rounded-full p-1">
            <TabsTrigger value="profile" className="rounded-full gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-full gap-2">
              <Heart className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-full gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-full gap-2">
              <Sparkles className="w-4 h-4" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={currentUser?.full_name || ''} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={currentUser?.email || ''} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Account Type</Label>
                  <Badge className="mt-1.5">
                    {currentUser?.user_type === 'owner' ? 'Restaurant Owner' : 'Diner'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taste Profile</CardTitle>
                <CardDescription>Help us personalize your experience</CardDescription>
              </CardHeader>
              <CardContent>
                <TasteProfile currentUser={currentUser} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="w-5 h-5" />
                  Favorite Cuisines
                </CardTitle>
                <CardDescription>Select your preferred cuisine types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => toggleCuisine(cuisine)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                        preferences.favorite_cuisines.includes(cuisine)
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Dietary Restrictions
                </CardTitle>
                <CardDescription>These will be automatically added to your dietary needs when you make a reservation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_RESTRICTIONS.map((restriction) => (
                    <button
                      key={restriction}
                      onClick={() => toggleRestriction(restriction)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                        preferences.dietary_restrictions.includes(restriction)
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {restriction}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Preferred Amenities
                </CardTitle>
                <CardDescription>Features you look for in restaurants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {AMENITIES.map((amenity) => (
                    <div key={amenity.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{amenity.icon}</span>
                        <span className="font-medium text-slate-700">{amenity.label}</span>
                      </div>
                      <Switch
                        checked={preferences.preferred_amenities.includes(amenity.id)}
                        onCheckedChange={() => toggleAmenity(amenity.id)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what updates you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Reservation Updates</p>
                    <p className="text-sm text-slate-500">Get notified when reservations are confirmed or changed</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.reservation_updates}
                    onCheckedChange={(val) => updateNotification('reservation_updates', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Waitlist Updates</p>
                    <p className="text-sm text-slate-500">SMS when your table is ready</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.waitlist_updates}
                    onCheckedChange={(val) => updateNotification('waitlist_updates', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">AI Recommendations</p>
                    <p className="text-sm text-slate-500">Personalized restaurant suggestions based on your taste</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.ai_recommendations}
                    onCheckedChange={(val) => updateNotification('ai_recommendations', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Promotional Offers</p>
                    <p className="text-sm text-slate-500">Deals and special offers from restaurants</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.promotional}
                    onCheckedChange={(val) => updateNotification('promotional', val)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI Interaction Settings
                </CardTitle>
                <CardDescription>Control how SeatFinder AI works for you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Enable Personalization</p>
                    <p className="text-sm text-slate-500">Let AI learn your preferences over time</p>
                  </div>
                  <Switch
                    checked={preferences.ai_settings.enable_personalization}
                    onCheckedChange={(val) => updateAISetting('enable_personalization', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Use Dining History</p>
                    <p className="text-sm text-slate-500">Include past visits in recommendations</p>
                  </div>
                  <Switch
                    checked={preferences.ai_settings.use_dining_history}
                    onCheckedChange={(val) => updateAISetting('use_dining_history', val)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Show Confidence Scores</p>
                    <p className="text-sm text-slate-500">Display AI confidence levels in suggestions</p>
                  </div>
                  <Switch
                    checked={preferences.ai_settings.show_confidence_scores}
                    onCheckedChange={(val) => updateAISetting('show_confidence_scores', val)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-purple-900 mb-1">AI Privacy</h3>
                    <p className="text-sm text-purple-700">
                      Your data is used only to improve your experience. We never share your preferences 
                      with third parties. You can reset your AI learning data at any time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
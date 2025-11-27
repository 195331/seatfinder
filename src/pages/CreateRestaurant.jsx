import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Store, MapPin, Phone, Globe, DollarSign,
  Utensils, Upload, Check, Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const CUISINES = [
  "Italian", "Japanese", "Mexican", "Chinese", "Indian", "Thai", 
  "American", "Mediterranean", "Korean", "French", "Vietnamese", 
  "Seafood", "Steakhouse", "Pizza", "Sushi", "BBQ", "Vegetarian", "Cafe"
];

export default function CreateRestaurant() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    neighborhood: '',
    city_id: '',
    latitude: '',
    longitude: '',
    phone: '',
    website: '',
    menu_url: '',
    cuisine: '',
    price_level: 2,
    total_seats: 40,
    has_outdoor: false,
    has_bar_seating: false,
    is_kid_friendly: false,
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
        // Update user type if needed
        if (user.user_type !== 'owner' && user.user_type !== 'admin') {
          await base44.auth.updateMe({ user_type: 'owner' });
        }
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.filter({ is_active: true }),
  });

  const createRestaurantMutation = useMutation({
    mutationFn: async () => {
      const slug = formData.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const restaurant = await base44.entities.Restaurant.create({
        ...formData,
        slug,
        owner_id: currentUser.id,
        available_seats: formData.total_seats,
        status: 'pending',
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      });

      // Create default areas
      await base44.entities.RestaurantArea.create({
        restaurant_id: restaurant.id,
        name: 'Main Dining',
        max_seats: formData.total_seats,
        available_seats: formData.total_seats,
        is_open: true,
        sort_order: 0
      });

      return restaurant;
    },
    onSuccess: (restaurant) => {
      navigate(createPageUrl('OwnerDashboard'));
    }
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStep1Valid = formData.name && formData.address && formData.city_id && formData.cuisine;
  const isStep2Valid = formData.total_seats > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
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
              <h1 className="font-bold text-lg text-slate-900">Add Restaurant</h1>
              <p className="text-sm text-slate-500">Step {step} of 2</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex gap-2">
          <div className={cn(
            "h-1 flex-1 rounded-full",
            step >= 1 ? "bg-emerald-500" : "bg-slate-200"
          )} />
          <div className={cn(
            "h-1 flex-1 rounded-full",
            step >= 2 ? "bg-emerald-500" : "bg-slate-200"
          )} />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {step === 1 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="name">Restaurant Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Tony's Italian Kitchen"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Select 
                  value={formData.city_id} 
                  onValueChange={(v) => updateField('city_id', v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}, {city.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="address">Full Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main St, Jersey City, NJ 07302"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="neighborhood">Neighborhood</Label>
                <Input
                  id="neighborhood"
                  value={formData.neighborhood}
                  onChange={(e) => updateField('neighborhood', e.target.value)}
                  placeholder="e.g., Downtown, Hoboken"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => updateField('latitude', e.target.value)}
                    placeholder="40.7178"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => updateField('longitude', e.target.value)}
                    placeholder="-74.0431"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cuisine">Cuisine Type *</Label>
                <Select 
                  value={formData.cuisine} 
                  onValueChange={(v) => updateField('cuisine', v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select cuisine" />
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
                <Label>Price Level *</Label>
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
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+1 (201) 555-0123"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://yourrestaurant.com"
                  className="mt-1.5"
                />
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="w-full h-12 rounded-full text-base"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Seating & Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="total_seats">Total Seats *</Label>
                <Input
                  id="total_seats"
                  type="number"
                  value={formData.total_seats}
                  onChange={(e) => updateField('total_seats', parseInt(e.target.value) || 0)}
                  className="mt-1.5"
                />
                <p className="text-sm text-slate-500 mt-1">
                  You can add specific areas later (Main Dining, Bar, Patio)
                </p>
              </div>

              <div className="space-y-4">
                <Label>Features</Label>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium">Outdoor Seating</p>
                    <p className="text-sm text-slate-500">Patio, sidewalk, or rooftop</p>
                  </div>
                  <Switch
                    checked={formData.has_outdoor}
                    onCheckedChange={(checked) => updateField('has_outdoor', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium">Bar Seating</p>
                    <p className="text-sm text-slate-500">Seats at the bar area</p>
                  </div>
                  <Switch
                    checked={formData.has_bar_seating}
                    onCheckedChange={(checked) => updateField('has_bar_seating', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium">Kid Friendly</p>
                    <p className="text-sm text-slate-500">Suitable for families with children</p>
                  </div>
                  <Switch
                    checked={formData.is_kid_friendly}
                    onCheckedChange={(checked) => updateField('is_kid_friendly', checked)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 rounded-full"
                >
                  Back
                </Button>
                <Button
                  onClick={() => createRestaurantMutation.mutate()}
                  disabled={!isStep2Valid || createRestaurantMutation.isPending}
                  className="flex-1 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {createRestaurantMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Create Restaurant
                    </>
                  )}
                </Button>
              </div>

              <p className="text-sm text-slate-500 text-center">
                Your restaurant will be reviewed before appearing in search results
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
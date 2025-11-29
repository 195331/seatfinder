import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Store, Check, Loader2, Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import FloorPlanEditor from '@/components/floorplan/FloorPlanEditor';
import ImageUploader from '@/components/owner/ImageUploader';
import OpeningHoursEditor from '@/components/owner/OpeningHoursEditor';

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
    phone: '',
    website: '',
    cuisine: '',
    price_level: 2,
    has_outdoor: false,
    has_bar_seating: false,
    is_kid_friendly: false,
    cover_image: '',
    opening_hours: {},
  });

  const [floorPlanData, setFloorPlanData] = useState({
    areas: [],
    tables: []
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
      
      const totalSeats = floorPlanData.tables.reduce((sum, t) => sum + t.seats, 0);
      
      const restaurant = await base44.entities.Restaurant.create({
        ...formData,
        slug,
        owner_id: currentUser.id,
        total_seats: totalSeats,
        available_seats: totalSeats,
        status: 'pending',
        floor_plan_data: floorPlanData, // Store floor plan data
      });

      // Create areas
      const areaIdMap = {};
      for (const area of floorPlanData.areas) {
        const areaSeats = floorPlanData.tables
          .filter(t => t.areaId === area.id)
          .reduce((sum, t) => sum + t.seats, 0);
        
        const newArea = await base44.entities.RestaurantArea.create({
          restaurant_id: restaurant.id,
          name: area.name,
          max_seats: areaSeats,
          available_seats: areaSeats,
          is_open: true,
          sort_order: floorPlanData.areas.indexOf(area)
        });
        areaIdMap[area.id] = newArea.id;
      }

      // Create tables
      for (const table of floorPlanData.tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          area_id: areaIdMap[table.areaId] || null,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape
        });
      }

      return restaurant;
    },
    onSuccess: () => {
      toast.success("Restaurant created! It will be reviewed shortly.");
      navigate(createPageUrl('OwnerDashboard'));
    },
    onError: (error) => {
      toast.error("Failed to create restaurant: " + error.message);
    }
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStep1Valid = formData.name && formData.address && formData.city_id && formData.cuisine;
  const isStep2Valid = floorPlanData.tables.length > 0;

  const handlePublish = () => {
    if (!isStep2Valid) {
      toast.error("Please add at least one table to your floor plan");
      return;
    }
    createRestaurantMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => step === 1 ? navigate(-1) : setStep(1)}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg text-slate-900">
                  {step === 1 ? "Restaurant Details" : "Design Floor Plan"}
                </h1>
                <p className="text-sm text-slate-500">Step {step} of 2</p>
              </div>
            </div>
            
            {step === 2 && (
              <Button
                onClick={handlePublish}
                disabled={!isStep2Valid || createRestaurantMutation.isPending}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {createRestaurantMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Publish Restaurant
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-2">
          <div className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            step >= 1 ? "bg-emerald-500" : "bg-slate-200"
          )} />
          <div className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            step >= 2 ? "bg-emerald-500" : "bg-slate-200"
          )} />
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <main className="max-w-2xl mx-auto px-4 py-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Cover Image */}
              <div>
                <Label className="mb-2 block">Cover Image</Label>
                <ImageUploader
                  currentImage={formData.cover_image}
                  onImageUploaded={(url) => updateField('cover_image', url)}
                  placeholder="Upload restaurant cover photo"
                />
              </div>

              <div>
                <Label>Restaurant Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Tony's Italian Kitchen"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>City *</Label>
                <Select value={formData.city_id} onValueChange={(v) => updateField('city_id', v)}>
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
                <Label>Full Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main St, Jersey City, NJ 07302"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Neighborhood</Label>
                <Input
                  value={formData.neighborhood}
                  onChange={(e) => updateField('neighborhood', e.target.value)}
                  placeholder="e.g., Downtown"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cuisine Type *</Label>
                  <Select value={formData.cuisine} onValueChange={(v) => updateField('cuisine', v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      {CUISINES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
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
                          "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+1 (201) 555-0123"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Features */}
              <div className="pt-2 space-y-3">
                <Label className="text-base">Features</Label>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">Outdoor Seating</p>
                    <p className="text-xs text-slate-500">Patio or sidewalk seating</p>
                  </div>
                  <Switch
                    checked={formData.has_outdoor}
                    onCheckedChange={(checked) => updateField('has_outdoor', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">Bar Seating</p>
                    <p className="text-xs text-slate-500">Seats at bar area</p>
                  </div>
                  <Switch
                    checked={formData.has_bar_seating}
                    onCheckedChange={(checked) => updateField('has_bar_seating', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">Kid Friendly</p>
                    <p className="text-xs text-slate-500">Family-friendly environment</p>
                  </div>
                  <Switch
                    checked={formData.is_kid_friendly}
                    onCheckedChange={(checked) => updateField('is_kid_friendly', checked)}
                  />
                </div>
              </div>

              {/* Opening Hours */}
              <div className="pt-2 space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Opening Hours
                </Label>
                <OpeningHoursEditor
                  hours={formData.opening_hours}
                  onChange={(hours) => updateField('opening_hours', hours)}
                />
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="w-full h-12 rounded-full text-base bg-emerald-600 hover:bg-emerald-700"
              >
                Continue to Floor Plan
              </Button>
            </CardContent>
          </Card>
        </main>
      )}

      {/* Step 2: Floor Plan */}
      {step === 2 && (
        <FloorPlanEditor
          data={floorPlanData}
          onChange={setFloorPlanData}
          restaurantName={formData.name}
        />
      )}
    </div>
  );
}
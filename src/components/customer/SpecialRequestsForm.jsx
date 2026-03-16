import React from 'react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Single source of truth for all dietary options across the app
export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut Allergy',
  'Shellfish Allergy',
  'Fish Allergy',
  'Egg Allergy',
  'Soy Allergy',
  'Kosher',
  'Halal',
  'Low-Sodium',
  'Diabetic-Friendly',
  'Pescatarian',
  'Keto',
  'Mediterranean',
  'Fruitarian',
  'Jain',
];

const OCCASIONS = [
  { value: 'none', label: 'Regular Dining' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'anniversary', label: '💑 Anniversary' },
  { value: 'business', label: '💼 Business Meeting' },
  { value: 'date', label: '💕 Romantic Date' },
  { value: 'celebration', label: '🎉 Celebration' }
];

const LEGACY_DIETARY_MAP = { 'Nut-Free': 'Nut Allergy', 'Tree-Nut-Free': 'Nut Allergy' };

export default function SpecialRequestsForm({ 
  specialRequests, 
  dietaryNeeds = [],
  occasion = 'none',
  onSpecialRequestsChange,
  onDietaryNeedsChange,
  onOccasionChange,
  showAITip = false
}) {
  // Normalize any legacy dietary values (e.g. "Nut-Free" → "Nut Allergy")
  const normalizedNeeds = dietaryNeeds
    .map(d => LEGACY_DIETARY_MAP[d] || d)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const toggleDietaryNeed = (need) => {
    const updated = normalizedNeeds.includes(need)
      ? normalizedNeeds.filter(n => n !== need)
      : [...normalizedNeeds, need];
    onDietaryNeedsChange(updated);
  };

  return (
    <div className="space-y-4">
      {showAITip && (
        <Alert className="bg-purple-50 border-purple-200">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-purple-800 text-sm">
            <strong>Pro tip:</strong> Sharing dietary needs and preferences helps the restaurant prepare better for your visit
          </AlertDescription>
        </Alert>
      )}

      {/* Occasion */}
      <div>
        <Label className="mb-2 block">Occasion (Optional)</Label>
        <Select value={occasion} onValueChange={onOccasionChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select occasion" />
          </SelectTrigger>
          <SelectContent>
            {OCCASIONS.map((occ) => (
              <SelectItem key={occ.value} value={occ.value}>
                {occ.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {occasion !== 'none' && (
          <p className="text-xs text-slate-500 mt-1.5">
            The restaurant may add a special touch for your {OCCASIONS.find(o => o.value === occasion)?.label.replace(/[^\w\s]/g, '')}
          </p>
        )}
      </div>

      {/* Dietary Needs */}
      <div>
        <Label className="mb-2 block">Dietary Needs & Allergies</Label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Checkbox
                checked={dietaryNeeds.includes(option)}
                onCheckedChange={() => toggleDietaryNeed(option)}
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
        {dietaryNeeds.filter(n => n !== 'Nut-Free').length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {dietaryNeeds
              .filter(n => n !== 'Nut-Free')
              .map((need) => (
                <Badge key={need} variant="secondary">{need}</Badge>
              ))}
          </div>
        )}
      </div>

      {/* Special Requests */}
      <div>
        <Label className="mb-2 block">Special Requests</Label>
        <Textarea
          value={specialRequests}
          onChange={(e) => onSpecialRequestsChange(e.target.value)}
          placeholder="Window seat, quiet corner, high chair needed, wheelchair accessible table, etc."
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Any seating preferences, accessibility needs, or special arrangements
        </p>
      </div>
    </div>
  );
}
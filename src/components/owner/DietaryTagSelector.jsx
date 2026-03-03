import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'vegan', label: 'Vegan', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'gluten-free', label: 'Gluten-Free', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'dairy-free', label: 'Dairy-Free', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  { value: 'nut-allergy', label: 'Nut Allergy', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'shellfish-allergy', label: 'Shellfish Allergy', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'fish-allergy', label: 'Fish Allergy', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'egg-allergy', label: 'Egg Allergy', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'soy-allergy', label: 'Soy Allergy', color: 'bg-lime-100 text-lime-700 border-lime-300' },
  { value: 'kosher', label: 'Kosher', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { value: 'halal', label: 'Halal', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { value: 'low-sodium', label: 'Low-Sodium', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  { value: 'diabetic-friendly', label: 'Diabetic-Friendly', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'pescatarian', label: 'Pescatarian', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'keto', label: 'Keto', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'mediterranean', label: 'Mediterranean', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { value: 'fruitarian', label: 'Fruitarian', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { value: 'jain', label: 'Jain', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
];

const TAG_VALUES = DIETARY_TAGS.map(t => t.value);

export default function DietaryTagSelector({ selectedTags = [], onChange, dishName = '', description = '' }) {
  const [isAutoTagging, setIsAutoTagging] = useState(false);

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const autoTag = async () => {
    if (!dishName.trim()) {
      toast.error('Please enter a dish name first');
      return;
    }
    setIsAutoTagging(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this dish and suggest applicable dietary tags.
Dish name: "${dishName}"
Description: "${description || 'No description provided'}"

Return ONLY the applicable tags from this exact list: ${TAG_VALUES.join(', ')}.
Be conservative — only include a tag if you are confident it applies based on the dish name and description.`,
        response_json_schema: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } }
          }
        }
      });
      const suggested = (result.tags || []).filter(t => TAG_VALUES.includes(t));
      onChange(suggested);
      toast.success(`Auto-tagged with ${suggested.length} tag(s)`);
    } catch (e) {
      toast.error('Auto-tag failed, please try again');
    }
    setIsAutoTagging(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Dietary Tags</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={autoTag}
          disabled={isAutoTagging}
          className="h-7 text-xs gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          {isAutoTagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI Auto-Tag
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {DIETARY_TAGS.map(tag => (
          <button
            key={tag.value}
            type="button"
            onClick={() => toggleTag(tag.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all",
              selectedTags.includes(tag.value)
                ? tag.color + " shadow-sm"
                : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            {selectedTags.includes(tag.value) && <span className="mr-1">✓</span>}
            {tag.label}
          </button>
        ))}
      </div>
      {selectedTags.length > 0 && (
        <p className="text-xs text-slate-500">{selectedTags.length} tag(s) selected</p>
      )}
    </div>
  );
}
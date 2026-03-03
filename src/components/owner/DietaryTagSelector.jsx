import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'vegan', label: 'Vegan', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'pescatarian', label: 'Pescatarian', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'keto', label: 'Keto', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'jain', label: 'Jain', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'gluten-free', label: 'Gluten-Free', color: 'bg-amber-100 text-amber-700 border-amber-300' },
];

export { DIETARY_TAGS };

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

Return ONLY the applicable tags from this exact list: vegetarian, vegan, pescatarian, keto, jain, gluten-free.
Be conservative — only include a tag if you are confident it applies.`,
        response_json_schema: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } }
          }
        }
      });
      const suggested = (result.tags || []).filter(t => DIETARY_TAGS.map(d => d.value).includes(t));
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
    </div>
  );
}
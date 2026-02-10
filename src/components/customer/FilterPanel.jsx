import React, { useState } from 'react';
import { X, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CUISINES = [
  "Italian", "Japanese", "Mexican", "Chinese", "Indian", "Thai", 
  "American", "Mediterranean", "Korean", "French", "Vietnamese", "Seafood"
];

const SEATING_LEVELS = [
  { value: "chill", label: "🟢 Chill", maxOccupancy: 60 },
  { value: "moderate", label: "🟡 Moderate", maxOccupancy: 85 },
  { value: "any", label: "Any", maxOccupancy: 100 }
];

export default function FilterPanel({ open, onOpenChange, filters, onFiltersChange, presets, activePreset, onPresetSelect }) {
  
  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).filter(k => {
    const v = filters[k];
    return v && (Array.isArray(v) ? v.length > 0 : true);
  }).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">Filters</SheetTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          </SheetHeader>
          
          <div className="py-6 space-y-8 overflow-y-auto h-[calc(100%-8rem)]">
            {/* Price Level */}
            <div>
              <h3 className="font-medium text-slate-900 mb-3">Price</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    onClick={() => updateFilter('priceLevel', filters.priceLevel === level ? null : level)}
                    className={cn(
                      "px-4 py-2 rounded-full border transition-all",
                      filters.priceLevel === level
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {'$'.repeat(level)}
                  </button>
                ))}
              </div>
            </div>

            {/* Seating Level */}
            <div>
              <h3 className="font-medium text-slate-900 mb-3">Seating Availability</h3>
              <div className="flex flex-wrap gap-2">
                {SEATING_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => updateFilter('seatingLevel', filters.seatingLevel === level.value ? null : level.value)}
                    className={cn(
                      "px-4 py-2 rounded-full border transition-all",
                      filters.seatingLevel === level.value
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuisine */}
            <div>
              <h3 className="font-medium text-slate-900 mb-3">Cuisine</h3>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((cuisine) => (
                  <button
                    key={cuisine}
                    onClick={() => toggleArrayFilter('cuisines', cuisine)}
                    className={cn(
                      "px-4 py-2 rounded-full border transition-all",
                      (filters.cuisines || []).includes(cuisine)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="font-medium text-slate-900 mb-3">Vibe & Features</h3>
              <div className="space-y-3">
                {[
                  { key: 'isKidFriendly', label: 'Kid-friendly' },
                  { key: 'hasOutdoor', label: 'Outdoor seating' },
                  { key: 'hasBarSeating', label: 'Good for groups' },
                  { key: 'openNow', label: 'Open now' }
                ].map((feature) => (
                  <label 
                    key={feature.key}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div 
                      onClick={() => updateFilter(feature.key, !filters[feature.key])}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        filters[feature.key]
                          ? "bg-slate-900 border-slate-900"
                          : "bg-white border-slate-300"
                      )}
                    >
                      {filters[feature.key] && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-slate-700">{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
            <Button 
              className="w-full rounded-full h-12 text-base"
              onClick={() => onOpenChange(false)}
            >
              Show Results
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Presets */}
      {presets?.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onPresetSelect(preset)}
          className={cn(
            "px-4 py-2 rounded-full border whitespace-nowrap transition-all",
            activePreset?.id === preset.id
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          )}
        >
          {preset.icon} {preset.name}
        </button>
      ))}
    </>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { Leaf, Wheat, Star } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'vegan', label: 'Vegan', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'pescatarian', label: 'Pescatarian', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'keto', label: 'Keto', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'jain', label: 'Jain', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'gluten-free', label: 'Gluten-Free', color: 'bg-amber-100 text-amber-700 border-amber-300' },
];

const TAG_COLOR_MAP = Object.fromEntries(DIETARY_TAGS.map(t => [t.value, t.color]));

function getFilteredMenu(items, selectedFilters) {
  if (selectedFilters.length === 0) return items.map(i => ({ ...i, _matches: true }));
  return items.map(item => {
    const tags = item.dietary_tags || [];
    const matches = selectedFilters.every(f => tags.includes(f));
    return { ...item, _matches: matches };
  });
}

export default function MenuView({ items = [], restaurantName, highlightItemId }) {
  const categories = [...new Set(items.map(i => i.category || 'Other'))];
  const [activeCategory, setActiveCategory] = useState(categories[0] || 'All');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const highlightRef = useRef(null);

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (!highlightItemId) return;
    const targetItem = items.find(i => i.id === highlightItemId);
    if (targetItem) {
      // Switch to the item's category
      setActiveCategory(targetItem.category || categories[0]);
      // Scroll after a brief delay for category switch to render
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [highlightItemId, items]);

  const toggleFilter = (tag) => {
    setSelectedFilters(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const categoryItems = activeCategory === 'All'
    ? items
    : items.filter(i => i.category === activeCategory);

  const filteredItems = getFilteredMenu(categoryItems, selectedFilters);

  const matchCount = filteredItems.filter(i => i._matches).length;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Menu not available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dietary Preferences Filter Bar */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dietary Preferences</p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map(tag => {
            const active = selectedFilters.includes(tag.value);
            return (
              <button
                key={tag.value}
                onClick={() => toggleFilter(tag.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  active
                    ? tag.color + " shadow-sm scale-105"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {active && <span className="mr-1">✓</span>}
                {tag.label}
              </button>
            );
          })}
          {selectedFilters.length > 0 && (
            <button
              onClick={() => setSelectedFilters([])}
              className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white text-red-500 border-red-200 hover:bg-red-50 transition-all"
            >
              Clear
            </button>
          )}
        </div>
        {selectedFilters.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {matchCount} item{matchCount !== 1 ? 's' : ''} match your preferences
          </p>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeCategory === cat
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "relative flex gap-4 p-3 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all",
              selectedFilters.length > 0 && !item._matches && "opacity-50"
            )}
          >
            {/* Match / No-match badge overlay */}
            {selectedFilters.length > 0 && (
              <div className="absolute top-2 right-2 z-10">
                {item._matches ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">
                    ✓ Match
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    Does not match
                  </span>
                )}
              </div>
            )}

            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-20 h-20 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 pr-16">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                    {item.name}
                    {item.is_popular && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                        <Star className="w-2.5 h-2.5 mr-0.5" /> Popular
                      </Badge>
                    )}
                  </h4>
                  {/* Dietary Tags */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.is_vegetarian && (
                      <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                        <Leaf className="w-2.5 h-2.5 mr-0.5" /> Veg
                      </Badge>
                    )}
                    {item.is_vegan && (
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">Vegan</Badge>
                    )}
                    {item.is_gluten_free && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                        <Wheat className="w-2.5 h-2.5 mr-0.5" /> GF
                      </Badge>
                    )}
                    {(item.dietary_tags || []).map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn("text-[10px]", TAG_COLOR_MAP[tag] || "bg-slate-100 text-slate-600 border-slate-200")}
                      >
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="font-semibold text-slate-900 shrink-0">${item.price?.toFixed(2)}</span>
              </div>
              {item.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              )}
              {item.calories && (
                <p className="text-xs text-slate-400 mt-1">{item.calories} cal</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
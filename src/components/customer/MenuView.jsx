import React, { useState } from 'react';
import { Leaf, Wheat, Star, Info } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function MenuView({ items = [], restaurantName }) {
  const categories = [...new Set(items.map(i => i.category || 'Other'))];
  const [activeCategory, setActiveCategory] = useState(categories[0] || 'All');

  const filteredItems = activeCategory === 'All' 
    ? items 
    : items.filter(i => i.category === activeCategory);

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Menu not available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            className="flex gap-4 p-3 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all"
          >
            {item.image_url && (
              <img 
                src={item.image_url} 
                alt={item.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    {item.name}
                    {item.is_popular && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                        <Star className="w-2.5 h-2.5 mr-0.5" /> Popular
                      </Badge>
                    )}
                  </h4>
                  <div className="flex gap-1.5 mt-1">
                    {item.is_vegetarian && (
                      <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                        <Leaf className="w-2.5 h-2.5 mr-0.5" /> Veg
                      </Badge>
                    )}
                    {item.is_vegan && (
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">
                        Vegan
                      </Badge>
                    )}
                    {item.is_gluten_free && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                        <Wheat className="w-2.5 h-2.5 mr-0.5" /> GF
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="font-semibold text-slate-900">${item.price?.toFixed(2)}</span>
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
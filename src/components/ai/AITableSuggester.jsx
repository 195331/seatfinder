import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Star, MapPin, Volume2, Eye, Loader2, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AITableSuggester({ 
  tables, 
  areas, 
  partySize, 
  preferences,
  onSelectTable,
  selectedTableId 
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateSuggestions = async () => {
      setLoading(true);
      
      // Filter available tables that fit the party
      const availableTables = tables.filter(t => 
        t.status === 'free' && t.capacity >= partySize
      );

      if (availableTables.length === 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // Score each table based on various factors
      const scoredTables = availableTables.map(table => {
        let score = 100;
        let reasons = [];

        // Capacity efficiency (prefer tables that fit well)
        const wastedSeats = table.capacity - partySize;
        if (wastedSeats === 0) {
          score += 20;
          reasons.push('Perfect size for your party');
        } else if (wastedSeats <= 2) {
          score += 10;
          reasons.push('Great fit for your group');
        } else {
          score -= wastedSeats * 5;
        }

        // Find the area this table belongs to
        const area = areas.find(a => a.id === table.areaId || a.id === table.area_id);
        
        // Preference matching
        if (preferences) {
          if (preferences.includes('quiet') || preferences.includes('corner')) {
            // Prefer tables at edges (higher x or y positions)
            if (table.x > 300 || table.y > 250) {
              score += 15;
              reasons.push('Quiet corner location');
            }
          }
          
          if (preferences.includes('view') || preferences.includes('window')) {
            // Prefer tables near edges (simulating window seats)
            if (table.x < 100 || table.y < 100) {
              score += 15;
              reasons.push('Near window/view area');
            }
          }
          
          if (preferences.includes('bar') && area?.name?.toLowerCase().includes('bar')) {
            score += 20;
            reasons.push('Bar area seating');
          }
          
          if (preferences.includes('outdoor') || preferences.includes('patio')) {
            if (area?.name?.toLowerCase().includes('outdoor') || 
                area?.name?.toLowerCase().includes('patio')) {
              score += 25;
              reasons.push('Outdoor seating');
            }
          }
          
          if (preferences.includes('private') || preferences.includes('romantic')) {
            if (table.capacity <= 4 && (table.x > 300 || table.y > 250)) {
              score += 15;
              reasons.push('Private setting');
            }
          }
        }

        // Table shape preference for party size
        if (partySize <= 2 && table.shape === 'round') {
          score += 5;
          reasons.push('Intimate round table');
        }
        if (partySize >= 6 && table.shape === 'rectangle') {
          score += 5;
          reasons.push('Spacious rectangular table');
        }

        // Area bonus
        if (area) {
          reasons.push(`${area.name} area`);
        }

        return {
          ...table,
          score,
          reasons: reasons.slice(0, 3),
          areaName: area?.name
        };
      });

      // Sort by score and take top 3
      const topSuggestions = scoredTables
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setSuggestions(topSuggestions);
      setLoading(false);
    };

    generateSuggestions();
  }, [tables, areas, partySize, preferences]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Finding best tables...</span>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <p className="text-sm">No available tables for your party size</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-indigo-700">AI Suggested Tables</span>
      </div>

      {suggestions.map((table, index) => (
        <button
          key={table.id}
          onClick={() => onSelectTable(table)}
          className={cn(
            "w-full p-4 rounded-xl border-2 transition-all text-left",
            selectedTableId === table.id
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                index === 0 
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" 
                  : "bg-slate-100 text-slate-600"
              )}>
                {index === 0 ? <Star className="w-5 h-5" /> : index + 1}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Table {table.label}</span>
                  {index === 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">Best Match</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {table.capacity} seats • {table.areaName || 'Main area'}
                </p>
              </div>
            </div>
            
            {selectedTableId === table.id && (
              <Check className="w-5 h-5 text-indigo-600" />
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {table.reasons.map((reason, i) => (
              <Badge 
                key={i} 
                variant="outline" 
                className="text-xs bg-white border-slate-200 text-slate-600"
              >
                {reason}
              </Badge>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
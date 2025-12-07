import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, DollarSign, TrendingUp, TrendingDown, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AIDynamicPricing({ restaurantId }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['seatingHistory', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 500),
    enabled: !!restaurantId
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 300),
    enabled: !!restaurantId
  });

  const { data: waitlistHistory = [] } = useQuery({
    queryKey: ['waitlistHistory', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date', 200),
    enabled: !!restaurantId
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => base44.entities.MenuItem.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId
  });

  const analyzePricing = async () => {
    setAnalyzing(true);
    
    try {
      // Analyze demand by hour
      const hourlyDemand = {};
      seatingHistory.forEach(h => {
        const hour = new Date(h.recorded_at).getHours();
        const day = new Date(h.recorded_at).getDay();
        const key = `${day}-${hour}`;
        if (!hourlyDemand[key]) hourlyDemand[key] = [];
        hourlyDemand[key].push(h.occupancy_percent || 0);
      });

      const demandPatterns = Object.entries(hourlyDemand)
        .map(([key, values]) => ({
          timeSlot: key,
          avgOccupancy: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          samples: values.length
        }))
        .sort((a, b) => b.avgOccupancy - a.avgOccupancy);

      // Popular items analysis
      const popularItems = menuItems
        .filter(i => i.is_popular)
        .map(i => ({ name: i.name, price: i.price }));

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `As a revenue optimization AI, analyze this restaurant data and suggest dynamic pricing strategies:

Historical Data:
- ${seatingHistory.length} seating records
- ${reservations.length} reservations
- ${waitlistHistory.length} waitlist entries
- ${menuItems.length} menu items

Demand Patterns (Top 5):
${demandPatterns.slice(0, 5).map(d => `- ${d.timeSlot}: ${d.avgOccupancy}% occupancy (${d.samples} samples)`).join('\n')}

Popular Items:
${popularItems.slice(0, 5).map(i => `- ${i.name}: $${i.price}`).join('\n')}

Provide:
1. Time-based pricing adjustments (peak vs off-peak)
2. Menu item pricing optimization
3. Revenue maximization strategies
4. Demand management tactics`,
        response_json_schema: {
          type: "object",
          properties: {
            peak_hours: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time_slot: { type: "string" },
                  current_demand: { type: "string" },
                  suggested_adjustment: { type: "string" },
                  expected_revenue_change: { type: "string" }
                }
              }
            },
            menu_pricing: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_category: { type: "string" },
                  current_strategy: { type: "string" },
                  suggested_change: { type: "string" },
                  rationale: { type: "string" }
                }
              }
            },
            off_peak_strategies: {
              type: "array",
              items: { type: "string" }
            },
            expected_revenue_impact: { type: "string" },
            key_insights: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setSuggestions({
        ...response,
        demandPatterns: demandPatterns.slice(0, 8)
      });

    } catch (error) {
      toast.error('Failed to analyze pricing');
    }
    
    setAnalyzing(false);
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          AI Dynamic Pricing
          <Badge className="bg-emerald-100 text-emerald-700 ml-2">Revenue</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!suggestions ? (
          <div className="text-center py-6">
            <DollarSign className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Optimize Your Pricing</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              AI analyzes {seatingHistory.length} data points to suggest optimal pricing strategies for maximum revenue.
            </p>
            <Button
              onClick={analyzePricing}
              disabled={analyzing || seatingHistory.length < 50}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Data...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Analyze Pricing
                </>
              )}
            </Button>
            {seatingHistory.length < 50 && (
              <p className="text-xs text-amber-600 mt-3 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Need at least 50 data points for accurate analysis
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Revenue Impact */}
            <div className="p-4 bg-white rounded-xl border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Expected Revenue Impact</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {suggestions.expected_revenue_impact}
                  </p>
                </div>
              </div>
            </div>

            {/* Peak Hours Pricing */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time-Based Pricing
              </h4>
              <div className="space-y-2">
                {suggestions.peak_hours?.slice(0, 4).map((slot, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{slot.time_slot}</span>
                        <Badge variant="outline" className="text-xs">
                          {slot.current_demand}
                        </Badge>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        slot.suggested_adjustment.includes('increase') ? "text-emerald-600" : "text-blue-600"
                      )}>
                        {slot.suggested_adjustment.includes('increase') ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {slot.suggested_adjustment}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">
                      Impact: {slot.expected_revenue_change}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Menu Pricing */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Menu Item Strategies</h4>
              <div className="space-y-2">
                {suggestions.menu_pricing?.map((item, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">{item.item_category}</span>
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                        {item.suggested_change}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">
                      Current: {item.current_strategy}
                    </p>
                    <p className="text-xs text-slate-600">{item.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Off-Peak Strategies */}
            {suggestions.off_peak_strategies?.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-xl">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Off-Peak Strategies</h4>
                <ul className="space-y-1.5">
                  {suggestions.off_peak_strategies.map((strategy, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                      <span className="text-blue-400">•</span>
                      {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Insights */}
            {suggestions.key_insights?.length > 0 && (
              <div className="p-4 bg-purple-50 rounded-xl">
                <h4 className="text-sm font-medium text-purple-900 mb-2">Key Insights</h4>
                <ul className="space-y-1.5">
                  {suggestions.key_insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-purple-700">
                      <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setSuggestions(null)}
              className="w-full"
            >
              Run New Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, Users, LayoutGrid, Loader2, Check, RefreshCw, ArrowRight, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AIFloorPlanOptimizer({ restaurantId, currentLayout, onApplySuggestion }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const analyzeAndSuggest = async () => {
    setAnalyzing(true);
    
    try {
      // Fetch historical data
      const [seatingHistory, waitlistHistory, reservations] = await Promise.all([
        base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 300),
        base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date', 200),
        base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 200)
      ]);

      // Analyze party size distribution
      const partySizes = {};
      waitlistHistory.forEach(w => {
        const size = w.party_size || 2;
        partySizes[size] = (partySizes[size] || 0) + 1;
      });
      reservations.forEach(r => {
        const size = r.party_size || 2;
        partySizes[size] = (partySizes[size] || 0) + 1;
      });

      const totalParties = Object.values(partySizes).reduce((a, b) => a + b, 0);
      const partyDistribution = Object.entries(partySizes)
        .map(([size, count]) => ({
          size: parseInt(size),
          count,
          percentage: Math.round((count / totalParties) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate peak hour patterns
      const hourlyData = {};
      seatingHistory.forEach(h => {
        const hour = new Date(h.recorded_at).getHours();
        if (!hourlyData[hour]) hourlyData[hour] = [];
        hourlyData[hour].push(h.occupancy_percent || 0);
      });

      const peakHours = Object.entries(hourlyData)
        .map(([hour, values]) => ({
          hour: parseInt(hour),
          avgOccupancy: Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        }))
        .sort((a, b) => b.avgOccupancy - a.avgOccupancy)
        .slice(0, 3);

      // Current layout analysis
      const currentTables = currentLayout?.tables || [];
      const currentTableSizes = {};
      currentTables.forEach(t => {
        const capacity = t.seats || t.capacity || 4;
        currentTableSizes[capacity] = (currentTableSizes[capacity] || 0) + 1;
      });

      // Generate recommendations using AI
      const prompt = `Analyze this restaurant data and suggest optimal table configuration:

Current Tables: ${JSON.stringify(currentTableSizes)}
Party Size Distribution: ${JSON.stringify(partyDistribution)}
Peak Hours: ${JSON.stringify(peakHours)}
Total Historical Parties: ${totalParties}

Provide recommendations for optimal table layout to maximize seating efficiency.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            efficiency_score: { type: "number", description: "Current efficiency 0-100" },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  impact: { type: "string" },
                  table_changes: {
                    type: "object",
                    properties: {
                      add_2_seat: { type: "number" },
                      add_4_seat: { type: "number" },
                      add_6_seat: { type: "number" },
                      remove_2_seat: { type: "number" },
                      remove_4_seat: { type: "number" },
                      remove_6_seat: { type: "number" }
                    }
                  }
                }
              }
            },
            optimal_distribution: {
              type: "object",
              properties: {
                two_seat: { type: "number" },
                four_seat: { type: "number" },
                six_seat: { type: "number" },
                large: { type: "number" }
              }
            },
            insights: { type: "array", items: { type: "string" } }
          }
        }
      });

      // Calculate potential efficiency gain
      const currentTotal = Object.values(currentTableSizes).reduce((a, b) => a + b, 0);
      const optimalTotal = Object.values(aiResponse.optimal_distribution || {}).reduce((a, b) => a + b, 0);
      const potentialScore = Math.min(100, (aiResponse.efficiency_score || 70) + 15);

      setSuggestions({
        ...aiResponse,
        partyDistribution,
        peakHours,
        currentLayout: currentTableSizes,
        potentialScore,
        currentTables: currentTables
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze layout');
    }
    
    setAnalyzing(false);
  };

  // Simple floor plan visualization
  const FloorPlanPreview = ({ tables, title, isOptimized }) => {
    const tableColors = {
      2: '#3b82f6',
      4: '#10b981',
      6: '#f59e0b',
      8: '#ef4444'
    };

    return (
      <div className={cn(
        "p-3 rounded-xl border",
        isOptimized ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
      )}>
        <p className="text-xs font-medium text-slate-600 mb-2">{title}</p>
        <div className="relative bg-white rounded-lg h-32 overflow-hidden">
          <svg width="100%" height="100%" viewBox="0 0 200 100">
            {Object.entries(tables).map(([size, count], groupIndex) => {
              const tableSize = parseInt(size);
              const color = tableColors[tableSize] || '#6b7280';
              
              return Array.from({ length: count }).map((_, i) => {
                const row = Math.floor((groupIndex * count + i) / 5);
                const col = (groupIndex * count + i) % 5;
                const x = 20 + col * 35;
                const y = 15 + row * 40;
                
                return (
                  <g key={`${size}-${i}`}>
                    <rect
                      x={x}
                      y={y}
                      width={tableSize <= 2 ? 20 : tableSize <= 4 ? 25 : 30}
                      height={tableSize <= 2 ? 20 : 25}
                      fill={color}
                      rx={tableSize <= 2 ? 10 : 4}
                      opacity={0.8}
                    />
                    <text
                      x={x + (tableSize <= 2 ? 10 : tableSize <= 4 ? 12.5 : 15)}
                      y={y + (tableSize <= 2 ? 12 : 15)}
                      textAnchor="middle"
                      fill="white"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {size}
                    </text>
                  </g>
                );
              });
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(tables).map(([size, count]) => (
            <Badge 
              key={size} 
              variant="secondary" 
              className="text-xs"
              style={{ backgroundColor: `${tableColors[parseInt(size)] || '#6b7280'}20` }}
            >
              {count}× {size}-seat
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          AI Floor Plan Optimizer
          <Badge className="bg-violet-100 text-violet-700 ml-2">Beta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!suggestions ? (
          <div className="text-center py-6">
            <LayoutGrid className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Optimize Your Layout</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              AI analyzes your historical data, party sizes, and peak hours to suggest the optimal table configuration.
            </p>
            <Button
              onClick={analyzeAndSuggest}
              disabled={analyzing}
              className="gap-2 bg-violet-600 hover:bg-violet-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Data...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze & Suggest
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Efficiency Score Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Current Efficiency</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-700">
                    {suggestions.efficiency_score || 72}
                  </span>
                  <span className="text-lg text-slate-400 mb-1">/100</span>
                </div>
                <Progress value={suggestions.efficiency_score || 72} className="h-2 mt-2" />
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-xs text-emerald-600 mb-1">Potential Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-emerald-600">
                    {suggestions.potentialScore || 87}
                  </span>
                  <span className="text-lg text-emerald-400 mb-1">/100</span>
                </div>
                <Progress value={suggestions.potentialScore || 87} className="h-2 mt-2 bg-emerald-100" />
              </div>
            </div>

            {/* Before/After Floor Plan Comparison */}
            <Tabs defaultValue="comparison" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="comparison" className="flex-1">Before & After</TabsTrigger>
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="comparison" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <FloorPlanPreview 
                    tables={suggestions.currentLayout || {}} 
                    title="Current Layout"
                    isOptimized={false}
                  />
                  <FloorPlanPreview 
                    tables={{
                      2: suggestions.optimal_distribution?.two_seat || 0,
                      4: suggestions.optimal_distribution?.four_seat || 0,
                      6: suggestions.optimal_distribution?.six_seat || 0,
                      8: suggestions.optimal_distribution?.large || 0
                    }} 
                    title="Optimized Layout"
                    isOptimized={true}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="mt-4 space-y-4">

                {/* Party Size Analysis */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Party Size Distribution
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {suggestions.partyDistribution?.slice(0, 4).map(({ size, percentage }) => (
                      <div key={size} className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-bold text-slate-900">{percentage}%</div>
                        <div className="text-xs text-slate-500">{size} guests</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimal Distribution */}
                {suggestions.optimal_distribution && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Suggested Table Distribution
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="text-lg font-bold text-emerald-700">
                          {suggestions.optimal_distribution.two_seat || 0}
                        </div>
                        <div className="text-xs text-emerald-600">2-seat</div>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="text-lg font-bold text-emerald-700">
                          {suggestions.optimal_distribution.four_seat || 0}
                        </div>
                        <div className="text-xs text-emerald-600">4-seat</div>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="text-lg font-bold text-emerald-700">
                          {suggestions.optimal_distribution.six_seat || 0}
                        </div>
                        <div className="text-xs text-emerald-600">6-seat</div>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="text-lg font-bold text-emerald-700">
                          {suggestions.optimal_distribution.large || 0}
                        </div>
                        <div className="text-xs text-emerald-600">Large</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Recommendations */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                AI Recommendations
              </h4>
              <div className="space-y-3">
                {suggestions.recommendations?.map((rec, index) => (
                  <div key={index} className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-violet-600">{index + 1}</span>
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-900">{rec.title}</h5>
                        <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
                        {rec.impact && (
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            Expected Impact: {rec.impact}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            {suggestions.insights?.length > 0 && (
              <div className="p-4 bg-indigo-50 rounded-xl">
                <h4 className="text-sm font-medium text-indigo-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Key Insights
                </h4>
                <ul className="space-y-2">
                  {suggestions.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-indigo-700">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setSuggestions(null)}
              className="w-full gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Run New Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
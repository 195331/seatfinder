import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, TrendingUp, TrendingDown, Sparkles, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";
import { format, subDays, differenceInMinutes } from 'date-fns';

export default function TableTurnoverTracker({ restaurantId }) {
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const { data: waitlistHistory = [] } = useQuery({
    queryKey: ['turnoverWaitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurantId, 
      status: 'seated' 
    }, '-seated_at', 200),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['turnoverReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurantId, 
      status: 'approved' 
    }, '-created_date', 200),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['turnoverTables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  // Calculate turnover metrics
  const calculateTurnover = () => {
    if (tables.length === 0) return { daily: 0, avgDuration: 0, trend: [] };

    // Calculate average seating duration from waitlist
    const durations = waitlistHistory
      .filter(w => w.seated_at && w.created_date)
      .map(w => differenceInMinutes(new Date(w.seated_at), new Date(w.created_date)));
    
    const avgWaitTime = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 45;

    // Estimate average dining duration (typically 45-90 min)
    const avgDiningTime = 60; // minutes
    
    // Calculate daily turnover (tables * operating hours / avg dining time)
    const operatingHours = 12; // hours
    const turnsPerTable = (operatingHours * 60) / (avgDiningTime + avgWaitTime / 2);
    const dailyTurnover = Math.round(tables.length * turnsPerTable * 10) / 10;

    // Generate trend data for last 7 days
    const trend = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayWaitlist = waitlistHistory.filter(w => 
        w.seated_at && format(new Date(w.seated_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      return {
        day: format(date, 'EEE'),
        turnover: dayWaitlist.length / Math.max(tables.length, 1),
        seats: dayWaitlist.reduce((sum, w) => sum + (w.party_size || 2), 0)
      };
    });

    return {
      daily: dailyTurnover,
      avgDuration: Math.round(avgDiningTime + avgWaitTime / 4),
      avgWaitTime: Math.round(avgWaitTime),
      trend
    };
  };

  const metrics = calculateTurnover();
  const industryAvg = 2.5; // Industry average turns per table
  const performanceRatio = metrics.daily / industryAvg;

  const generateAISuggestions = async () => {
    setLoadingAI(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `As a restaurant operations expert, analyze these table turnover metrics and provide 3-4 specific, actionable suggestions to improve table turnover rate:

Current metrics:
- Daily table turns: ${metrics.daily} (industry avg: ${industryAvg})
- Average dining duration: ${metrics.avgDuration} minutes
- Average wait time: ${metrics.avgWaitTime} minutes
- Number of tables: ${tables.length}

Provide suggestions in JSON format with title and description for each.`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  impact: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      });
      setAISuggestions(result.suggestions);
      setShowAISuggestions(true);
    } catch (e) {
      console.error('AI error:', e);
    }
    setLoadingAI(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Table Turnover Rate
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateAISuggestions}
            disabled={loadingAI}
            className="gap-2"
          >
            {loadingAI ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI Tips
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <p className="text-2xl font-bold text-blue-900">{metrics.daily}</p>
            <p className="text-xs text-blue-600">Turns/Table/Day</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{metrics.avgDuration}m</p>
            <p className="text-xs text-slate-500">Avg Duration</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl">
            <p className="text-2xl font-bold text-amber-900">{metrics.avgWaitTime}m</p>
            <p className="text-xs text-amber-600">Avg Wait</p>
          </div>
        </div>

        {/* Performance vs Industry */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Performance vs Industry Avg</span>
            <span className={cn(
              "font-medium flex items-center gap-1",
              performanceRatio >= 1 ? "text-emerald-600" : "text-amber-600"
            )}>
              {performanceRatio >= 1 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.round(performanceRatio * 100)}%
            </span>
          </div>
          <Progress value={Math.min(performanceRatio * 50, 100)} className="h-2" />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0</span>
            <span>Industry Avg ({industryAvg})</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-40 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} />
              <Tooltip 
                formatter={(value) => [value.toFixed(1), 'Turns']}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="turnover" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI Suggestions */}
        {showAISuggestions && aiSuggestions && (
          <div className="space-y-2 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Suggestions for Improvement
            </div>
            {aiSuggestions.map((suggestion, idx) => (
              <div key={idx} className="p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-purple-900">{suggestion.title}</span>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    suggestion.impact === 'high' && "border-red-200 text-red-700",
                    suggestion.impact === 'medium' && "border-amber-200 text-amber-700",
                    suggestion.impact === 'low' && "border-green-200 text-green-700"
                  )}>
                    {suggestion.impact} impact
                  </Badge>
                </div>
                <p className="text-xs text-purple-700">{suggestion.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
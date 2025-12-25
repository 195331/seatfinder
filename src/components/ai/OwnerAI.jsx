import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Loader2, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function OwnerAI({ restaurant, onAction }) {
  const [timeRange, setTimeRange] = useState('90_days');
  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState(null);

  const cutoffDate = timeRange === 'all_time' 
    ? moment().subtract(10, 'years')
    : moment().subtract(90, 'days');

  // Fetch comprehensive data
  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['seatingHistory', restaurant.id, timeRange],
    queryFn: () => base44.entities.SeatingHistory.filter({ 
      restaurant_id: restaurant.id 
    }, '-recorded_at', 1000),
    enabled: !!restaurant,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['waitlist', restaurant.id, timeRange],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurant.id 
    }, '-created_date', 500),
    enabled: !!restaurant,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurant.id, timeRange],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurant.id 
    }, '-created_date', 1000),
    enabled: !!restaurant,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', restaurant.id, timeRange],
    queryFn: () => base44.entities.Review.filter({ 
      restaurant_id: restaurant.id,
      is_hidden: false 
    }),
    enabled: !!restaurant,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', restaurant.id, timeRange],
    queryFn: () => base44.entities.AnalyticsEvent.filter({ 
      restaurant_id: restaurant.id 
    }, '-created_date', 500),
    enabled: !!restaurant,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurant.id],
    queryFn: () => base44.entities.Table.filter({ 
      restaurant_id: restaurant.id 
    }),
    enabled: !!restaurant,
  });

  const filteredSeating = seatingHistory.filter(s => moment(s.recorded_at).isAfter(cutoffDate));
  const filteredWaitlist = waitlist.filter(w => moment(w.created_date).isAfter(cutoffDate));
  const filteredReservations = reservations.filter(r => moment(r.created_date).isAfter(cutoffDate));
  const filteredReviews = reviews.filter(r => moment(r.created_date).isAfter(cutoffDate));
  const filteredEvents = events.filter(e => moment(e.created_date).isAfter(cutoffDate));

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      // Calculate metrics
      const avgOccupancy = filteredSeating.length > 0
        ? filteredSeating.reduce((sum, s) => sum + (s.occupancy_percent || 0), 0) / filteredSeating.length
        : 0;

      const peakHours = {};
      filteredReservations.forEach(r => {
        const hour = r.reservation_time?.split(':')[0];
        if (hour) peakHours[hour] = (peakHours[hour] || 0) + 1;
      });

      const partySizes = {};
      filteredReservations.forEach(r => {
        const size = r.party_size || 2;
        partySizes[size] = (partySizes[size] || 0) + 1;
      });

      const updateFrequency = filteredSeating.length > 0
        ? filteredSeating.length / 90
        : 0;

      const context = {
        restaurant: {
          name: restaurant.name,
          total_seats: restaurant.total_seats,
          available_seats: restaurant.available_seats,
          reliability_score: restaurant.reliability_score,
          average_rating: restaurant.average_rating,
          review_count: restaurant.review_count,
          floor_plan: restaurant.floor_plan_data,
          last_update: restaurant.seating_updated_at
        },
        metrics: {
          time_range: timeRange,
          seating_updates: filteredSeating.length,
          avg_occupancy: avgOccupancy.toFixed(1),
          waitlist_entries: filteredWaitlist.length,
          waitlist_conversion: filteredWaitlist.length > 0
            ? ((filteredWaitlist.filter(w => w.status === 'seated').length / filteredWaitlist.length) * 100).toFixed(1)
            : 0,
          total_reservations: filteredReservations.length,
          approval_rate: filteredReservations.length > 0
            ? ((filteredReservations.filter(r => r.status === 'approved').length / filteredReservations.length) * 100).toFixed(1)
            : 0,
          avg_rating: filteredReviews.length > 0
            ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length).toFixed(1)
            : 0,
          review_count: filteredReviews.length,
          views: filteredEvents.filter(e => e.event_type === 'view').length,
          clicks: filteredEvents.filter(e => ['call_click', 'directions_click', 'website_click'].includes(e.event_type)).length,
          peak_hours: peakHours,
          party_size_distribution: partySizes,
          update_frequency: updateFrequency.toFixed(1)
        },
        tables: tables.map(t => ({
          label: t.label,
          capacity: t.capacity,
          status: t.status
        }))
      };

      // Check for missing data
      const missingData = [];
      if (filteredSeating.length < 10) missingData.push('seating history (need at least 10 updates)');
      if (filteredReservations.length < 5) missingData.push('reservations (need at least 5)');
      if (filteredReviews.length < 3) missingData.push('reviews (need at least 3)');
      if (tables.length === 0) missingData.push('floor plan/tables');

      if (missingData.length > 2) {
        setInsights({
          insufficient_data: true,
          missing: missingData,
          message: `Not enough data yet. To get AI insights, you need: ${missingData.join(', ')}.`
        });
        setIsGenerating(false);
        return;
      }

      const prompt = `You are SeatFinder Owner AI, providing actionable business insights to restaurant owners.

Restaurant Data: ${JSON.stringify(context, null, 2)}

Analyze the data and provide:
1. Key Opportunities (2-3 actionable recommendations with HIGH confidence)
2. Potential Issues (1-2 concerns that need attention)
3. Performance Summary (strengths and areas for improvement)
4. Quick Wins (immediate actions they can take today)

CRITICAL RULES:
- Only use data from the provided context
- If data is insufficient for a specific insight, say "Limited data available for X"
- Provide SPECIFIC numbers and percentages from the data
- Focus on ACTIONABLE recommendations
- Consider reliability_score when making update-related suggestions
- Analyze peak_hours and party_size_distribution for optimization opportunities
- If floor_plan is missing, suggest creating one
- Rate confidence as High/Medium/Low based on data quality

Return JSON:
{
  "confidence": "High|Medium|Low",
  "opportunities": [
    {
      "title": "Optimize table configuration",
      "description": "Based on 60% of parties being size 2, consider adding more 2-tops",
      "impact": "High",
      "effort": "Medium",
      "data_source": "90 reservations analyzed"
    }
  ],
  "issues": [
    {
      "title": "Infrequent seating updates",
      "severity": "High",
      "description": "Only 1.2 updates per day affects reliability score",
      "recommended_action": "Enable shift mode for automatic updates"
    }
  ],
  "summary": {
    "strengths": ["High approval rate (92%)", "Strong reviews (4.5★)"],
    "improvements": ["Update frequency", "Waitlist conversion"]
  },
  "quick_wins": [
    "Enable instant confirm for parties of 2 during off-peak hours",
    "Set up automated SMS for waitlist notifications"
  ]
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            confidence: { type: 'string' },
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  impact: { type: 'string' },
                  effort: { type: 'string' },
                  data_source: { type: 'string' }
                }
              }
            },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  severity: { type: 'string' },
                  description: { type: 'string' },
                  recommended_action: { type: 'string' }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                strengths: { type: 'array', items: { type: 'string' } },
                improvements: { type: 'array', items: { type: 'string' } }
              }
            },
            quick_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      setInsights({
        ...response,
        generated_at: new Date().toISOString(),
        data_points: {
          seating: filteredSeating.length,
          reservations: filteredReservations.length,
          reviews: filteredReviews.length,
          events: filteredEvents.length
        }
      });

    } catch (error) {
      toast.error('Failed to generate insights');
      console.error(error);
    }
    setIsGenerating(false);
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      High: 'bg-green-100 text-green-800',
      Medium: 'bg-amber-100 text-amber-800',
      Low: 'bg-slate-100 text-slate-700'
    };
    return colors[confidence] || colors.Medium;
  };

  const getImpactBadge = (impact) => {
    const colors = {
      High: 'bg-purple-100 text-purple-800',
      Medium: 'bg-blue-100 text-blue-800',
      Low: 'bg-slate-100 text-slate-600'
    };
    return colors[impact] || colors.Medium;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Owner AI Insights
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                AI-powered recommendations based on your real data
              </p>
            </div>
            <Tabs value={timeRange} onValueChange={setTimeRange}>
              <TabsList>
                <TabsTrigger value="90_days">90 Days</TabsTrigger>
                <TabsTrigger value="all_time">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {!insights ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Generate AI Insights</h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Get personalized recommendations to optimize your operations, improve customer satisfaction, and boost revenue
              </p>
              <Button
                onClick={generateInsights}
                disabled={isGenerating}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Your Data...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
          ) : insights.insufficient_data ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Not Enough Data Yet</h3>
              <p className="text-slate-600 mb-4">{insights.message}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="font-medium text-amber-900 mb-2">What you need:</p>
                <ul className="text-sm text-amber-800 space-y-1 text-left">
                  {insights.missing.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Confidence Badge */}
              <div className="flex items-center justify-between">
                <Badge className={cn("text-sm", getConfidenceBadge(insights.confidence))}>
                  {insights.confidence} Confidence
                </Badge>
                <div className="text-xs text-slate-500">
                  Based on {insights.data_points.seating} updates, {insights.data_points.reservations} reservations, {insights.data_points.reviews} reviews
                </div>
              </div>

              {/* Quick Wins */}
              {insights.quick_wins?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Quick Wins - Act Today
                  </h4>
                  <ul className="space-y-2">
                    {insights.quick_wins.map((win, i) => (
                      <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        {win}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Opportunities */}
              {insights.opportunities?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Growth Opportunities
                  </h4>
                  <div className="space-y-3">
                    {insights.opportunities.map((opp, i) => (
                      <div key={i} className="bg-white border-2 border-purple-100 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-slate-900">{opp.title}</h5>
                          <div className="flex gap-2">
                            <Badge className={getImpactBadge(opp.impact)} variant="outline">
                              {opp.impact} Impact
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {opp.effort} Effort
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{opp.description}</p>
                        <p className="text-xs text-slate-500">{opp.data_source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {insights.issues?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Issues to Address
                  </h4>
                  <div className="space-y-3">
                    {insights.issues.map((issue, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-slate-900">{issue.title}</h5>
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            issue.severity === 'High' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'
                          )}>
                            {issue.severity} Priority
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                        <p className="text-sm font-medium text-amber-900">
                          → {issue.recommended_action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h5 className="font-semibold text-green-900 mb-2">Strengths</h5>
                  <ul className="space-y-1">
                    {insights.summary.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-600">✓</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h5 className="font-semibold text-blue-900 mb-2">Areas to Improve</h5>
                  <ul className="space-y-1">
                    {insights.summary.improvements.map((improvement, i) => (
                      <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                        <span className="text-blue-600">→</span>
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Generated {moment(insights.generated_at).fromNow()} • {timeRange === '90_days' ? 'Last 90 days' : 'All time'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateInsights}
                  disabled={isGenerating}
                >
                  Refresh Insights
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, TrendingUp, Sparkles, Loader2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from "@/lib/utils";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function CustomerLifetimeValue({ restaurantId }) {
  const [aiAnalysis, setAIAnalysis] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const { data: loyaltyMembers = [] } = useQuery({
    queryKey: ['clvLoyalty', restaurantId],
    queryFn: () => base44.entities.CustomerLoyalty.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['clvReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'approved' }),
    enabled: !!restaurantId,
  });

  // Calculate CLV metrics
  const calculateCLV = () => {
    if (loyaltyMembers.length === 0) {
      return {
        avgCLV: 0,
        avgVisits: 0,
        avgSpend: 0,
        segments: [],
        topFactors: []
      };
    }

    const totalSpent = loyaltyMembers.reduce((sum, m) => sum + (m.total_spent || 0), 0);
    const totalVisits = loyaltyMembers.reduce((sum, m) => sum + (m.visits || 0), 0);
    const avgSpendPerVisit = totalVisits > 0 ? totalSpent / totalVisits : 50;
    const avgVisitsPerCustomer = loyaltyMembers.length > 0 ? totalVisits / loyaltyMembers.length : 0;
    
    // Estimate customer lifespan (years)
    const avgLifespan = 2.5;
    const visitsPerYear = avgVisitsPerCustomer * 4; // Quarterly estimate
    const avgCLV = avgSpendPerVisit * visitsPerYear * avgLifespan;

    // Segment customers
    const segments = [
      { name: 'High Value', count: loyaltyMembers.filter(m => (m.total_spent || 0) > avgSpendPerVisit * 10).length, color: COLORS[0] },
      { name: 'Regular', count: loyaltyMembers.filter(m => (m.visits || 0) >= 5 && (m.total_spent || 0) <= avgSpendPerVisit * 10).length, color: COLORS[1] },
      { name: 'Occasional', count: loyaltyMembers.filter(m => (m.visits || 0) >= 2 && (m.visits || 0) < 5).length, color: COLORS[2] },
      { name: 'New', count: loyaltyMembers.filter(m => (m.visits || 0) < 2).length, color: COLORS[3] }
    ].filter(s => s.count > 0);

    return {
      avgCLV: Math.round(avgCLV),
      avgVisits: Math.round(avgVisitsPerCustomer * 10) / 10,
      avgSpend: Math.round(avgSpendPerVisit),
      totalCustomers: loyaltyMembers.length,
      segments
    };
  };

  const metrics = calculateCLV();

  const analyzeFactors = async () => {
    setLoadingAI(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `As a restaurant analytics expert, analyze these customer metrics and identify the top factors that influence Customer Lifetime Value:

Metrics:
- Average CLV: $${metrics.avgCLV}
- Average visits per customer: ${metrics.avgVisits}
- Average spend per visit: $${metrics.avgSpend}
- Total loyalty members: ${metrics.totalCustomers}
- Customer segments: ${JSON.stringify(metrics.segments)}

Provide analysis of:
1. What factors most influence CLV at this restaurant
2. How to increase CLV
3. Which segment to focus on`,
        response_json_schema: {
          type: "object",
          properties: {
            factors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  factor: { type: "string" },
                  impact: { type: "string" },
                  recommendation: { type: "string" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });
      setAIAnalysis(result);
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
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Customer Lifetime Value
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={analyzeFactors}
            disabled={loadingAI || loyaltyMembers.length === 0}
            className="gap-2"
          >
            {loadingAI ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loyaltyMembers.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>No loyalty program data yet</p>
            <p className="text-xs mt-1">Set up a loyalty program to track CLV</p>
          </div>
        ) : (
          <>
            {/* CLV Metric */}
            <div className="text-center p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white mb-6">
              <p className="text-xs opacity-80 mb-1">Average Customer Lifetime Value</p>
              <p className="text-4xl font-bold">${metrics.avgCLV.toLocaleString()}</p>
              <div className="flex justify-center gap-4 mt-3 text-sm">
                <span>{metrics.avgVisits} avg visits</span>
                <span>•</span>
                <span>${metrics.avgSpend}/visit</span>
              </div>
            </div>

            {/* Customer Segments */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.segments}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {metrics.segments.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-2">
                {metrics.segments.map((segment, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="text-sm text-slate-600">{segment.name}</span>
                    <span className="text-sm font-medium ml-auto">{segment.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            {aiAnalysis && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Factor Analysis
                </div>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">
                  {aiAnalysis.summary}
                </p>
                {aiAnalysis.factors?.map((factor, idx) => (
                  <div key={idx} className="p-3 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-sm text-purple-900">{factor.factor}</span>
                    </div>
                    <p className="text-xs text-purple-700 mb-1">{factor.impact}</p>
                    <p className="text-xs text-purple-600 italic">💡 {factor.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
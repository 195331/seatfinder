import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Users, Clock, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function AICustomerInsights({ restaurantId }) {
  const [insights, setInsights] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['customerInsights', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['insightsReviews', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: preOrders = [] } = useQuery({
    queryKey: ['insightsOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      // Peak time analysis
      const hourCounts = {};
      reservations.forEach(r => {
        const hour = parseInt(r.reservation_time?.split(':')[0] || 12);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      // Day of week analysis
      const dayCounts = {};
      reservations.forEach(r => {
        const day = moment(r.reservation_date).format('dddd');
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      // Customer behavior patterns
      const repeatCustomers = {};
      reservations.forEach(r => {
        repeatCustomers[r.user_id] = (repeatCustomers[r.user_id] || 0) + 1;
      });
      const loyalCustomers = Object.values(repeatCustomers).filter(count => count >= 3).length;

      // Popular menu items from pre-orders
      const itemPopularity = {};
      preOrders.forEach(order => {
        order.items?.forEach(item => {
          itemPopularity[item.name] = (itemPopularity[item.name] || 0) + (item.quantity || 1);
        });
      });
      const topItems = Object.entries(itemPopularity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name} (${count} orders)`);

      const prompt = `Analyze this restaurant data and provide actionable insights:

**Peak Dining Hours:**
${Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h, c]) => `${h}:00 - ${c} reservations`).join('\n')}

**Busiest Days:**
${Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c} reservations`).join('\n')}

**Customer Stats:**
- Total Reservations: ${reservations.length}
- Unique Customers: ${Object.keys(repeatCustomers).length}
- Loyal Customers (3+ visits): ${loyalCustomers}
- Average Party Size: ${(reservations.reduce((s, r) => s + (r.party_size || 0), 0) / reservations.length).toFixed(1)}

**Top Menu Items:**
${topItems.join('\n')}

**Review Stats:**
- Total Reviews: ${reviews.length}
- Average Rating: ${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}

Provide insights on:
1. **Customer Behavior** - patterns, preferences, and segmentation
2. **Peak Times** - detailed analysis with optimization suggestions
3. **Sales Forecast** - predict next 30 days based on trends
4. **Popular Items** - why they're successful and cross-sell opportunities

Return JSON:
{
  "behavior": [{"pattern": "description", "insight": "actionable tip", "priority": "high|medium|low"}],
  "peak_times": [{"time": "period", "volume": "description", "staffing": "recommendation", "strategy": "tip"}],
  "forecast": {"next_7_days": "prediction", "next_30_days": "prediction", "confidence": "high|medium|low", "factors": ["factor1", "factor2"]},
  "popular_items": [{"item": "name", "success_factor": "why", "opportunity": "upsell suggestion"}]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            behavior: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pattern: { type: "string" },
                  insight: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            peak_times: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string" },
                  volume: { type: "string" },
                  staffing: { type: "string" },
                  strategy: { type: "string" }
                }
              }
            },
            forecast: {
              type: "object",
              properties: {
                next_7_days: { type: "string" },
                next_30_days: { type: "string" },
                confidence: { type: "string" },
                factors: { type: "array", items: { type: "string" } }
              }
            },
            popular_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  success_factor: { type: "string" },
                  opportunity: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setInsights(data);
    }
  });

  // Prepare chart data
  const hourlyData = React.useMemo(() => {
    const counts = {};
    reservations.forEach(r => {
      const hour = parseInt(r.reservation_time?.split(':')[0] || 12);
      counts[hour] = (counts[hour] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [reservations]);

  const priorityColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-700'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              AI Customer Insights & Forecasting
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Advanced analytics powered by AI
            </p>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hourly Chart */}
        {hourlyData.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 mb-3">Peak Hours Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {insights ? (
          <div className="space-y-6">
            {/* Customer Behavior */}
            {insights.behavior?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Customer Behavior Patterns
                </h4>
                <div className="space-y-2">
                  {insights.behavior.map((item, idx) => (
                    <div key={idx} className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{item.pattern}</span>
                        <Badge className={priorityColors[item.priority]}>
                          {item.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{item.insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peak Times */}
            {insights.peak_times?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Peak Time Analysis
                </h4>
                <div className="space-y-2">
                  {insights.peak_times.map((peak, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-slate-900">{peak.time}</span>
                        <Badge className="bg-blue-600 text-white">{peak.volume}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="p-2 bg-white rounded">
                          <span className="text-slate-600">Staffing: </span>
                          <span className="text-slate-900">{peak.staffing}</span>
                        </div>
                        <p className="text-slate-700">{peak.strategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales Forecast */}
            {insights.forecast && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Sales Forecast
                </h4>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-semibold text-slate-900">Predictions</h5>
                    <Badge className="bg-emerald-600 text-white">
                      {insights.forecast.confidence} confidence
                    </Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mb-3">
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Next 7 Days</p>
                      <p className="font-medium text-slate-900">{insights.forecast.next_7_days}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Next 30 Days</p>
                      <p className="font-medium text-slate-900">{insights.forecast.next_30_days}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Key Factors:</p>
                    <div className="flex flex-wrap gap-1">
                      {insights.forecast.factors?.map((factor, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Popular Items */}
            {insights.popular_items?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  Popular Menu Items Analysis
                </h4>
                <div className="space-y-2">
                  {insights.popular_items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <h5 className="font-medium text-slate-900 mb-2">{item.item}</h5>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-slate-600">Success Factor: </span>
                          <span className="text-slate-900">{item.success_factor}</span>
                        </div>
                        <div className="p-2 bg-white rounded border border-amber-200">
                          <span className="text-slate-600">Opportunity: </span>
                          <span className="text-emerald-700 font-medium">{item.opportunity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Generate Insights" to get AI-powered customer analytics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
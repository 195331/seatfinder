import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, Users, TrendingUp, ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function AITableOptimizer({ restaurantId }) {
  const [suggestions, setSuggestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 200),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['seatingHistory', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 100),
    enabled: !!restaurantId,
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const today = moment().format('YYYY-MM-DD');
      const todayReservations = reservations.filter(r => 
        r.reservation_date === today && r.status === 'approved'
      );

      // Calculate avg turnover time from completed reservations
      const completedReservations = reservations.filter(r => r.status === 'approved');
      const avgTurnoverMinutes = 75; // Default estimate

      // Peak hours analysis
      const hourCounts = {};
      todayReservations.forEach(r => {
        const hour = parseInt(r.reservation_time?.split(':')[0] || 12);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour);

      // Table utilization
      const tableUtilization = tables.map(t => {
        const reservationsForTable = todayReservations.filter(r => r.table_id === t.id);
        return {
          tableId: t.id,
          label: t.label,
          capacity: t.capacity,
          reservationCount: reservationsForTable.length,
          utilization: (reservationsForTable.length * avgTurnoverMinutes) / (14 * 60) * 100 // Assume 14 hour day
        };
      });

      const prompt = `You are a restaurant operations AI. Analyze this data and provide specific, actionable suggestions:

RESTAURANT DATA:
- Total Tables: ${tables.length}
- Today's Reservations: ${todayReservations.length}
- Peak Hours: ${peakHours.map(h => `${h}:00`).join(', ')}
- Average Turnover: ${avgTurnoverMinutes} minutes

TABLE UTILIZATION:
${tableUtilization.map(t => `${t.label} (${t.capacity} seats): ${t.reservationCount} bookings, ${t.utilization.toFixed(0)}% utilized`).join('\n')}

PENDING RESERVATIONS:
${todayReservations.slice(0, 10).map(r => `Party of ${r.party_size} at ${r.reservation_time}, assigned to Table ${tables.find(t => t.id === r.table_id)?.label || 'TBD'}`).join('\n')}

Provide 3-5 specific suggestions covering:
1. Optimal table turnover predictions for tonight
2. Table reassignment recommendations (specific tables and reasons)
3. Capacity optimization for peak hours
4. Staffing recommendations

Format as JSON:
{
  "turnover_predictions": [{"table": "string", "estimated_turnover_minutes": number, "confidence": "high|medium|low"}],
  "reassignments": [{"current_table": "string", "suggested_table": "string", "party_size": number, "time": "string", "reason": "string"}],
  "capacity_tips": ["string"],
  "staffing_tips": ["string"]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            turnover_predictions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  table: { type: "string" },
                  estimated_turnover_minutes: { type: "number" },
                  confidence: { type: "string" }
                }
              }
            },
            reassignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  current_table: { type: "string" },
                  suggested_table: { type: "string" },
                  party_size: { type: "number" },
                  time: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            capacity_tips: { type: "array", items: { type: "string" } },
            staffing_tips: { type: "array", items: { type: "string" } }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setSuggestions(data);
    }
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateSuggestionsMutation.mutateAsync();
    } finally {
      setIsGenerating(false);
    }
  };

  const applyReassignmentMutation = useMutation({
    mutationFn: async ({ reassignment }) => {
      // Find reservation and update table
      const reservation = reservations.find(r => {
        const tableLabel = tables.find(t => t.id === r.table_id)?.label;
        return tableLabel === reassignment.current_table && r.reservation_time === reassignment.time;
      });

      if (reservation) {
        const newTable = tables.find(t => t.label === reassignment.suggested_table);
        if (newTable) {
          await base44.entities.Reservation.update(reservation.id, {
            table_id: newTable.id
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>AI Table Optimizer</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Smart suggestions for maximum efficiency</p>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || reservations.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isGenerating ? 'Analyzing...' : 'Generate Suggestions'}
          </Button>
        </div>
      </CardHeader>

      {suggestions && (
        <CardContent className="space-y-6">
          {/* Turnover Predictions */}
          {suggestions.turnover_predictions?.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Predicted Table Turnovers Tonight
              </h3>
              <div className="space-y-2">
                {suggestions.turnover_predictions.map((pred, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <span className="font-medium text-slate-900">{pred.table}</span>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Est. turnover: {pred.estimated_turnover_minutes} minutes
                      </p>
                    </div>
                    <Badge variant={pred.confidence === 'high' ? 'default' : 'secondary'}>
                      {pred.confidence} confidence
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Reassignments */}
          {suggestions.reassignments?.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Recommended Table Reassignments
              </h3>
              <div className="space-y-3">
                {suggestions.reassignments.map((reassignment, i) => (
                  <div key={i} className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{reassignment.current_table}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-emerald-600">{reassignment.suggested_table}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyReassignmentMutation.mutate({ reassignment })}
                        disabled={applyReassignmentMutation.isPending}
                        className="gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Apply
                      </Button>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      Party of {reassignment.party_size} at {reassignment.time}
                    </p>
                    <p className="text-sm text-slate-500">{reassignment.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capacity Optimization */}
          {suggestions.capacity_tips?.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                Capacity Optimization Tips
              </h3>
              <div className="space-y-2">
                {suggestions.capacity_tips.map((tip, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-amber-50 rounded-lg">
                    <span className="text-amber-600 font-semibold shrink-0">{i + 1}.</span>
                    <p className="text-sm text-slate-700">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staffing Tips */}
          {suggestions.staffing_tips?.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Staffing Recommendations
              </h3>
              <div className="space-y-2">
                {suggestions.staffing_tips.map((tip, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-purple-50 rounded-lg">
                    <span className="text-purple-600 font-semibold shrink-0">•</span>
                    <p className="text-sm text-slate-700">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}

      {!suggestions && !isGenerating && (
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Click "Generate Suggestions" to get AI-powered insights</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
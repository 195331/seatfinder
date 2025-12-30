import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, TrendingDown } from 'lucide-react';
import { toast } from "sonner";
import moment from 'moment';

export default function AIChurnPredictor({ restaurantId }) {
  const [predictions, setPredictions] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['churnReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const generatePredictionsMutation = useMutation({
    mutationFn: async () => {
      // Analyze customer activity
      const customerActivity = {};
      reservations.forEach(r => {
        if (!r.user_id) return;
        if (!customerActivity[r.user_id]) {
          customerActivity[r.user_id] = {
            user_id: r.user_id,
            name: r.user_name,
            email: r.user_email,
            visits: 0,
            lastVisit: null,
            totalSpent: 0
          };
        }
        customerActivity[r.user_id].visits++;
        const visitDate = moment(r.reservation_date);
        if (!customerActivity[r.user_id].lastVisit || visitDate.isAfter(customerActivity[r.user_id].lastVisit)) {
          customerActivity[r.user_id].lastVisit = visitDate;
        }
      });

      const customers = Object.values(customerActivity);
      const atRiskCustomers = customers.filter(c => {
        const daysSinceLastVisit = moment().diff(c.lastVisit, 'days');
        return daysSinceLastVisit > 60 && c.visits >= 2;
      });

      const prompt = `Analyze these at-risk customers and provide churn predictions:

${atRiskCustomers.slice(0, 10).map(c => 
  `- ${c.name}: ${c.visits} visits, last visit ${moment().diff(c.lastVisit, 'days')} days ago`
).join('\n')}

For each customer, provide:
1. Churn risk level (high/medium/low)
2. Key factors contributing to churn
3. Recommended retention action

Return JSON:
{
  "predictions": [
    {
      "customer_name": "name",
      "risk_level": "high",
      "days_since_visit": 90,
      "factors": ["Long absence", "Declining frequency"],
      "recommendation": "Send personalized win-back offer"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            predictions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  customer_name: { type: "string" },
                  risk_level: { type: "string" },
                  days_since_visit: { type: "number" },
                  factors: { type: "array", items: { type: "string" } },
                  recommendation: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.predictions || [];
    },
    onSuccess: (data) => {
      setPredictions(data);
      toast.success('Churn analysis complete!');
    }
  });

  const riskColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              AI Churn Prediction
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Identify customers at risk of not returning
            </p>
          </div>
          <Button
            onClick={() => generatePredictionsMutation.mutate()}
            disabled={generatePredictionsMutation.isPending}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            {generatePredictionsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Churn Risk
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {predictions ? (
          <div className="space-y-3">
            {predictions.map((pred, idx) => (
              <div key={idx} className={`p-4 border rounded-xl ${riskColors[pred.risk_level] || 'bg-slate-50'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{pred.customer_name}</h4>
                    <p className="text-sm text-slate-600">{pred.days_since_visit} days since last visit</p>
                  </div>
                  <Badge className={riskColors[pred.risk_level]}>
                    {pred.risk_level} risk
                  </Badge>
                </div>
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-700 mb-1">Factors:</p>
                  <div className="flex flex-wrap gap-1">
                    {pred.factors.map((factor, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white/50 rounded-lg">
                  <p className="text-sm font-medium text-slate-900 mb-1">💡 Recommendation:</p>
                  <p className="text-sm text-slate-700">{pred.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Analyze Churn Risk" to identify at-risk customers</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
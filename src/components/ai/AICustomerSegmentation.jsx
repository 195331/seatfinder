import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Users, Target } from 'lucide-react';
import { toast } from "sonner";

export default function AICustomerSegmentation({ restaurantId }) {
  const [segments, setSegments] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['segmentReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: preOrders = [] } = useQuery({
    queryKey: ['segmentPreOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const generateSegmentsMutation = useMutation({
    mutationFn: async () => {
      // Analyze customer spending and frequency
      const customerData = {};
      
      reservations.forEach(r => {
        if (!r.user_id) return;
        if (!customerData[r.user_id]) {
          customerData[r.user_id] = {
            name: r.user_name,
            visits: 0,
            totalSpent: 0
          };
        }
        customerData[r.user_id].visits++;
      });

      preOrders.forEach(order => {
        if (customerData[order.user_id]) {
          customerData[order.user_id].totalSpent += order.total_amount || 0;
        }
      });

      const customers = Object.values(customerData);

      const prompt = `Analyze customer data and create 4-5 meaningful segments:

Customer Summary:
- Total customers: ${customers.length}
- Avg visits per customer: ${(customers.reduce((s, c) => s + c.visits, 0) / customers.length).toFixed(1)}
- Avg spend per customer: $${(customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length).toFixed(2)}

Create segments like:
- VIP High Spenders
- Regular Loyalists  
- Occasional Diners
- At Risk (declining activity)
- New Customers

For each segment provide:
1. Name and description
2. Estimated size (% of customers)
3. Key characteristics
4. Marketing campaign suggestion

Return JSON:
{
  "segments": [
    {
      "name": "VIP High Spenders",
      "size_percent": 15,
      "characteristics": ["Visit 2+ times/month", "Spend $100+ per visit"],
      "campaign_suggestion": "Exclusive tasting menu invite",
      "target_strategy": "Maintain engagement with exclusive perks"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  size_percent: { type: "number" },
                  characteristics: { type: "array", items: { type: "string" } },
                  campaign_suggestion: { type: "string" },
                  target_strategy: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.segments || [];
    },
    onSuccess: (data) => {
      setSegments(data);
      toast.success('Segmentation complete!');
    }
  });

  const segmentColors = ['from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-red-500 to-rose-500'];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              AI Customer Segmentation
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Identify high-value segments and target marketing
            </p>
          </div>
          <Button
            onClick={() => generateSegmentsMutation.mutate()}
            disabled={generateSegmentsMutation.isPending}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {generateSegmentsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Segments
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {segments ? (
          <div className="space-y-4">
            {segments.map((segment, idx) => (
              <div key={idx} className="border rounded-xl overflow-hidden">
                <div className={`bg-gradient-to-r ${segmentColors[idx % segmentColors.length]} p-4`}>
                  <div className="flex items-center justify-between text-white">
                    <h4 className="font-bold text-lg">{segment.name}</h4>
                    <Badge className="bg-white/20 text-white border-white/30">
                      {segment.size_percent}% of customers
                    </Badge>
                  </div>
                </div>
                <div className="p-4 bg-white space-y-3">
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1">Characteristics:</p>
                    <div className="flex flex-wrap gap-1">
                      {segment.characteristics.map((char, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {char}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-700 mb-1">📧 Campaign Idea:</p>
                    <p className="text-sm text-slate-900">{segment.campaign_suggestion}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs font-medium text-purple-700 mb-1">🎯 Strategy:</p>
                    <p className="text-sm text-purple-900">{segment.target_strategy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Click "Generate Segments" to identify customer groups</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
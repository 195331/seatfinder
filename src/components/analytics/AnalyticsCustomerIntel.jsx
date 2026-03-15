import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Users, Target, AlertTriangle, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const SEGMENT_COLORS = [
  'bg-purple-50 border-purple-200',
  'bg-blue-50 border-blue-200',
  'bg-emerald-50 border-emerald-200',
  'bg-amber-50 border-amber-200',
  'bg-rose-50 border-rose-200',
];

const SEGMENT_BADGE_COLORS = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
];

const RISK_STYLES = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low: 'border-emerald-200 bg-emerald-50',
};

const RISK_BADGE = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function InsightBadge({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
      <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
      <p className="text-xs text-indigo-700 leading-relaxed">{text}</p>
    </div>
  );
}

function SegmentationCard({ restaurantId }) {
  const [segments, setSegments] = useState(null);
  const [insight, setInsight] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['analyticsSegReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });
  const { data: preOrders = [] } = useQuery({
    queryKey: ['analyticsSegPreOrders', restaurantId],
    queryFn: () => base44.entities.PreOrder.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const customerData = {};
      reservations.forEach(r => {
        if (!r.user_id) return;
        if (!customerData[r.user_id]) customerData[r.user_id] = { name: r.user_name, visits: 0, totalSpent: 0 };
        customerData[r.user_id].visits++;
      });
      preOrders.forEach(o => {
        if (customerData[o.user_id]) customerData[o.user_id].totalSpent += o.total_amount || 0;
      });
      const customers = Object.values(customerData);
      return base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer data and create 4-5 meaningful segments.

Total customers: ${customers.length}
Avg visits: ${(customers.reduce((s, c) => s + c.visits, 0) / Math.max(customers.length, 1)).toFixed(1)}
Avg spend: $${(customers.reduce((s, c) => s + c.totalSpent, 0) / Math.max(customers.length, 1)).toFixed(2)}

Return JSON with a "segments" array and a "summary_insight" string (one sentence):
{ "segments": [{ "name": "VIP High Spenders", "size_percent": 15, "characteristics": ["Visit 2+/month"], "campaign_suggestion": "Exclusive tasting invite" }], "summary_insight": "one sentence insight here" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            segments: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, size_percent: { type: 'number' }, characteristics: { type: 'array', items: { type: 'string' } }, campaign_suggestion: { type: 'string' } } } },
            summary_insight: { type: 'string' },
          },
        },
      });
    },
    onSuccess: (data) => { setSegments(data.segments || []); setInsight(data.summary_insight || null); toast.success('Segmentation complete!'); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-base">Customer Segments</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Identify high-value segments and target marketing</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {mutation.isPending ? 'Analyzing...' : 'Generate'}
        </Button>
      </CardHeader>
      <CardContent>
        {segments ? (
          <>
            <div className="space-y-2.5">
              {segments.map((seg, i) => (
                <div key={i} className={`rounded-lg border p-3 ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-slate-800">{seg.name}</p>
                    <Badge className={`text-[10px] ${SEGMENT_BADGE_COLORS[i % SEGMENT_BADGE_COLORS.length]}`}>{seg.size_percent}%</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {seg.characteristics?.map((c, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 border border-slate-200 text-slate-600">{c}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">💬 {seg.campaign_suggestion}</p>
                </div>
              ))}
            </div>
            <InsightBadge text={insight} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs text-center">
            <Users className="w-10 h-10 mb-2 opacity-40" />
            Click Generate to identify customer groups
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChurnCard({ restaurantId }) {
  const [predictions, setPredictions] = useState(null);
  const [insight, setInsight] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['analyticsChurnReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const activity = {};
      reservations.forEach(r => {
        if (!r.user_id) return;
        if (!activity[r.user_id]) activity[r.user_id] = { name: r.user_name, visits: 0, lastVisit: null };
        activity[r.user_id].visits++;
        const d = moment(r.reservation_date);
        if (!activity[r.user_id].lastVisit || d.isAfter(activity[r.user_id].lastVisit)) activity[r.user_id].lastVisit = d;
      });
      const atRisk = Object.values(activity).filter(c => moment().diff(c.lastVisit, 'days') > 60 && c.visits >= 2);
      return base44.integrations.Core.InvokeLLM({
        prompt: `Analyze at-risk customers and predict churn. Provide a "summary_insight" (e.g. "3 regulars haven't visited in 90+ days — a win-back campaign could recover them.").

Customers: ${atRisk.slice(0, 10).map(c => `${c.name}: ${c.visits} visits, ${moment().diff(c.lastVisit, 'days')} days ago`).join('; ')}

Return JSON: { "predictions": [{ "customer_name": "name", "risk_level": "high", "days_since_visit": 90, "factors": ["Long absence"], "recommendation": "Send personalized win-back offer" }], "summary_insight": "one sentence" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            predictions: { type: 'array', items: { type: 'object', properties: { customer_name: { type: 'string' }, risk_level: { type: 'string' }, days_since_visit: { type: 'number' }, factors: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } } } },
            summary_insight: { type: 'string' },
          },
        },
      });
    },
    onSuccess: (data) => { setPredictions(data.predictions || []); setInsight(data.summary_insight || null); toast.success('Churn analysis complete!'); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-base">Churn Prediction</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Spot at-risk customers before they stop returning</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {mutation.isPending ? 'Analyzing...' : 'Analyze Risk'}
        </Button>
      </CardHeader>
      <CardContent>
        {predictions ? (
          <>
            <div className="space-y-2.5">
              {predictions.map((pred, i) => (
                <div key={i} className={`rounded-lg border p-3 ${RISK_STYLES[pred.risk_level] || 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-800">{pred.customer_name}</p>
                    <Badge className={`text-[10px] ${RISK_BADGE[pred.risk_level] || ''}`}>{pred.risk_level} risk</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-1.5">{pred.days_since_visit} days since last visit</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {pred.factors?.map((f, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">{f}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">💡 {pred.recommendation}</p>
                </div>
              ))}
            </div>
            <InsightBadge text={insight} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs text-center">
            <TrendingDown className="w-10 h-10 mb-2 opacity-40" />
            Click Analyze Risk to identify at-risk customers
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsCustomerIntel({ restaurantId }) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <SegmentationCard restaurantId={restaurantId} />
      <ChurnCard restaurantId={restaurantId} />
    </div>
  );
}
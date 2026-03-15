import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Users, Target, AlertTriangle, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const SEGMENT_GRADIENTS = [
  'from-purple-500/30 to-pink-500/30 border-purple-500/30',
  'from-blue-500/30 to-cyan-500/30 border-blue-500/30',
  'from-emerald-500/30 to-teal-500/30 border-emerald-500/30',
  'from-amber-500/30 to-orange-500/30 border-amber-500/30',
  'from-red-500/30 to-rose-500/30 border-red-500/30',
];

const RISK_STYLES = {
  high: 'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
};

function GlassCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[#333] bg-[#0d0d0d]/80 backdrop-blur-sm shadow-lg shadow-black/40 ${className}`}>
      {children}
    </div>
  );
}

function AiInsightBadge({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
      <p className="text-xs text-indigo-300 leading-relaxed">{text}</p>
    </div>
  );
}

// ── Segmentation Panel ─────────────────────────────────────────────────────────
function SegmentationPanel({ restaurantId }) {
  const [segments, setSegments] = useState(null);
  const [insight, setInsight] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['ccSegReservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });
  const { data: preOrders = [] } = useQuery({
    queryKey: ['ccSegPreOrders', restaurantId],
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
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer data and create 4-5 meaningful segments.

Total customers: ${customers.length}
Avg visits: ${(customers.reduce((s, c) => s + c.visits, 0) / Math.max(customers.length, 1)).toFixed(1)}
Avg spend: $${(customers.reduce((s, c) => s + c.totalSpent, 0) / Math.max(customers.length, 1)).toFixed(2)}

Return JSON with a "segments" array and a "summary_insight" string (one sentence, e.g. "Loyal customers are up 10%. Consider a VIP email blast."):
{
  "segments": [{ "name": "VIP High Spenders", "size_percent": 15, "characteristics": ["Visit 2+/month"], "campaign_suggestion": "Exclusive tasting invite" }],
  "summary_insight": "one sentence insight here"
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  size_percent: { type: 'number' },
                  characteristics: { type: 'array', items: { type: 'string' } },
                  campaign_suggestion: { type: 'string' },
                }
              }
            },
            summary_insight: { type: 'string' }
          }
        }
      });
      return result;
    },
    onSuccess: (data) => {
      setSegments(data.segments || []);
      setInsight(data.summary_insight || null);
      toast.success('Segmentation complete!');
    }
  });

  return (
    <GlassCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Customer Segments</h3>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-colors"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {mutation.isPending ? 'Analyzing...' : 'Generate'}
        </button>
      </div>
      <div className="p-5">
        {segments ? (
          <>
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={i} className={`rounded-lg border bg-gradient-to-r p-3 ${SEGMENT_GRADIENTS[i % SEGMENT_GRADIENTS.length]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-white">{seg.name}</p>
                    <Badge className="bg-white/10 text-white border-white/20 text-[10px]">{seg.size_percent}%</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {seg.characteristics?.map((c, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">{c}</span>
                    ))}
                  </div>
                  <p className="text-xs text-white/70">💬 {seg.campaign_suggestion}</p>
                </div>
              ))}
            </div>
            <AiInsightBadge text={insight} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 text-xs text-center">
            <Users className="w-10 h-10 mb-2 opacity-30" />
            Click Generate to identify customer groups
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ── Churn Panel ────────────────────────────────────────────────────────────────
function ChurnPanel({ restaurantId }) {
  const [predictions, setPredictions] = useState(null);
  const [insight, setInsight] = useState(null);

  const { data: reservations = [] } = useQuery({
    queryKey: ['ccChurnReservations', restaurantId],
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

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze at-risk customers and predict churn. Also provide a one-sentence "summary_insight" (e.g. "3 regulars haven't visited in 90+ days — a win-back campaign could recover them.").

Customers: ${atRisk.slice(0, 10).map(c => `${c.name}: ${c.visits} visits, ${moment().diff(c.lastVisit, 'days')} days ago`).join('; ')}

Return JSON:
{
  "predictions": [{ "customer_name": "name", "risk_level": "high", "days_since_visit": 90, "factors": ["Long absence"], "recommendation": "Send personalized win-back offer" }],
  "summary_insight": "one sentence insight"
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            predictions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  customer_name: { type: 'string' },
                  risk_level: { type: 'string' },
                  days_since_visit: { type: 'number' },
                  factors: { type: 'array', items: { type: 'string' } },
                  recommendation: { type: 'string' }
                }
              }
            },
            summary_insight: { type: 'string' }
          }
        }
      });
      return result;
    },
    onSuccess: (data) => {
      setPredictions(data.predictions || []);
      setInsight(data.summary_insight || null);
      toast.success('Churn analysis complete!');
    }
  });

  return (
    <GlassCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Churn Prediction</h3>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-colors"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {mutation.isPending ? 'Analyzing...' : 'Analyze Risk'}
        </button>
      </div>
      <div className="p-5">
        {predictions ? (
          <>
            <div className="space-y-3">
              {predictions.map((pred, i) => (
                <div key={i} className={`rounded-lg border p-3 ${RISK_STYLES[pred.risk_level] || 'border-[#333] bg-[#111]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-white">{pred.customer_name}</p>
                    <Badge className={`${RISK_STYLES[pred.risk_level]} text-[10px] border`}>{pred.risk_level} risk</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{pred.days_since_visit} days since last visit</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {pred.factors?.map((f, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">{f}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300">💡 {pred.recommendation}</p>
                </div>
              ))}
            </div>
            <AiInsightBadge text={insight} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 text-xs text-center">
            <TrendingDown className="w-10 h-10 mb-2 opacity-30" />
            Click Analyze Risk to identify at-risk customers
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function CustomerIntelPanel({ restaurantId }) {
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <SegmentationPanel restaurantId={restaurantId} />
      <ChurnPanel restaurantId={restaurantId} />
    </div>
  );
}
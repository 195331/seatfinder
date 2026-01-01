import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, DollarSign, Users, Wine } from 'lucide-react';

export default function AIReviewSummary({ restaurantId }) {
  const [summary, setSummary] = useState(null);

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviewsForSummary', restaurantId],
    queryFn: () => base44.entities.Review.filter({ restaurant_id: restaurantId, is_hidden: false }),
    enabled: !!restaurantId,
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      if (reviews.length === 0) return null;

      const reviewTexts = reviews.slice(0, 50).map((r, i) => 
        `Review ${i + 1} (${r.rating}/5): ${r.comment || 'No comment'}`
      ).join('\n\n');

      const prompt = `Analyze these restaurant reviews and provide a comprehensive summary:

${reviewTexts}

Total Reviews: ${reviews.length}
Average Rating: ${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}/5

Provide a balanced summary covering:
1. **Food Quality** - What do people love or dislike about the food?
2. **Service** - How's the staff and service experience?
3. **Ambiance** - What's the atmosphere like?
4. **Value for Money** - Is it worth the price?
5. **Standout Dishes** - What dishes get mentioned most positively?
6. **Common Complaints** - Any recurring issues?

Return JSON:
{
  "overall_sentiment": "Positive|Mixed|Negative",
  "food_quality": {"score": 1-10, "summary": "brief text", "highlights": ["dish1", "dish2"]},
  "service": {"score": 1-10, "summary": "brief text"},
  "ambiance": {"score": 1-10, "summary": "brief text"},
  "value": {"score": 1-10, "summary": "brief text"},
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2"],
  "best_for": ["occasion1", "occasion2"]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_sentiment: { type: "string" },
            food_quality: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" },
                highlights: { type: "array", items: { type: "string" } }
              }
            },
            service: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" }
              }
            },
            ambiance: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" }
              }
            },
            value: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" }
              }
            },
            pros: { type: "array", items: { type: "string" } },
            cons: { type: "array", items: { type: "string" } },
            best_for: { type: "array", items: { type: "string" } }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setSummary(data);
    }
  });

  const sentimentColors = {
    Positive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Mixed: 'bg-amber-100 text-amber-700 border-amber-200',
    Negative: 'bg-red-100 text-red-700 border-red-200'
  };

  const ScoreBar = ({ score, label, icon: Icon }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className="text-sm font-bold text-slate-900">{score}/10</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );

  if (reviews.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Review Summary
          </CardTitle>
          <Button
            onClick={() => generateSummaryMutation.mutate()}
            disabled={generateSummaryMutation.isPending}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generateSummaryMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Summary
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-6">
            {/* Overall Sentiment */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Overall Sentiment</span>
              <Badge className={sentimentColors[summary.overall_sentiment]}>
                {summary.overall_sentiment}
              </Badge>
            </div>

            {/* Scores */}
            <div className="space-y-3">
              <ScoreBar score={summary.food_quality?.score} label="Food Quality" icon={Wine} />
              <ScoreBar score={summary.service?.score} label="Service" icon={Users} />
              <ScoreBar score={summary.ambiance?.score} label="Ambiance" icon={Sparkles} />
              <ScoreBar score={summary.value?.score} label="Value for Money" icon={DollarSign} />
            </div>

            {/* Detailed Insights */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Food Quality</h4>
                <p className="text-sm text-slate-700 mb-2">{summary.food_quality?.summary}</p>
                {summary.food_quality?.highlights?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {summary.food_quality.highlights.map((dish, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {dish}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Service</h4>
                <p className="text-sm text-slate-700">{summary.service?.summary}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Ambiance</h4>
                <p className="text-sm text-slate-700">{summary.ambiance?.summary}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Value</h4>
                <p className="text-sm text-slate-700">{summary.value?.summary}</p>
              </div>
            </div>

            {/* Pros & Cons */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                  <ThumbsUp className="w-4 h-4" />
                  What People Love
                </h4>
                <ul className="space-y-1">
                  {summary.pros?.map((pro, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                  <ThumbsDown className="w-4 h-4" />
                  Common Complaints
                </h4>
                <ul className="space-y-1">
                  {summary.cons?.map((con, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">✗</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Best For */}
            {summary.best_for?.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Best For</h4>
                <div className="flex flex-wrap gap-2">
                  {summary.best_for.map((occasion, i) => (
                    <Badge key={i} className="bg-purple-100 text-purple-700">
                      {occasion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="mb-2">Based on {reviews.length} reviews</p>
            <p className="text-sm">Click "Generate Summary" for AI-powered insights</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function AIReviewAnalyzer({ restaurantId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  const analyzeReviews = async () => {
    setLoading(true);
    try {
      const reviews = await base44.entities.Review.filter({ 
        restaurant_id: restaurantId,
        is_hidden: false 
      }, '-created_date', 50);

      if (reviews.length < 3) {
        setAnalysis({ insufficient: true, count: reviews.length });
        setLoading(false);
        return;
      }

      // Gather all review comments
      const comments = reviews
        .filter(r => r.comment && r.comment.length > 10)
        .map(r => ({ rating: r.rating, comment: r.comment }));

      if (comments.length === 0) {
        setAnalysis({ noComments: true, avgRating: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length });
        setLoading(false);
        return;
      }

      // Use AI to analyze reviews
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these restaurant reviews and provide insights:

${comments.map((c, i) => `Review ${i + 1} (${c.rating}/5 stars): "${c.comment}"`).join('\n')}

Provide analysis in this exact JSON format:
{
  "overallSentiment": "positive" | "neutral" | "negative",
  "sentimentScore": number (0-100),
  "topPositives": ["string", "string", "string"],
  "topNegatives": ["string", "string", "string"],
  "commonThemes": ["string", "string", "string"],
  "actionableInsights": ["string", "string"],
  "summary": "One paragraph summary of overall customer sentiment"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            overallSentiment: { type: "string" },
            sentimentScore: { type: "number" },
            topPositives: { type: "array", items: { type: "string" } },
            topNegatives: { type: "array", items: { type: "string" } },
            commonThemes: { type: "array", items: { type: "string" } },
            actionableInsights: { type: "array", items: { type: "string" } },
            summary: { type: "string" }
          }
        }
      });

      setAnalysis({
        ...result,
        totalReviews: reviews.length,
        avgRating: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length,
        analyzedComments: comments.length
      });
    } catch (error) {
      console.error('Review analysis error:', error);
      setAnalysis({ error: true });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantId) {
      analyzeReviews();
    }
  }, [restaurantId]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-slate-500">AI is analyzing customer reviews...</p>
        </CardContent>
      </Card>
    );
  }

  if (analysis?.insufficient) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">Not enough reviews to analyze yet</p>
          <p className="text-sm text-slate-400 mt-1">Need at least 3 reviews ({analysis.count} currently)</p>
        </CardContent>
      </Card>
    );
  }

  if (analysis?.noComments) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">Reviews don't have detailed comments</p>
          <p className="text-sm text-slate-400 mt-1">Average rating: {analysis.avgRating.toFixed(1)} stars</p>
        </CardContent>
      </Card>
    );
  }

  if (analysis?.error) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 text-center">
          <p className="text-slate-500 mb-3">Unable to analyze reviews</p>
          <Button variant="outline" size="sm" onClick={analyzeReviews}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sentimentColor = {
    positive: 'text-emerald-600 bg-emerald-50',
    neutral: 'text-amber-600 bg-amber-50',
    negative: 'text-red-600 bg-red-50'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            AI Review Analysis
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={analyzeReviews}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm text-slate-500 mb-1">Overall Sentiment</p>
            <Badge className={`text-base px-3 py-1 ${sentimentColor[analysis.overallSentiment]}`}>
              {analysis.overallSentiment?.charAt(0).toUpperCase() + analysis.overallSentiment?.slice(1)}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">Sentiment Score</p>
            <div className="flex items-center gap-2">
              <Progress value={analysis.sentimentScore} className="w-24 h-2" />
              <span className="font-bold text-slate-900">{analysis.sentimentScore}%</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-sm text-indigo-800">{analysis.summary}</p>
          <p className="text-xs text-indigo-500 mt-2">
            Based on {analysis.analyzedComments} of {analysis.totalReviews} reviews
          </p>
        </div>

        {/* Positives & Negatives */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-emerald-800">What Customers Love</span>
            </div>
            <ul className="space-y-2">
              {analysis.topPositives?.map((item, i) => (
                <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-red-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-800">Areas to Improve</span>
            </div>
            <ul className="space-y-2">
              {analysis.topNegatives?.map((item, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="p-4 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-slate-900">Actionable Insights</span>
          </div>
          <ul className="space-y-2">
            {analysis.actionableInsights?.map((insight, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-indigo-500 font-medium">{i + 1}.</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {/* Common Themes */}
        <div>
          <p className="text-sm text-slate-500 mb-2">Common Themes</p>
          <div className="flex flex-wrap gap-2">
            {analysis.commonThemes?.map((theme, i) => (
              <Badge key={i} variant="outline" className="bg-white">
                {theme}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
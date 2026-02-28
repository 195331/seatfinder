import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ReviewSummary({ reviews, restaurantName, restaurantId, currentUser, expanded }) {
  const [summary, setSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = async () => {
    if (reviews.length === 0) return;
    
    setIsGenerating(true);
    try {
      const prompt = `You are an AI analyzing customer reviews for ${restaurantName}.

Reviews: ${JSON.stringify(reviews.map(r => ({
  rating: r.rating,
  comment: r.comment,
  tags: r.tags
})))}

Analyze these reviews and provide:
1. Overall sentiment summary (2-3 sentences)
2. Top 3 most praised aspects
3. Top 2-3 areas for improvement (if any)
4. Common themes mentioned
5. Recommended for (who would love this place)

Return JSON:
{
  "overall_sentiment": "Summary of what customers love",
  "top_praises": ["Aspect 1", "Aspect 2", "Aspect 3"],
  "areas_for_improvement": ["Area 1", "Area 2"],
  "common_themes": ["Theme 1", "Theme 2", "Theme 3"],
  "recommended_for": "Type of diners who would enjoy this",
  "standout_quote": "One memorable quote from reviews",
  "confidence_level": "High/Medium/Low based on review count"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_sentiment: { type: 'string' },
            top_praises: { type: 'array', items: { type: 'string' } },
            areas_for_improvement: { type: 'array', items: { type: 'string' } },
            common_themes: { type: 'array', items: { type: 'string' } },
            recommended_for: { type: 'string' },
            standout_quote: { type: 'string' },
            confidence_level: { type: 'string' }
          }
        }
      });

      setSummary(response);
    } catch (error) {
      console.error('Failed to generate review summary:', error);
    }
    setIsGenerating(false);
  };

  React.useEffect(() => {
    // Only auto-generate when there are REAL reviews with actual comments
    const reviewsWithComments = reviews?.filter(r => r.comment && r.comment.trim().length > 5) || [];
    if (reviewsWithComments.length >= 3 && !summary) {
      generateSummary();
    }
  }, [reviews]);

  // Don't show if fewer than 3 reviews with actual comments
  const reviewsWithComments = reviews?.filter(r => r.comment && r.comment.trim().length > 5) || [];
  if (reviewsWithComments.length < 3) {
    return null;
  }

  if (isGenerating) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-slate-600">AI is analyzing {reviews.length} reviews...</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Review Summary
          <Badge variant="outline" className="ml-auto text-xs">
            Based on {reviews.length} reviews • {summary.confidence_level || 'High'} confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Sentiment */}
        <div className="p-4 bg-white rounded-xl">
          <p className="text-slate-700 leading-relaxed">{summary.overall_sentiment}</p>
        </div>

        {/* Top Praises */}
        <div className="p-4 bg-white rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-4 h-4 text-green-600" />
            <h4 className="font-semibold text-slate-900">What Guests Love</h4>
          </div>
          <div className="space-y-2">
            {summary.top_praises.map((praise, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span className="text-sm text-slate-700">{praise}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Areas for Improvement */}
        {summary.areas_for_improvement.length > 0 && (
          <div className="p-4 bg-white rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <h4 className="font-semibold text-slate-900">Could Improve</h4>
            </div>
            <div className="space-y-2">
              {summary.areas_for_improvement.map((area, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span className="text-sm text-slate-700">{area}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Themes */}
        <div className="flex flex-wrap gap-2">
          {summary.common_themes.map((theme, idx) => (
            <Badge key={idx} variant="outline" className="border-indigo-300 text-indigo-700">
              {theme}
            </Badge>
          ))}
        </div>

        {/* Recommended For */}
        <div className="p-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl">
          <p className="text-sm text-indigo-900">
            <span className="font-semibold">Perfect for:</span> {summary.recommended_for}
          </p>
        </div>

        {/* Standout Quote */}
        {summary.standout_quote && (
          <div className="p-4 bg-white rounded-xl border-l-4 border-indigo-500">
            <p className="text-sm italic text-slate-700">"{summary.standout_quote}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
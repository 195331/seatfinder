import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Target, Gift, TrendingUp, Loader2, Check, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const SEGMENT_LABELS = {
  new_customers: { label: 'New Customers', icon: '🎉', color: 'blue' },
  frequent_visitors: { label: 'Frequent Visitors', icon: '⭐', color: 'purple' },
  high_spenders: { label: 'High Spenders', icon: '💎', color: 'amber' },
  lapsed_customers: { label: 'Win-Back', icon: '🔄', color: 'red' },
  cuisine_lovers: { label: 'Cuisine Fans', icon: '❤️', color: 'pink' }
};

export default function AIPersonalizedOffers({ restaurantId, restaurantName, cuisine }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const { data: dinerProfiles = [] } = useQuery({
    queryKey: ['dinerProfiles'],
    queryFn: () => base44.entities.DinerProfile.list('-total_visits', 100),
  });

  const { data: existingOffers = [] } = useQuery({
    queryKey: ['offers', restaurantId],
    queryFn: () => base44.entities.Offer.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId
  });

  const createOfferMutation = useMutation({
    mutationFn: (offerData) => base44.entities.Offer.create({
      ...offerData,
      restaurant_id: restaurantId,
      ai_generated: true,
      is_active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['offers']);
      toast.success('Offer created!');
    }
  });

  const analyzeAndSuggest = async () => {
    setGenerating(true);
    
    try {
      // Segment analysis
      const segments = {
        new_customers: dinerProfiles.filter(p => p.total_visits <= 1).length,
        frequent_visitors: dinerProfiles.filter(p => p.total_visits >= 5).length,
        high_spenders: dinerProfiles.filter(p => p.average_spend >= 50).length,
        lapsed_customers: dinerProfiles.filter(p => {
          if (!p.last_visit_date) return false;
          const daysSince = (Date.now() - new Date(p.last_visit_date).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 30 && p.total_visits >= 2;
        }).length,
        cuisine_lovers: dinerProfiles.filter(p => 
          p.favorite_cuisines?.includes(cuisine)
        ).length
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `As a restaurant marketing AI for "${restaurantName}" (${cuisine} cuisine), analyze these customer segments and suggest 3 personalized offers:

Segments:
- New Customers: ${segments.new_customers} diners (never or 1 visit)
- Frequent Visitors: ${segments.frequent_visitors} diners (5+ visits)
- High Spenders: ${segments.high_spenders} diners ($50+ avg)
- Lapsed Customers: ${segments.lapsed_customers} diners (30+ days inactive)
- ${cuisine} Cuisine Lovers: ${segments.cuisine_lovers} diners

Current Active Offers: ${existingOffers.length}

Suggest offers that:
1. Target the segment with highest potential ROI
2. Are attractive but profitable
3. Drive specific behaviors (repeat visits, higher spend, off-peak traffic)
4. Match the restaurant type and cuisine`,
        response_json_schema: {
          type: "object",
          properties: {
            offers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  offer_type: { type: "string" },
                  discount_value: { type: "number" },
                  free_item_name: { type: "string" },
                  target_segment: { type: "string" },
                  min_spend: { type: "number" },
                  rationale: { type: "string" },
                  expected_impact: { type: "string" },
                  days_active: { type: "array", items: { type: "number" } },
                  time_slots: { type: "array", items: { type: "string" } }
                }
              }
            },
            segment_insights: {
              type: "object",
              properties: {
                highest_potential: { type: "string" },
                recommended_focus: { type: "string" }
              }
            }
          }
        }
      });

      setSuggestions({
        ...response,
        segments
      });

    } catch (error) {
      toast.error('Failed to generate offers');
    }
    
    setGenerating(false);
  };

  const handleCreateOffer = (offer) => {
    createOfferMutation.mutate({
      title: offer.title,
      description: offer.description,
      offer_type: offer.offer_type || 'percentage_discount',
      discount_value: offer.discount_value,
      free_item_name: offer.free_item_name,
      target_segment: offer.target_segment,
      min_spend: offer.min_spend,
      days_active: offer.days_active || [0,1,2,3,4,5,6],
      time_slots: offer.time_slots || [],
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      max_uses_per_customer: 1
    });
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-pink-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          AI Personalized Offers
          <Badge className="bg-pink-100 text-pink-700 ml-2">Smart</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!suggestions ? (
          <div className="text-center py-6">
            <Gift className="w-12 h-12 text-pink-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Generate Smart Offers</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              AI analyzes {dinerProfiles.length} diner profiles to suggest targeted offers that drive revenue and repeat visits.
            </p>
            <Button
              onClick={analyzeAndSuggest}
              disabled={generating}
              className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Diners...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Generate Offers
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Segment Overview */}
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(suggestions.segments).map(([key, count]) => {
                const info = SEGMENT_LABELS[key];
                return (
                  <div key={key} className="text-center p-3 bg-white rounded-lg border border-slate-200">
                    <div className="text-xl mb-1">{info.icon}</div>
                    <div className="text-lg font-bold text-slate-900">{count}</div>
                    <div className="text-xs text-slate-500">{info.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Insights */}
            {suggestions.segment_insights && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">
                      Focus: {suggestions.segment_insights.highest_potential}
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      {suggestions.segment_insights.recommended_focus}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Offers */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Recommended Offers</h4>
              <div className="space-y-3">
                {suggestions.offers?.map((offer, index) => {
                  const segmentInfo = SEGMENT_LABELS[offer.target_segment];
                  return (
                    <div key={index} className="p-4 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-slate-900">{offer.title}</h5>
                            <Badge className={`bg-${segmentInfo?.color}-100 text-${segmentInfo?.color}-700 text-xs`}>
                              {segmentInfo?.icon} {segmentInfo?.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">{offer.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {offer.offer_type === 'percentage_discount' && (
                          <Badge variant="outline">{offer.discount_value}% off</Badge>
                        )}
                        {offer.offer_type === 'fixed_discount' && (
                          <Badge variant="outline">${offer.discount_value} off</Badge>
                        )}
                        {offer.free_item_name && (
                          <Badge variant="outline">Free {offer.free_item_name}</Badge>
                        )}
                        {offer.min_spend && (
                          <Badge variant="outline">Min ${offer.min_spend}</Badge>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mb-3">
                        <strong>Why:</strong> {offer.rationale}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {offer.expected_impact}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleCreateOffer(offer)}
                          disabled={createOfferMutation.isPending}
                          className="gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Create Offer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setSuggestions(null)}
              className="w-full"
            >
              Generate New Suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
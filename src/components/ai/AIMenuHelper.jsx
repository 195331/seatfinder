import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Check, X, Tag } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AIMenuHelper({ dishName, onDescriptionGenerated, onTagsGenerated }) {
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [suggestedDescription, setSuggestedDescription] = useState(null);
  const [suggestedTags, setSuggestedTags] = useState(null);

  const generateDescription = async () => {
    if (!dishName?.trim()) return;
    
    setGeneratingDescription(true);
    setSuggestedDescription(null);
    
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a short, appetizing menu description (2-3 sentences max) for a dish called "${dishName}". Make it sound delicious and enticing but keep it concise. Don't use quotes.`,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" }
          }
        }
      });
      
      setSuggestedDescription(response.description);
    } catch (error) {
      console.error('Failed to generate description:', error);
    }
    
    setGeneratingDescription(false);
  };

  const generateTags = async () => {
    if (!dishName?.trim()) return;
    
    setGeneratingTags(true);
    setSuggestedTags(null);
    
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `For a dish called "${dishName}", suggest relevant dietary and flavor tags. Only include tags that are likely true based on the dish name. Common tags include: spicy, mild, vegetarian, vegan, gluten-free, dairy-free, nut-free, contains-nuts, seafood, keto, low-carb, high-protein, organic, locally-sourced, signature, chef-special, seasonal.`,
        response_json_schema: {
          type: "object",
          properties: {
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of relevant tags"
            },
            confidence: {
              type: "object",
              properties: {
                is_vegetarian: { type: "boolean" },
                is_vegan: { type: "boolean" },
                is_gluten_free: { type: "boolean" },
                is_spicy: { type: "boolean" }
              }
            }
          }
        }
      });
      
      setSuggestedTags(response);
    } catch (error) {
      console.error('Failed to generate tags:', error);
    }
    
    setGeneratingTags(false);
  };

  const acceptDescription = () => {
    onDescriptionGenerated?.(suggestedDescription);
    setSuggestedDescription(null);
  };

  const acceptTags = () => {
    onTagsGenerated?.(suggestedTags);
    setSuggestedTags(null);
  };

  return (
    <div className="space-y-3">
      {/* Description Generator */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateDescription}
          disabled={!dishName?.trim() || generatingDescription}
          className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
        >
          {generatingDescription ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Generate Description
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateTags}
          disabled={!dishName?.trim() || generatingTags}
          className="gap-1.5 text-teal-600 border-teal-200 hover:bg-teal-50"
        >
          {generatingTags ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Tag className="w-3.5 h-3.5" />
          )}
          Suggest Tags
        </Button>
      </div>

      {/* Suggested Description */}
      {suggestedDescription && (
        <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-violet-700 mb-1">AI Suggestion:</p>
              <p className="text-sm text-slate-700">{suggestedDescription}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={acceptDescription}
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setSuggestedDescription(null)}
                className="h-7 w-7 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Tags */}
      {suggestedTags && (
        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-teal-700 mb-2">Suggested Tags:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.tags?.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-white">
                    {tag}
                  </Badge>
                ))}
              </div>
              {suggestedTags.confidence && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-teal-200">
                  {suggestedTags.confidence.is_vegetarian && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Likely Vegetarian</Badge>
                  )}
                  {suggestedTags.confidence.is_vegan && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Likely Vegan</Badge>
                  )}
                  {suggestedTags.confidence.is_gluten_free && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">May be Gluten-Free</Badge>
                  )}
                  {suggestedTags.confidence.is_spicy && (
                    <Badge className="bg-red-100 text-red-700 text-xs">Likely Spicy 🌶️</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={acceptTags}
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setSuggestedTags(null)}
                className="h-7 w-7 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
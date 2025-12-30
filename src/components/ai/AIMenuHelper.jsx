import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from "sonner";

export default function AIMenuHelper({ 
  dishName, 
  currentDescription,
  price,
  dietary = {},
  onDescriptionGenerated,
  onTagsGenerated 
}) {
  const [generating, setGenerating] = useState(false);

  const generateDescription = async () => {
    if (!dishName?.trim()) {
      toast.error('Please enter a dish name first');
      return;
    }

    setGenerating(true);
    try {
      const tags = [];
      if (dietary.is_vegetarian) tags.push('vegetarian');
      if (dietary.is_vegan) tags.push('vegan');
      if (dietary.is_gluten_free) tags.push('gluten-free');

      const prompt = `You are a professional food writer. Create an engaging, mouth-watering description for a menu item called "${dishName}".
      
Price: ${price ? `$${price}` : 'not specified'}
Dietary tags: ${tags.length > 0 ? tags.join(', ') : 'none'}

Write a concise (2-3 sentences) description that:
- Highlights key ingredients and flavors
- Creates appetite appeal
- Mentions preparation style if relevant
- Is appropriate for an upscale restaurant menu
- Avoids clichés

Return ONLY the description text, no extra formatting or quotes.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      if (result) {
        onDescriptionGenerated(result.trim());
        toast.success('Description generated!');
      }
    } catch (error) {
      toast.error('Failed to generate description');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateDescription}
        disabled={generating || !dishName?.trim()}
        className="gap-2 flex-1"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {currentDescription ? 'Regenerate' : 'Generate'} Description
          </>
        )}
      </Button>
    </div>
  );
}
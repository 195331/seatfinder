import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Check, Copy, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TONES = [
  { id: 'friendly', label: 'Friendly & Warm', emoji: '😊' },
  { id: 'formal', label: 'Professional', emoji: '💼' },
  { id: 'casual', label: 'Casual & Fun', emoji: '🎉' },
  { id: 'urgent', label: 'Urgent', emoji: '⚡' },
];

const TEMPLATE_TYPES = [
  { id: 'waitlist_update', label: 'Waitlist Position Update' },
  { id: 'table_ready', label: 'Table Ready Notification' },
  { id: 'almost_ready', label: 'Almost Your Turn' },
  { id: 'thank_you', label: 'Thank You for Visiting' },
  { id: 'no_show', label: 'Missed Reservation' },
  { id: 'reminder', label: 'Reservation Reminder' },
];

const PLACEHOLDERS = [
  { key: '{name}', desc: 'Guest name' },
  { key: '{restaurant_name}', desc: 'Restaurant name' },
  { key: '{wait_time}', desc: 'Estimated wait' },
  { key: '{position}', desc: 'Queue position' },
  { key: '{party_size}', desc: 'Party size' },
  { key: '{date}', desc: 'Reservation date' },
  { key: '{time}', desc: 'Reservation time' },
];

export default function AISMSTemplateGenerator({ 
  restaurantName, 
  onTemplateGenerated,
  initialType = 'waitlist_update'
}) {
  const [templateType, setTemplateType] = useState(initialType);
  const [tone, setTone] = useState('friendly');
  const [generating, setGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const generateTemplate = async () => {
    setGenerating(true);
    
    try {
      const typeLabel = TEMPLATE_TYPES.find(t => t.id === templateType)?.label;
      const toneLabel = TONES.find(t => t.id === tone)?.label;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Create an SMS message template for a restaurant called "${restaurantName || 'our restaurant'}".

Type: ${typeLabel}
Tone: ${toneLabel}

Requirements:
- Keep it under 160 characters if possible (SMS limit)
- Use these placeholders where appropriate: {name}, {restaurant_name}, {wait_time}, {position}
- Make it ${tone === 'friendly' ? 'warm and welcoming' : tone === 'formal' ? 'professional and polite' : tone === 'casual' ? 'fun and casual' : 'clear and urgent'}
- Include a clear call-to-action if appropriate
- Don't use hashtags or overly promotional language`,
        response_json_schema: {
          type: "object",
          properties: {
            message: { type: "string" },
            character_count: { type: "number" }
          }
        }
      });
      
      setGeneratedMessage(response.message);
      setEditedMessage(response.message);
    } catch (error) {
      toast.error('Failed to generate template');
    }
    
    setGenerating(false);
  };

  const getPreviewMessage = () => {
    return editedMessage
      .replace('{name}', 'John')
      .replace('{restaurant_name}', restaurantName || 'The Restaurant')
      .replace('{wait_time}', '15')
      .replace('{position}', '3')
      .replace('{party_size}', '4')
      .replace('{date}', 'Dec 1')
      .replace('{time}', '7:00 PM');
  };

  const handleSave = () => {
    onTemplateGenerated?.({
      template_type: templateType,
      message: editedMessage,
      tone
    });
    toast.success('Template saved!');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedMessage);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-slate-500">Message Type</Label>
          <Select value={templateType} onValueChange={setTemplateType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={generateTemplate}
        disabled={generating}
        className="w-full gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate AI Template
          </>
        )}
      </Button>

      {/* Generated/Edited Message */}
      {generatedMessage && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-slate-500">Edit Message</Label>
              <span className={cn(
                "text-xs",
                editedMessage.length > 160 ? "text-amber-600" : "text-slate-400"
              )}>
                {editedMessage.length}/160 chars
              </span>
            </div>
            <Textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          {/* Placeholders Help */}
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(p => (
              <Badge 
                key={p.key}
                variant="outline" 
                className="text-xs cursor-pointer hover:bg-slate-100"
                onClick={() => {
                  setEditedMessage(prev => prev + ' ' + p.key);
                }}
              >
                {p.key}
              </Badge>
            ))}
          </div>

          {/* Preview */}
          <div className="p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Preview</span>
              <Eye className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-sm text-white font-mono">{getPreviewMessage()}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="gap-1.5 flex-1"
            >
              <Check className="w-3.5 h-3.5" />
              Save Template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
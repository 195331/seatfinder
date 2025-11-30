import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Send, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import AISMSTemplateGenerator from './AISMSTemplateGenerator';

const DEFAULT_TEMPLATES = [
  {
    template_type: 'waitlist_update',
    name: 'Position Update',
    message: 'Hi {name}! You are now #{position} on the waitlist at {restaurant}. Estimated wait: {wait_time} minutes.'
  },
  {
    template_type: 'table_ready',
    name: 'Table Ready',
    message: 'Great news {name}! Your table at {restaurant} is ready. Please check in with the host within 5 minutes.'
  },
  {
    template_type: 'position_update',
    name: 'Almost Ready',
    message: 'Hi {name}! You are next in line at {restaurant}. Please head to the restaurant now!'
  }
];

export default function AISMSNotifications({ restaurantId, restaurantName, waitlistEntries = [] }) {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [newTemplate, setNewTemplate] = useState({ template_type: '', name: '', message: '' });
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sendingTo, setSendingTo] = useState(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['smsTemplates', restaurantId],
    queryFn: () => base44.entities.SMSTemplate.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data) => base44.entities.SMSTemplate.create({
      ...data,
      restaurant_id: restaurantId,
      is_active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['smsTemplates']);
      setShowNewDialog(false);
      setNewTemplate({ template_type: '', name: '', message: '' });
      toast.success('Template created');
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SMSTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['smsTemplates']);
      setEditingTemplate(null);
      toast.success('Template updated');
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.SMSTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['smsTemplates']);
      toast.success('Template deleted');
    }
  });

  const sendSMS = async (entry, templateType) => {
    if (!entry.guest_phone) {
      toast.error('No phone number for this guest');
      return;
    }

    setSendingTo(entry.id);

    try {
      const template = templates.find(t => t.template_type === templateType) 
        || DEFAULT_TEMPLATES.find(t => t.template_type === templateType);

      if (!template) {
        toast.error('Template not found');
        return;
      }

      const position = waitlistEntries.findIndex(e => e.id === entry.id) + 1;
      const waitTime = position * 8; // Estimated 8 min per party

      // Replace placeholders
      let message = template.message
        .replace('{name}', entry.guest_name || 'Guest')
        .replace('{restaurant}', restaurantName)
        .replace('{position}', position.toString())
        .replace('{wait_time}', waitTime.toString());

      // Use AI to personalize if needed
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Personalize this SMS message while keeping it under 160 characters. Keep the core information but make it friendly: "${message}"`,
        response_json_schema: {
          type: "object",
          properties: {
            message: { type: "string" }
          }
        }
      });

      // In production, integrate with Twilio or SMS provider
      // For now, simulate sending
      console.log('Sending SMS to:', entry.guest_phone, 'Message:', aiResponse.message || message);
      
      toast.success(`SMS sent to ${entry.guest_name}`);
    } catch (error) {
      toast.error('Failed to send SMS');
    }

    setSendingTo(null);
  };

  const sendBulkUpdate = async () => {
    const waiting = waitlistEntries.filter(e => e.status === 'waiting' && e.guest_phone);
    
    for (const entry of waiting) {
      await sendSMS(entry, 'waitlist_update');
    }
    
    toast.success(`Sent updates to ${waiting.length} guests`);
  };

  const allTemplates = [...DEFAULT_TEMPLATES, ...templates].reduce((acc, t) => {
    if (!acc.find(x => x.template_type === t.template_type)) {
      acc.push(t);
    }
    return acc;
  }, []);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            AI SMS Notifications
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700">Automated</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Send Toggle */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div>
            <Label className="font-medium">Auto-Send Updates</Label>
            <p className="text-sm text-slate-500">
              Automatically notify guests when their position changes
            </p>
          </div>
          <Switch
            checked={autoSendEnabled}
            onCheckedChange={setAutoSendEnabled}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 flex-col gap-1"
            onClick={sendBulkUpdate}
          >
            <Send className="w-4 h-4" />
            <span className="text-xs">Send All Updates</span>
          </Button>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs">AI Template</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  AI Template Generator
                </DialogTitle>
              </DialogHeader>
              <AISMSTemplateGenerator
                restaurantName={restaurantName}
                onTemplateGenerated={(template) => {
                  createTemplateMutation.mutate({
                    template_type: template.template_type,
                    name: `${template.template_type} (${template.tone})`,
                    message: template.message
                  });
                  setShowNewDialog(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Message Templates</h4>
          <div className="space-y-3">
            {allTemplates.map((template, index) => (
              <div
                key={template.id || index}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.template_type}
                    </Badge>
                    <span className="font-medium text-sm">{template.name}</span>
                  </div>
                  {template.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-600">{template.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist Quick Send */}
        {waitlistEntries.filter(e => e.status === 'waiting').length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Quick Send</h4>
            <div className="space-y-2">
              {waitlistEntries
                .filter(e => e.status === 'waiting')
                .slice(0, 5)
                .map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                        {index + 1}
                      </div>
                      <span className="text-sm">{entry.guest_name}</span>
                      {!entry.guest_phone && (
                        <Badge variant="outline" className="text-xs text-amber-600">No phone</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!entry.guest_phone || sendingTo === entry.id}
                      onClick={() => sendSMS(entry, 'waitlist_update')}
                      className="h-7 gap-1"
                    >
                      {sendingTo === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
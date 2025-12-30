import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { toast } from "sonner";

export default function NotificationPreferences({ currentUser }) {
  const [preferences, setPreferences] = useState(currentUser?.notification_preferences || {
    email: {
      reservations: true,
      offers: true,
      loyalty: true,
      low_inventory: true,
      staff_updates: true
    },
    push: {
      reservations: true,
      offers: false,
      loyalty: true,
      low_inventory: true,
      staff_updates: true
    },
    sms: {
      reservations: true,
      offers: false,
      loyalty: false,
      low_inventory: true,
      staff_updates: false
    }
  });

  const updateMutation = useMutation({
    mutationFn: (prefs) => base44.auth.updateMe({ notification_preferences: prefs }),
    onSuccess: () => toast.success('Preferences saved')
  });

  const handleToggle = (channel, type) => {
    const updated = {
      ...preferences,
      [channel]: {
        ...preferences[channel],
        [type]: !preferences[channel][type]
      }
    };
    setPreferences(updated);
  };

  const handleSave = () => {
    updateMutation.mutate(preferences);
  };

  const notificationTypes = [
    { id: 'reservations', label: 'Reservation Updates', description: 'Confirmations, reminders, changes' },
    { id: 'offers', label: 'Special Offers', description: 'Promotions and deals' },
    { id: 'loyalty', label: 'Loyalty Program', description: 'Points, rewards, tier updates' },
    { id: 'low_inventory', label: 'Low Inventory Alerts', description: 'For restaurant owners' },
    { id: 'staff_updates', label: 'Staff Schedule', description: 'Shift changes and updates' }
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">Choose how you want to receive updates</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 pb-3 border-b">
            <div className="font-medium text-slate-700">Notification Type</div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail className="w-4 h-4" />
              Email
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Bell className="w-4 h-4" />
              Push
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <MessageSquare className="w-4 h-4" />
              SMS
            </div>
          </div>

          {notificationTypes.map(type => (
            <div key={type.id} className="grid grid-cols-4 gap-4 items-center">
              <div>
                <p className="font-medium text-slate-900">{type.label}</p>
                <p className="text-xs text-slate-500">{type.description}</p>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={preferences.email?.[type.id]}
                  onCheckedChange={() => handleToggle('email', type.id)}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={preferences.push?.[type.id]}
                  onCheckedChange={() => handleToggle('push', type.id)}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={preferences.sms?.[type.id]}
                  onCheckedChange={() => handleToggle('sms', type.id)}
                />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
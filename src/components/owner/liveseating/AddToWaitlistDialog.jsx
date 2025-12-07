import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AddToWaitlistDialog({ 
  open, 
  onOpenChange, 
  restaurantId, 
  areas = [],
  onSuccess 
}) {
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    party_size: 2,
    preferred_area: ''
  });
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async () => {
    if (!formData.party_size) {
      toast.error('Please enter party size');
      return;
    }

    setIsAdding(true);
    try {
      await base44.entities.WaitlistEntry.create({
        restaurant_id: restaurantId,
        guest_name: formData.guest_name || 'Walk-in',
        guest_phone: formData.guest_phone,
        party_size: parseInt(formData.party_size),
        preferred_area: formData.preferred_area || null,
        status: 'waiting',
        estimated_wait_minutes: formData.party_size * 8 // Simple estimate
      });

      toast.success('Added to waitlist');
      setFormData({ guest_name: '', guest_phone: '', party_size: 2, preferred_area: '' });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to add to waitlist');
    }
    setIsAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Waitlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Guest Name (Optional)</Label>
            <Input
              value={formData.guest_name}
              onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              placeholder="Leave blank for walk-in"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Phone (Optional)</Label>
            <Input
              value={formData.guest_phone}
              onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
              placeholder="For SMS updates"
              type="tel"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Party Size *</Label>
            <Input
              type="number"
              value={formData.party_size}
              onChange={(e) => setFormData({ ...formData, party_size: e.target.value })}
              min="1"
              className="mt-1"
            />
          </div>
          {areas.length > 0 && (
            <div>
              <Label>Preferred Area (Optional)</Label>
              <Select 
                value={formData.preferred_area} 
                onValueChange={(v) => setFormData({ ...formData, preferred_area: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Any area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Any area</SelectItem>
                  {areas.map(area => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={isAdding} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add to Waitlist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
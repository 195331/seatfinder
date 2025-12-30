import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Edit, Trash2, Calendar, Users, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

export default function OfferManager({ restaurantId }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    offer_type: 'percentage_discount',
    discount_value: '',
    free_item_name: '',
    target_segment: 'all',
    min_spend: '',
    max_uses_per_customer: 1,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['offers', restaurantId],
    queryFn: () => base44.entities.Offer.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId
  });

  const createOfferMutation = useMutation({
    mutationFn: (data) => base44.entities.Offer.create({
      ...data,
      restaurant_id: restaurantId,
      discount_value: parseFloat(data.discount_value) || 0,
      min_spend: data.min_spend ? parseFloat(data.min_spend) : null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['offers']);
      setShowDialog(false);
      resetForm();
      toast.success('Offer created!');
    }
  });

  const updateOfferMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Offer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['offers']);
      setEditingOffer(null);
      toast.success('Offer updated!');
    }
  });

  const deleteOfferMutation = useMutation({
    mutationFn: (id) => base44.entities.Offer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['offers']);
      toast.success('Offer deleted');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      offer_type: 'percentage_discount',
      discount_value: '',
      free_item_name: '',
      target_segment: 'all',
      min_spend: '',
      max_uses_per_customer: 1,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.offer_type) {
      toast.error('Please fill required fields');
      return;
    }
    createOfferMutation.mutate(formData);
  };

  const segmentColors = {
    all: 'bg-slate-100 text-slate-700',
    new_customers: 'bg-blue-100 text-blue-700',
    frequent_visitors: 'bg-purple-100 text-purple-700',
    high_spenders: 'bg-amber-100 text-amber-700',
    lapsed_customers: 'bg-red-100 text-red-700',
    cuisine_lovers: 'bg-pink-100 text-pink-700'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Offer Management
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Plus className="w-4 h-4" />
                Create Offer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Offer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="20% Off Your Next Visit"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Details about the offer..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Offer Type *</Label>
                    <Select value={formData.offer_type} onValueChange={(v) => setFormData({ ...formData, offer_type: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage_discount">% Discount</SelectItem>
                        <SelectItem value="fixed_discount">$ Off</SelectItem>
                        <SelectItem value="free_item">Free Item</SelectItem>
                        <SelectItem value="buy_one_get_one">BOGO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.offer_type !== 'free_item' && formData.offer_type !== 'buy_one_get_one' && (
                    <div>
                      <Label>Value</Label>
                      <Input
                        type="number"
                        value={formData.discount_value}
                        onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                        placeholder={formData.offer_type === 'percentage_discount' ? '20' : '10'}
                        className="mt-1"
                      />
                    </div>
                  )}
                  {formData.offer_type === 'free_item' && (
                    <div>
                      <Label>Free Item</Label>
                      <Input
                        value={formData.free_item_name}
                        onChange={(e) => setFormData({ ...formData, free_item_name: e.target.value })}
                        placeholder="Dessert"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Target Segment</Label>
                    <Select value={formData.target_segment} onValueChange={(v) => setFormData({ ...formData, target_segment: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="new_customers">New Customers</SelectItem>
                        <SelectItem value="frequent_visitors">Frequent Visitors</SelectItem>
                        <SelectItem value="high_spenders">High Spenders</SelectItem>
                        <SelectItem value="lapsed_customers">Win-Back</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Min Spend ($)</Label>
                    <Input
                      type="number"
                      value={formData.min_spend}
                      onChange={(e) => setFormData({ ...formData, min_spend: e.target.value })}
                      placeholder="Optional"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valid From</Label>
                    <Input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Valid Until</Label>
                    <Input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={createOfferMutation.isPending}
                  className="w-full"
                >
                  {createOfferMutation.isPending ? 'Creating...' : 'Create Offer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No offers yet</p>
            <p className="text-sm">Create targeted offers to drive sales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(offers || []).map((offer) => (
              <div key={offer.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{offer.title}</h4>
                      {offer.ai_generated && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">AI</Badge>
                      )}
                      <Badge className={segmentColors[offer.target_segment]}>
                        {offer.target_segment.replace('_', ' ')}
                      </Badge>
                    </div>
                    {offer.description && (
                      <p className="text-sm text-slate-600 mb-2">{offer.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {offer.offer_type === 'percentage_discount' && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {offer.discount_value}% off
                        </span>
                      )}
                      {offer.min_spend && (
                        <span>Min ${offer.min_spend}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {moment(offer.valid_until).format('MMM D')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {offer.total_uses || 0} uses
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Switch
                      checked={offer.is_active}
                      onCheckedChange={(checked) => updateOfferMutation.mutate({
                        id: offer.id,
                        data: { is_active: checked }
                      })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteOfferMutation.mutate(offer.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
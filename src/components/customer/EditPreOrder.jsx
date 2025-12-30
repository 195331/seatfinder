import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, ShoppingCart, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import moment from 'moment';

export default function EditPreOrder({ 
  preOrder, 
  reservation, 
  restaurant,
  menuItems, 
  open, 
  onOpenChange 
}) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState(preOrder?.items || []);
  const [specialInstructions, setSpecialInstructions] = useState(preOrder?.special_instructions || '');

  // Calculate deadline
  const resTime = moment(`${reservation.reservation_date} ${reservation.reservation_time}`);
  const deadlineMinutes = restaurant.preorder_deadline_minutes || 30;
  const deadline = resTime.clone().subtract(deadlineMinutes, 'minutes');
  const isPastDeadline = moment().isAfter(deadline);
  const minutesUntilDeadline = deadline.diff(moment(), 'minutes');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return base44.entities.PreOrder.update(preOrder.id, {
        items: cart,
        special_instructions: specialInstructions,
        total_amount: total,
        edited_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['preOrder']);
      queryClient.invalidateQueries(['reservation']);
      toast.success('Pre-order updated successfully');
      onOpenChange(false);
    }
  });

  const updateQuantity = (menuItemId, newQuantity) => {
    if (newQuantity === 0) {
      setCart(cart.filter(item => item.menu_item_id !== menuItemId));
    } else {
      const maxQty = restaurant.preorder_max_quantity || 10;
      const safeQty = Math.min(newQuantity, maxQty);
      setCart(cart.map(item => 
        item.menu_item_id === menuItemId 
          ? { ...item, quantity: safeQty }
          : item
      ));
    }
  };

  const addItem = (menuItem) => {
    const existing = cart.find(item => item.menu_item_id === menuItem.id);
    if (existing) {
      updateQuantity(menuItem.id, existing.quantity + 1);
    } else {
      setCart([...cart, {
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        item_notes: ''
      }]);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const groupedMenu = (menuItems || []).reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (isPastDeadline) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pre-Order Locked</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-slate-600 mb-2">
              The deadline to edit your pre-order has passed.
            </p>
            <p className="text-sm text-slate-500">
              Pre-orders must be finalized at least {deadlineMinutes} minutes before your reservation.
            </p>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Pre-Order</DialogTitle>
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              {minutesUntilDeadline}m until deadline
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto grid lg:grid-cols-3 gap-6 py-4">
          {/* Menu Items */}
          <div className="lg:col-span-2 space-y-4">
            {Object.entries(groupedMenu).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-semibold text-lg mb-3">{category}</h3>
                <div className="space-y-2">
                  {items.map(item => {
                    const cartItem = cart.find(c => c.menu_item_id === item.id);
                    const quantity = cartItem?.quantity || 0;
                    
                    return (
                      <div key={item.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="font-semibold">${item.price.toFixed(2)}</p>
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-600">{item.description}</p>
                          )}
                        </div>
                        
                        {quantity === 0 ? (
                          <Button
                            size="sm"
                            onClick={() => addItem(item)}
                            className="ml-3"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 ml-3">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, quantity - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center font-semibold">{quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, quantity + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-0 bg-white border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Your Order
              </h3>

              {cart.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  No items in cart
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.menu_item_id} className="flex items-start justify-between text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-slate-500">
                            ${item.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-500"
                            onClick={() => updateQuantity(item.menu_item_id, 0)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">Special Instructions</Label>
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Allergies, preferences..."
                  className="mt-1.5 text-sm"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || cart.length === 0}
                className="w-full"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
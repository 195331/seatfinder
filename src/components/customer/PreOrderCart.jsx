import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Trash2, ChevronLeft } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function PreOrderCart({ 
  menuItems, 
  cart, 
  onAddToCart, 
  onUpdateQuantity, 
  onRemoveFromCart,
  onComplete,
  onBack,
  isSubmitting 
}) {
  const [specialInstructions, setSpecialInstructions] = useState('');

  const groupedMenu = (menuItems || []).reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const cartTotal = (cart || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = (cart || []).reduce((sum, item) => sum + item.quantity, 0);

  const getItemQuantity = (menuItemId) => {
    const cartItem = (cart || []).find(c => c.menu_item_id === menuItemId);
    return cartItem?.quantity || 0;
  };

  const handleComplete = () => {
    onComplete({ items: cart, specialInstructions, total: cartTotal });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Menu Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Pre-Order Menu Items</h2>
            <p className="text-sm text-slate-500">Optional - Select items you'd like to order</p>
          </div>
        </div>

        {Object.entries(groupedMenu).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => {
                const quantity = getItemQuantity(item.id);
                return (
                  <div key={item.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="font-semibold text-slate-900">${item.price.toFixed(2)}</p>
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {item.is_vegetarian && <Badge variant="secondary" className="text-xs">Vegetarian</Badge>}
                        {item.is_vegan && <Badge variant="secondary" className="text-xs">Vegan</Badge>}
                        {item.is_gluten_free && <Badge variant="secondary" className="text-xs">Gluten-Free</Badge>}
                        {item.calories && <Badge variant="outline" className="text-xs">{item.calories} cal</Badge>}
                      </div>
                    </div>
                    
                    {quantity === 0 ? (
                      <Button
                        size="sm"
                        onClick={() => onAddToCart(item)}
                        className="ml-3 gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 ml-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cart Summary - Sticky */}
      <div className="lg:sticky lg:top-24 lg:h-fit">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Order
              {cartCount > 0 && (
                <Badge className="bg-emerald-600">{cartCount}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-sm">
                No items added yet. Browse the menu above.
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.menu_item_id} className="flex items-start justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-slate-500">${item.price.toFixed(2)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-500 hover:text-red-600"
                          onClick={() => onRemoveFromCart(item.menu_item_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="mb-4">
                    <Label className="text-xs">Special Instructions</Label>
                    <Textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Any special requests or dietary notes..."
                      className="mt-1.5 text-sm"
                      rows={3}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-800">
                      💳 Payment will be handled at the restaurant
                    </p>
                  </div>

                  <Button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="w-full gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {isSubmitting ? 'Submitting...' : 'Complete Reservation & Pre-Order'}
                  </Button>
                </div>
              </>
            )}

            <Button
              variant="outline"
              onClick={() => onComplete({ items: [], specialInstructions: '', total: 0 })}
              disabled={isSubmitting}
              className="w-full"
            >
              Skip Pre-Order
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
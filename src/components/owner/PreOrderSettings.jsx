import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UtensilsCrossed, Clock, DollarSign, Hash, Info } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function PreOrderSettings({ restaurant, onSave }) {
  const [config, setConfig] = useState({
    enabled: restaurant?.enable_preorder || false,
    deadline_minutes: restaurant?.preorder_deadline_minutes || 30,
    all_items_eligible: restaurant?.preorder_all_items_eligible !== false,
    minimum_spend: restaurant?.preorder_minimum_spend || 0,
    max_quantity_per_item: restaurant?.preorder_max_quantity || 10,
    allow_special_instructions: restaurant?.preorder_allow_instructions !== false,
  });

  useEffect(() => {
    if (restaurant) {
      setConfig({
        enabled: restaurant.enable_preorder || false,
        deadline_minutes: restaurant.preorder_deadline_minutes || 30,
        all_items_eligible: restaurant.preorder_all_items_eligible !== false,
        minimum_spend: restaurant.preorder_minimum_spend || 0,
        max_quantity_per_item: restaurant.preorder_max_quantity || 10,
        allow_special_instructions: restaurant.preorder_allow_instructions !== false,
      });
    }
  }, [restaurant]);

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({
      enable_preorder: config.enabled,
      preorder_deadline_minutes: config.deadline_minutes,
      preorder_all_items_eligible: config.all_items_eligible,
      preorder_minimum_spend: config.minimum_spend,
      preorder_max_quantity: config.max_quantity_per_item,
      preorder_allow_instructions: config.allow_special_instructions,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                Pre-Order with Reservation
              </CardTitle>
              <CardDescription className="mt-1.5">
                Let diners order food when they make a reservation
              </CardDescription>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => updateConfig('enabled', checked)}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
        </CardHeader>
        {config.enabled && (
          <CardContent className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                When enabled, diners can browse your menu and add items to their order during the reservation process. Payment is handled at the restaurant.
              </AlertDescription>
            </Alert>

            {/* Deadline */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Pre-Order Deadline
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={config.deadline_minutes}
                  onChange={(e) => updateConfig('deadline_minutes', parseInt(e.target.value) || 30)}
                  min={15}
                  max={1440}
                  className="max-w-32"
                />
                <span className="text-sm text-slate-600">
                  minutes before reservation time
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Diners must place their order at least this long before their reservation
              </p>
            </div>

            {/* Item Eligibility */}
            <div className="space-y-3">
              <Label>Menu Items Eligible for Pre-Order</Label>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <span className="text-sm font-medium">All menu items</span>
                  <input
                    type="radio"
                    checked={config.all_items_eligible}
                    onChange={() => updateConfig('all_items_eligible', true)}
                    className="w-4 h-4 text-emerald-600"
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Selected items only</span>
                    <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                  </div>
                  <input
                    type="radio"
                    checked={!config.all_items_eligible}
                    onChange={() => updateConfig('all_items_eligible', false)}
                    disabled
                    className="w-4 h-4 text-emerald-600"
                  />
                </label>
              </div>
            </div>

            {/* Minimum Spend */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-500" />
                Minimum Pre-Order Amount (Optional)
              </Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">$</span>
                <Input
                  type="number"
                  value={config.minimum_spend}
                  onChange={(e) => updateConfig('minimum_spend', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  className="max-w-32"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-slate-500">
                Leave at 0 for no minimum. Diners can still skip pre-ordering entirely.
              </p>
            </div>

            {/* Max Quantity */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-500" />
                Maximum Quantity Per Item
              </Label>
              <Input
                type="number"
                value={config.max_quantity_per_item}
                onChange={(e) => updateConfig('max_quantity_per_item', parseInt(e.target.value) || 10)}
                min={1}
                max={99}
                className="max-w-32"
              />
              <p className="text-xs text-slate-500">
                Prevent excessive quantities of individual items
              </p>
            </div>

            {/* Special Instructions */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="font-medium">Allow Special Instructions</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Let diners add notes for dietary restrictions or modifications
                </p>
              </div>
              <Switch
                checked={config.allow_special_instructions}
                onCheckedChange={(checked) => updateConfig('allow_special_instructions', checked)}
              />
            </div>

            {/* Deposit Notice */}
            <Alert className="bg-amber-50 border-amber-200">
              <Info className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                <strong>Deposit/Prepayment:</strong> Currently not supported. All pre-orders are "pay at restaurant." Stripe integration coming soon.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Save Pre-Order Settings
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
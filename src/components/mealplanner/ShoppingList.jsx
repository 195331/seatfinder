import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check, Download } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS = {
  produce: '🥬',
  proteins: '🍗',
  dairy_eggs: '🥛',
  pantry: '🏺',
  spices_condiments: '🧂',
  frozen: '❄️',
  other: '📦'
};

const CATEGORY_LABELS = {
  produce: 'Produce',
  proteins: 'Proteins',
  dairy_eggs: 'Dairy & Eggs',
  pantry: 'Pantry',
  spices_condiments: 'Spices & Condiments',
  frozen: 'Frozen',
  other: 'Other'
};

export default function ShoppingList({ mealPlan, servings }) {
  const [checkedItems, setCheckedItems] = useState(new Set());

  const toggleItem = (key) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(key)) {
      newChecked.delete(key);
    } else {
      newChecked.add(key);
    }
    setCheckedItems(newChecked);
  };

  const exportList = () => {
    let text = `Shopping List for Week of ${mealPlan.week_start_date}\n`;
    text += `Servings: ${servings}\n\n`;

    Object.entries(mealPlan.shopping_list || {}).forEach(([category, items]) => {
      if (items && items.length > 0) {
        text += `${CATEGORY_LABELS[category] || category}:\n`;
        items.forEach(item => {
          text += `  ☐ ${item.amount} ${item.unit} ${item.item}\n`;
        });
        text += '\n';
      }
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    a.click();
    toast.success('Shopping list downloaded!');
  };

  const totalItems = Object.values(mealPlan.shopping_list || {})
    .reduce((sum, items) => sum + (items?.length || 0), 0);
  const checkedCount = checkedItems.size;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Weekly Shopping List</h2>
                <p className="text-sm text-slate-500">
                  {checkedCount} of {totalItems} items checked
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={exportList}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-orange-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {progress === 100 && (
            <div className="mt-3 flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">All items checked!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shopping List by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(mealPlan.shopping_list || {}).map(([category, items]) => {
          if (!items || items.length === 0) return null;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-2xl">{CATEGORY_ICONS[category]}</span>
                  {CATEGORY_LABELS[category] || category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item, i) => {
                  const itemKey = `${category}_${i}`;
                  const isChecked = checkedItems.has(itemKey);

                  return (
                    <label
                      key={i}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors",
                        isChecked && "opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleItem(itemKey)}
                        className="mt-0.5"
                      />
                      <span className={cn(
                        "text-sm flex-1",
                        isChecked && "line-through text-slate-500"
                      )}>
                        {item.amount} {item.unit} {item.item}
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
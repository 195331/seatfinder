import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Clock, Users, Flame } from 'lucide-react';

export default function MealDetailDialog({ 
  open, 
  onOpenChange, 
  meal, 
  day, 
  mealType, 
  servings,
  onSwap,
  isSwapping 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{meal.name}</h2>
              <p className="text-sm text-slate-500 font-normal capitalize">{day} • {mealType}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSwap}
              disabled={isSwapping}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Swap Meal
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Description */}
          <p className="text-slate-600">{meal.description}</p>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm">
                Prep: {meal.prep_time}m • Cook: {meal.cook_time}m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm">{servings} servings</span>
            </div>
            {meal.calories && (
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm">{meal.calories} cal/serving</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {meal.tags && meal.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meal.tags.map((tag, i) => (
                <Badge key={i} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Allergen Check */}
          {meal.allergen_check && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm text-green-800 font-medium">Allergen Safe</span>
            </div>
          )}

          <Separator />

          {/* Ingredients */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Ingredients</h3>
            <ul className="space-y-2">
              {meal.ingredients?.map((ing, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span className="text-slate-700">
                    {ing.amount} {ing.unit} {ing.item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Instructions */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Instructions</h3>
            <ol className="space-y-3">
              {meal.instructions?.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-slate-700 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
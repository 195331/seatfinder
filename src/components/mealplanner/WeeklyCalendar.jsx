import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Lock, Unlock, Users } from 'lucide-react';
import { toast } from "sonner";
import MealDetailDialog from './MealDetailDialog';
import { cn } from "@/lib/utils";
import moment from 'moment';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function WeeklyCalendar({ mealPlan, currentUser }) {
  const queryClient = useQueryClient();
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [servings, setServings] = useState(mealPlan.servings);

  const updateServingsMutation = useMutation({
    mutationFn: (newServings) => 
      base44.entities.MealPlan.update(mealPlan.id, { servings: newServings }),
    onSuccess: () => {
      queryClient.invalidateQueries(['mealPlans']);
      toast.success('Servings updated!');
    }
  });

  const toggleLockMutation = useMutation({
    mutationFn: (mealKey) => {
      const locked = mealPlan.locked_meals || [];
      const newLocked = locked.includes(mealKey)
        ? locked.filter(k => k !== mealKey)
        : [...locked, mealKey];
      return base44.entities.MealPlan.update(mealPlan.id, { locked_meals: newLocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mealPlans']);
    }
  });

  const regenerateWeekMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Regenerate a weekly meal plan with these requirements:

Previous plan preferences: ${JSON.stringify(mealPlan.preferences)}
Servings: ${mealPlan.servings}

LOCKED MEALS (keep exactly as-is):
${(mealPlan.locked_meals || []).map(key => {
  const [day, mealType] = key.split('_');
  return `${day} ${mealType}: ${JSON.stringify(mealPlan.meals[day]?.[mealType])}`;
}).join('\n')}

Generate NEW meals for unlocked slots only. Maintain same structure and requirements as before.
CRITICAL: If allergies exist (${mealPlan.preferences.allergies?.join(', ') || 'none'}), exclude them completely.

Return full week structure with both locked and new meals.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            monday: { type: "object" },
            tuesday: { type: "object" },
            wednesday: { type: "object" },
            thursday: { type: "object" },
            friday: { type: "object" },
            saturday: { type: "object" },
            sunday: { type: "object" }
          }
        }
      });

      // Regenerate shopping list
      const shoppingListPrompt = `Create shopping list for: ${JSON.stringify(response)}
      Organize by category. Return as object with produce, proteins, dairy_eggs, pantry, spices_condiments, frozen, other.`;

      const shoppingList = await base44.integrations.Core.InvokeLLM({
        prompt: shoppingListPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            produce: { type: "array" },
            proteins: { type: "array" },
            dairy_eggs: { type: "array" },
            pantry: { type: "array" },
            spices_condiments: { type: "array" },
            frozen: { type: "array" },
            other: { type: "array" }
          }
        }
      });

      await base44.entities.MealPlan.update(mealPlan.id, {
        meals: response,
        shopping_list: shoppingList
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mealPlans']);
      toast.success('Meal plan regenerated!');
    }
  });

  const swapMealMutation = useMutation({
    mutationFn: async ({ day, mealType }) => {
      const prompt = `Generate a single meal replacement:

Requirements:
- Dietary: ${mealPlan.preferences.dietary_restrictions?.join(', ') || 'None'}
- EXCLUDE ALLERGENS: ${mealPlan.preferences.allergies?.join(', ') || 'None'}
- Cuisines: ${mealPlan.preferences.favorite_cuisines?.join(', ') || 'Varied'}
- Meal type: ${mealType}
- Servings: ${mealPlan.servings}
${mealPlan.preferences.calorie_target ? `- Calories: ~${mealPlan.preferences.calorie_target}` : ''}

Current meal to replace: ${JSON.stringify(mealPlan.meals[day]?.[mealType])}

Generate a completely different meal that fits the requirements. Include all fields: name, description, prep_time, cook_time, calories, ingredients (array of {item, amount, unit}), instructions (array), tags, allergen_check.`;

      const newMeal = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            prep_time: { type: "number" },
            cook_time: { type: "number" },
            calories: { type: "number" },
            ingredients: { type: "array" },
            instructions: { type: "array" },
            tags: { type: "array" },
            allergen_check: { type: "string" }
          }
        }
      });

      const updatedMeals = {
        ...mealPlan.meals,
        [day]: {
          ...mealPlan.meals[day],
          [mealType]: newMeal
        }
      };

      // Regenerate shopping list
      const shoppingListPrompt = `Create shopping list for: ${JSON.stringify(updatedMeals)}`;
      const shoppingList = await base44.integrations.Core.InvokeLLM({
        prompt: shoppingListPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            produce: { type: "array" },
            proteins: { type: "array" },
            dairy_eggs: { type: "array" },
            pantry: { type: "array" },
            spices_condiments: { type: "array" },
            frozen: { type: "array" },
            other: { type: "array" }
          }
        }
      });

      await base44.entities.MealPlan.update(mealPlan.id, {
        meals: updatedMeals,
        shopping_list: shoppingList
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mealPlans']);
      setSelectedMeal(null);
      toast.success('Meal swapped!');
    }
  });

  const getMealTypes = () => mealPlan.preferences.meals_to_plan || [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium">Servings:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newServings = Math.max(1, servings - 1);
                    setServings(newServings);
                    updateServingsMutation.mutate(newServings);
                  }}
                >
                  -
                </Button>
                <span className="w-8 text-center font-semibold">{servings}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newServings = Math.min(10, servings + 1);
                    setServings(newServings);
                    updateServingsMutation.mutate(newServings);
                  }}
                >
                  +
                </Button>
              </div>
            </div>

            <Button
              onClick={() => regenerateWeekMutation.mutate()}
              disabled={regenerateWeekMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", regenerateWeekMutation.isPending && "animate-spin")} />
              Regenerate Week
            </Button>
          </div>

          {/* Preferences Badge */}
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-xs font-medium text-orange-900 mb-1">Based on your preferences:</p>
            <div className="flex flex-wrap gap-1">
              {mealPlan.preferences.dietary_restrictions?.map(d => (
                <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
              ))}
              {mealPlan.preferences.allergies?.map(a => (
                <Badge key={a} className="text-xs bg-red-100 text-red-800">⚠️ No {a}</Badge>
              ))}
              {mealPlan.preferences.calorie_target && (
                <Badge variant="secondary" className="text-xs">~{mealPlan.preferences.calorie_target} cal/meal</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <div className="space-y-4">
        {DAYS.map(day => (
          <Card key={day}>
            <CardContent className="p-4">
              <h3 className="font-bold text-lg capitalize mb-3 text-slate-900">
                {moment(day, 'dddd').format('dddd')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {getMealTypes().map(mealType => {
                  const mealKey = `${day}_${mealType}`;
                  const normalizedMealType = mealType.toLowerCase();
                  const meal = mealPlan.meals?.[day]?.[normalizedMealType];
                  const isLocked = (mealPlan.locked_meals || []).includes(mealKey);

                  if (!meal || !meal.name) return null;

                  return (
                    <div
                      key={mealType}
                      className="bg-white border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer relative group"
                      onClick={() => setSelectedMeal({ day, mealType: mealType.toLowerCase(), meal })}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLockMutation.mutate(mealKey);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-100"
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Unlock className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <Badge className="mb-2 text-xs">{mealType}</Badge>
                      <h4 className="font-semibold text-sm mb-1 pr-6">{meal.name}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{meal.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <span>⏱️ {(meal.prep_time || 0) + (meal.cook_time || 0)} min</span>
                        {meal.calories && <span>• {meal.calories} cal</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedMeal && (
        <MealDetailDialog
          open={!!selectedMeal}
          onOpenChange={(open) => !open && setSelectedMeal(null)}
          meal={selectedMeal.meal}
          day={selectedMeal.day}
          mealType={selectedMeal.mealType}
          servings={mealPlan.servings}
          onSwap={() => swapMealMutation.mutate({ 
            day: selectedMeal.day, 
            mealType: selectedMeal.mealType 
          })}
          isSwapping={swapMealMutation.isPending}
        />
      )}
    </div>
  );
}
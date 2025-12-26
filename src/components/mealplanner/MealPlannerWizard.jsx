import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo', 
  'Low-Carb', 'Low-Fat', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Kosher'
];

const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 
  'Wheat/Gluten', 'Fish', 'Shellfish', 'Sesame'
];

const CUISINE_OPTIONS = [
  'Italian', 'Mexican', 'Asian', 'Mediterranean', 'American',
  'Indian', 'Thai', 'Japanese', 'French', 'Greek', 'Middle Eastern'
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function MealPlannerWizard({ open, onOpenChange, currentUser }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    dietary_restrictions: currentUser?.meal_preferences?.dietary_restrictions || [],
    allergies: currentUser?.meal_preferences?.allergies || [],
    favorite_cuisines: currentUser?.meal_preferences?.favorite_cuisines || [],
    calorie_target: currentUser?.meal_preferences?.calorie_target || null,
    meals_to_plan: currentUser?.meal_preferences?.meals_to_plan || ['Breakfast', 'Lunch', 'Dinner'],
    servings: 2
  });

  const generateMealPlanMutation = useMutation({
    mutationFn: async () => {
      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      
      const prompt = `Generate a complete weekly meal plan with the following requirements:

STRICT REQUIREMENTS:
- Dietary restrictions: ${preferences.dietary_restrictions.join(', ') || 'None'}
- CRITICAL ALLERGIES (MUST EXCLUDE): ${preferences.allergies.join(', ') || 'None'}
- Favorite cuisines: ${preferences.favorite_cuisines.join(', ') || 'Varied'}
- Calorie target per meal: ${preferences.calorie_target ? `~${preferences.calorie_target} calories` : 'Not specified'}
- Meals to plan: ${preferences.meals_to_plan.join(', ')}
- Servings: ${preferences.servings}

Generate meals for Monday through Sunday. For each day, provide meals for: ${preferences.meals_to_plan.join(', ')}.

Each meal must include:
- name: Meal name
- description: Brief description
- prep_time: minutes
- cook_time: minutes
- calories: estimated per serving
- ingredients: Array of {item, amount, unit}
- instructions: Step-by-step array
- tags: Array of relevant tags

CRITICAL: If allergies are specified, triple-check no ingredients contain those allergens. Include a "allergen_check": "safe" field confirming this.

Return structured data with days as keys (monday-sunday) and meal types as nested keys.`;

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

      // Generate shopping list
      const shoppingListPrompt = `Based on this meal plan, create a consolidated shopping list organized by category.

Meal Plan: ${JSON.stringify(response)}

Combine duplicate ingredients and organize into categories:
- Produce
- Proteins
- Dairy & Eggs
- Pantry
- Spices & Condiments
- Frozen
- Other

Return as object with category keys and arrays of {item, amount, unit}.`;

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

      // Save preferences to user
      await base44.auth.updateMe({ meal_preferences: preferences });

      // Create meal plan
      await base44.entities.MealPlan.create({
        user_id: currentUser.id,
        week_start_date: weekStart,
        preferences,
        meals: response,
        shopping_list: shoppingList,
        servings: preferences.servings,
        locked_meals: [],
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mealPlans']);
      toast.success('Your meal plan is ready!');
      onOpenChange(false);
      setStep(1);
    },
    onError: () => {
      toast.error('Failed to generate meal plan');
    }
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else generateMealPlanMutation.mutate();
  };

  const canProceed = () => {
    if (step === 3) return preferences.meals_to_plan.length > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            Create Your Meal Plan - Step {step} of 4
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Step 1: Dietary Restrictions */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Dietary Preferences</h3>
                <p className="text-sm text-slate-500 mb-4">Select any dietary restrictions you follow</p>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map(diet => (
                    <label key={diet} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                      <Checkbox
                        checked={preferences.dietary_restrictions.includes(diet)}
                        onCheckedChange={(checked) => {
                          setPreferences({
                            ...preferences,
                            dietary_restrictions: checked
                              ? [...preferences.dietary_restrictions, diet]
                              : preferences.dietary_restrictions.filter(d => d !== diet)
                          });
                        }}
                      />
                      <span className="text-sm">{diet}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Allergies & Calorie Target */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Allergies & Health Goals</h3>
                <p className="text-sm text-slate-500 mb-4">
                  <span className="text-red-600 font-medium">Important:</span> We'll strictly exclude any allergens from your meal plan
                </p>
                <Label className="mb-2 block font-medium">Allergies</Label>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {COMMON_ALLERGIES.map(allergy => (
                    <label key={allergy} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-red-50">
                      <Checkbox
                        checked={preferences.allergies.includes(allergy)}
                        onCheckedChange={(checked) => {
                          setPreferences({
                            ...preferences,
                            allergies: checked
                              ? [...preferences.allergies, allergy]
                              : preferences.allergies.filter(a => a !== allergy)
                          });
                        }}
                      />
                      <span className="text-sm">{allergy}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="calories">Calorie Target per Meal (Optional)</Label>
                <Input
                  id="calories"
                  type="number"
                  placeholder="e.g., 500"
                  value={preferences.calorie_target || ''}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    calorie_target: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty for no calorie restrictions</p>
              </div>
            </div>
          )}

          {/* Step 3: Cuisines & Meals */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Favorite Cuisines</h3>
                <p className="text-sm text-slate-500 mb-4">Select cuisines you enjoy (we'll add variety)</p>
                <div className="grid grid-cols-2 gap-2">
                  {CUISINE_OPTIONS.map(cuisine => (
                    <label key={cuisine} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                      <Checkbox
                        checked={preferences.favorite_cuisines.includes(cuisine)}
                        onCheckedChange={(checked) => {
                          setPreferences({
                            ...preferences,
                            favorite_cuisines: checked
                              ? [...preferences.favorite_cuisines, cuisine]
                              : preferences.favorite_cuisines.filter(c => c !== cuisine)
                          });
                        }}
                      />
                      <span className="text-sm">{cuisine}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-medium">Which meals to plan?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_TYPES.map(meal => (
                    <label key={meal} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-orange-50">
                      <Checkbox
                        checked={preferences.meals_to_plan.includes(meal)}
                        onCheckedChange={(checked) => {
                          setPreferences({
                            ...preferences,
                            meals_to_plan: checked
                              ? [...preferences.meals_to_plan, meal]
                              : preferences.meals_to_plan.filter(m => m !== meal)
                          });
                        }}
                      />
                      <span className="text-sm font-medium">{meal}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Servings & Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Final Details</h3>
                <Label htmlFor="servings">Number of Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  min="1"
                  max="10"
                  value={preferences.servings}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    servings: parseInt(e.target.value)
                  })}
                  className="mt-2"
                />
              </div>

              <div className="bg-orange-50 rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold">Your Preferences Summary:</h4>
                <p><strong>Dietary:</strong> {preferences.dietary_restrictions.join(', ') || 'None'}</p>
                {preferences.allergies.length > 0 && (
                  <p className="text-red-600"><strong>Allergies:</strong> {preferences.allergies.join(', ')}</p>
                )}
                <p><strong>Cuisines:</strong> {preferences.favorite_cuisines.join(', ') || 'Varied'}</p>
                <p><strong>Meals:</strong> {preferences.meals_to_plan.join(', ')}</p>
                <p><strong>Servings:</strong> {preferences.servings}</p>
                {preferences.calorie_target && (
                  <p><strong>Calorie Target:</strong> ~{preferences.calorie_target} per meal</p>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || generateMealPlanMutation.isPending}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || generateMealPlanMutation.isPending}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {generateMealPlanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : step === 4 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Meal Plan
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
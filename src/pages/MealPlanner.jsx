import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Calendar, ChefHat, ShoppingCart, Sparkles, RefreshCw, Save, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import MealPlannerWizard from '@/components/mealplanner/MealPlannerWizard';
import WeeklyCalendar from '@/components/mealplanner/WeeklyCalendar';
import ShoppingList from '@/components/mealplanner/ShoppingList';
import moment from 'moment';

export default function MealPlanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          navigate(createPageUrl('Home'));
          return;
        }
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        navigate(createPageUrl('Home'));
      }
    };
    fetchUser();
  }, [navigate]);

  const currentWeekStart = moment().startOf('week').format('YYYY-MM-DD');

  const { data: mealPlans = [], isLoading } = useQuery({
    queryKey: ['mealPlans', currentUser?.id],
    queryFn: () => base44.entities.MealPlan.filter({ 
      user_id: currentUser.id,
      is_active: true 
    }, '-created_date'),
    enabled: !!currentUser,
  });

  const activePlan = mealPlans.find(p => p.week_start_date === currentWeekStart) || mealPlans[0];

  useEffect(() => {
    if (!isLoading && !activePlan && currentUser && !currentUser.meal_preferences) {
      setShowWizard(true);
    }
  }, [isLoading, activePlan, currentUser]);

  if (!currentUser || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl('Home'))}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AI Meal Planner</h1>
                <p className="text-sm text-slate-500">Your personalized weekly menu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWizard(true)}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                New Plan
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!activePlan ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to AI Meal Planner!</h2>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Get a personalized weekly meal plan with recipes and shopping lists based on your preferences
            </p>
            <Button
              size="lg"
              onClick={() => setShowWizard(true)}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <Sparkles className="w-5 h-5" />
              Create Your First Meal Plan
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white shadow-sm mb-6">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="w-4 h-4" />
                Weekly Plan
              </TabsTrigger>
              <TabsTrigger value="shopping" className="gap-2">
                <ShoppingCart className="w-4 h-4" />
                Shopping List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar">
              <WeeklyCalendar 
                mealPlan={activePlan} 
                currentUser={currentUser}
              />
            </TabsContent>

            <TabsContent value="shopping">
              <ShoppingList 
                mealPlan={activePlan}
                servings={activePlan.servings}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <MealPlannerWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        currentUser={currentUser}
      />
    </div>
  );
}
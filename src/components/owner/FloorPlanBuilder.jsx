import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CheckCircle, Loader2, Save, Eye, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import moment from 'moment';

import StepCreateAreas from './floorplan/StepCreateAreas';
import StepPlaceAreas from './floorplan/StepPlaceAreas';
import StepAddTables from './floorplan/StepAddTables';
import StepReview from './floorplan/StepReview';

const STEPS = [
  { id: 1, title: 'Create Areas', component: StepCreateAreas },
  { id: 2, title: 'Place Areas', component: StepPlaceAreas },
  { id: 3, title: 'Add Tables', component: StepAddTables },
  { id: 4, title: 'Review', component: StepReview }
];

export default function FloorPlanBuilder({ restaurant, onPublish }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [floorPlan, setFloorPlan] = useState({ areas: [], tables: [], version: 1 });
  const [publishedPlan, setPublishedPlan] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (restaurant?.floor_plan_data) {
      setFloorPlan(restaurant.floor_plan_data);
      setPublishedPlan(restaurant.floor_plan_data);
    }
  }, [restaurant]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFloorPlanChange = (updates) => {
    setFloorPlan(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: { ...floorPlan, isDraft: true }
      });
      toast.success('Draft saved');
      setHasChanges(false);
    } catch (e) {
      toast.error('Failed to save draft');
    }
    setIsSaving(false);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const totalSeats = floorPlan.tables.reduce((sum, t) => sum + t.seats, 0);
      
      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: { ...floorPlan, isDraft: false, publishedAt: new Date().toISOString() },
        total_seats: totalSeats,
        available_seats: totalSeats
      });

      // Sync to Table entities for Live Seating
      const existingTables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      await Promise.all(existingTables.map(t => base44.entities.Table.delete(t.id)));
      
      for (const table of floorPlan.tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape,
          area_id: table.areaId
        });
      }

      setPublishedPlan(floorPlan);
      setHasChanges(false);
      toast.success('Floor plan published! Your Live Seating tab will now use this layout.');
      onPublish?.();
    } catch (e) {
      toast.error('Failed to publish floor plan');
    }
    setIsPublishing(false);
  };

  const totalSeats = floorPlan.tables.reduce((sum, t) => sum + t.seats, 0);
  const publishedSeats = publishedPlan?.tables?.reduce((sum, t) => sum + t.seats, 0) || 0;
  const seatsDiff = totalSeats - publishedSeats;
  const percentChange = publishedSeats > 0 ? Math.round((seatsDiff / publishedSeats) * 100) : 0;

  const CurrentStepComponent = STEPS.find(s => s.id === currentStep)?.component;

  return (
    <div className="space-y-4">
      {/* Published Status Banner */}
      {publishedPlan && !hasChanges && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">
                  Floor plan published
                </span>
                <span className="text-sm text-emerald-700">
                  • Last updated {moment(publishedPlan.publishedAt).fromNow()}
                </span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">
                {publishedSeats} seats live
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {hasChanges && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">
                  You have unpublished changes
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  Save Draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div
              onClick={() => setCurrentStep(step.id)}
              className={cn(
                "flex items-center gap-2 cursor-pointer transition-all",
                currentStep === step.id ? "opacity-100" : "opacity-50 hover:opacity-75"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm",
                currentStep === step.id ? "bg-emerald-600 text-white" :
                currentStep > step.id ? "bg-emerald-100 text-emerald-700" :
                "bg-slate-100 text-slate-500"
              )}>
                {currentStep > step.id ? <CheckCircle className="w-5 h-5" /> : step.id}
              </div>
              <span className={cn(
                "text-sm font-medium hidden sm:block",
                currentStep === step.id && "text-slate-900"
              )}>
                {step.title}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2",
                currentStep > step.id ? "bg-emerald-300" : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <CurrentStepComponent
        floorPlan={floorPlan}
        onChange={handleFloorPlanChange}
        onNext={handleNext}
        onBack={handleBack}
        isFirstStep={currentStep === 1}
        isLastStep={currentStep === STEPS.length}
      />

      {/* Seat Count Summary */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalSeats}</div>
            <div className="text-xs text-slate-500">Total Seats</div>
          </div>
          {seatsDiff !== 0 && publishedPlan && (
            <Badge className={cn(
              "text-sm",
              seatsDiff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}>
              {seatsDiff > 0 ? '+' : ''}{seatsDiff} ({percentChange > 0 ? '+' : ''}{percentChange}%)
            </Badge>
          )}
          {Math.abs(percentChange) > 30 && (
            <Badge className="bg-amber-100 text-amber-700">
              <AlertCircle className="w-3 h-3 mr-1" />
              Large change
            </Badge>
          )}
        </div>

        {currentStep === STEPS.length && (
          <Button
            onClick={handlePublish}
            disabled={isPublishing || floorPlan.tables.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Publish Floor Plan
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
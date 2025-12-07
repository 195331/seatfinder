import React from 'react';
import { Plus, Trash2, Palette } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { name: 'Ocean Blue', color: '#3B82F6' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Amber', color: '#F59E0B' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Slate', color: '#64748B' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Red', color: '#EF4444' },
];

export default function StepCreateAreas({ floorPlan, onChange, onNext }) {
  const addArea = () => {
    const colorIndex = floorPlan.areas.length % PRESET_COLORS.length;
    const preset = PRESET_COLORS[colorIndex];
    const newArea = {
      id: `area-${Date.now()}`,
      name: `Area ${floorPlan.areas.length + 1}`,
      color: preset.color,
      notes: '',
      x: 0,
      y: 0,
      width: 320,
      height: 240
    };
    onChange({ areas: [...floorPlan.areas, newArea] });
  };

  const updateArea = (areaId, updates) => {
    onChange({
      areas: floorPlan.areas.map(a => a.id === areaId ? { ...a, ...updates } : a)
    });
  };

  const deleteArea = (areaId) => {
    onChange({
      areas: floorPlan.areas.filter(a => a.id !== areaId)
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Define Your Restaurant Areas</h2>
        <p className="text-slate-600">
          Create areas like "Main Dining", "Patio", or "Bar" that you'll place on your floor plan
        </p>
      </div>

      {floorPlan.areas.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="py-16 text-center">
            <Palette className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No areas yet</p>
            <Button onClick={addArea} className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Area
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {floorPlan.areas.map((area) => (
              <Card key={area.id} className="border-2 hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg shrink-0"
                      style={{ backgroundColor: area.color }}
                    />
                    <Input
                      value={area.name}
                      onChange={(e) => updateArea(area.id, { name: e.target.value })}
                      className="font-medium"
                      placeholder="Area name"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteArea(area.id)}
                      className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500">Color Theme</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => updateArea(area.id, { color: preset.color })}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all",
                            area.color === preset.color ? "border-slate-900 scale-110" : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>

                  <Textarea
                    value={area.notes || ''}
                    onChange={(e) => updateArea(area.id, { notes: e.target.value })}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="text-sm"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-center">
            <Button onClick={addArea} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Another Area
            </Button>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={floorPlan.areas.length === 0}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          size="lg"
        >
          Continue to Placement
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
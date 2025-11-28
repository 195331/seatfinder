import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle, Square, RectangleHorizontal, Armchair, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";

const TABLE_PRESETS = [
  { seats: 2, shape: 'round', icon: Circle, label: '2 Seats' },
  { seats: 4, shape: 'square', icon: Square, label: '4 Seats' },
  { seats: 6, shape: 'rectangle', icon: RectangleHorizontal, label: '6 Seats' },
  { seats: 10, shape: 'rectangle', icon: RectangleHorizontal, label: '10 Seats' },
];

export default function TablePalette({ onAddTable, isDragging }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Table Palette</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-slate-500 mb-3">
          Click a table type, then click on the canvas to place it
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_PRESETS.map(preset => {
            const Icon = preset.icon;
            return (
              <Button
                key={`${preset.seats}-${preset.shape}`}
                variant="outline"
                className={cn(
                  "h-auto py-3 flex-col gap-1 hover:bg-emerald-50 hover:border-emerald-300",
                  isDragging && "opacity-50"
                )}
                onClick={() => onAddTable(preset.seats, preset.shape)}
                disabled={isDragging}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-xs font-medium">{preset.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Custom Table */}
        <Button
          variant="outline"
          className="w-full mt-3 gap-2 hover:bg-purple-50 hover:border-purple-300"
          onClick={() => onAddTable(0, 'custom')}
          disabled={isDragging}
        >
          <Plus className="w-4 h-4" />
          Custom Table
        </Button>

        {/* Booth Option */}
        <Button
          variant="outline"
          className={cn(
            "w-full mt-2 gap-2 hover:bg-amber-50 hover:border-amber-300",
            isDragging && "opacity-50"
          )}
          onClick={() => onAddTable(4, 'booth')}
          disabled={isDragging}
        >
          <Armchair className="w-4 h-4" />
          Booth (4 seats)
        </Button>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { ArrowLeft, CheckCircle, Users, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function StepReview({ floorPlan, onBack }) {
  const totalSeats = floorPlan.tables.reduce((sum, t) => sum + t.seats, 0);
  
  const areaStats = floorPlan.areas.map(area => {
    const areaTables = floorPlan.tables.filter(t => t.areaId === area.id);
    const areaSeats = areaTables.reduce((sum, t) => sum + t.seats, 0);
    return { ...area, tableCount: areaTables.length, seats: areaSeats };
  });

  const areasWithNoTables = areaStats.filter(a => a.tableCount === 0);
  const hasIssues = areasWithNoTables.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Review Your Floor Plan</h2>
        <p className="text-slate-600">
          Check everything looks good before publishing to Live Seating
        </p>
      </div>

      {/* Warnings */}
      {hasIssues && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Warning:</strong> {areasWithNoTables.length} area(s) have no tables. 
            Consider adding tables or removing these areas before publishing.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-slate-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-slate-900 mb-1">{floorPlan.areas.length}</div>
            <div className="text-sm text-slate-500">Areas</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-slate-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-slate-900 mb-1">{floorPlan.tables.length}</div>
            <div className="text-sm text-slate-500">Tables</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-emerald-600 mb-1">{totalSeats}</div>
            <div className="text-sm text-emerald-700 font-medium">Total Seats</div>
          </CardContent>
        </Card>
      </div>

      {/* Area Breakdown */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Seating by Area</h3>
          <div className="space-y-3">
            {areaStats.map(area => (
              <div key={area.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: area.color }} />
                  <span className="font-medium">{area.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-slate-600">
                    {area.tableCount} tables
                  </div>
                  <Badge className={cn(
                    "text-sm",
                    area.seats > 0 ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"
                  )}>
                    <Users className="w-3 h-3 mr-1" />
                    {area.seats} seats
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Distribution */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Table Size Distribution</h3>
          <div className="grid grid-cols-4 gap-3">
            {[2, 4, 6, 10].map(size => {
              const count = floorPlan.tables.filter(t => t.seats === size).length;
              return (
                <div key={size} className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{count}</div>
                  <div className="text-xs text-slate-500">{size}-seat tables</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Layout Preview</h3>
          <div className="bg-slate-100 rounded-lg p-4 relative" style={{ height: 400 }}>
            {floorPlan.areas.map(area => (
              <div
                key={area.id}
                className="absolute border-2 border-dashed rounded-lg"
                style={{
                  left: area.x / 2.5,
                  top: area.y / 2.5,
                  width: area.width / 2.5,
                  height: area.height / 2.5,
                  backgroundColor: `${area.color}20`,
                  borderColor: area.color
                }}
              >
                <div className="absolute -top-2 left-1 px-1.5 py-0.5 text-[9px] font-medium rounded text-white" style={{ backgroundColor: area.color }}>
                  {area.name}
                </div>
              </div>
            ))}
            {floorPlan.tables.map(table => (
              <div
                key={table.id}
                className={cn(
                  "absolute bg-white border border-slate-300 flex items-center justify-center shadow-sm",
                  table.shape === 'circle' && "rounded-full",
                  table.shape === 'square' && "rounded",
                  (table.shape === 'rectangle' || table.shape === 'large') && "rounded"
                )}
                style={{
                  left: table.x / 2.5,
                  top: table.y / 2.5,
                  width: table.width / 2.5,
                  height: table.height / 2.5
                }}
              >
                <span className="text-[8px] font-bold text-slate-700">{table.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Ready to publish?</p>
            <p className="text-blue-700">
              Once published, this layout will be used in your <strong>Live Seating</strong> tab. 
              Your hosts will see this exact floor plan with real-time table statuses.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tables
        </Button>
      </div>
    </div>
  );
}
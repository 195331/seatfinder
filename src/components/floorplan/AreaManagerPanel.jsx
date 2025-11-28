import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function AreaManagerPanel({ 
  areas, 
  selectedAreaId, 
  onSelectArea, 
  onAddArea, 
  onUpdateArea, 
  onDeleteArea,
  areaColors,
  tables
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startEditing = (area) => {
    setEditingId(area.id);
    setEditName(area.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdateArea(editingId, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const getAreaStats = (areaId) => {
    const areaTables = tables.filter(t => t.areaId === areaId);
    return {
      tableCount: areaTables.length,
      seatCount: areaTables.reduce((sum, t) => sum + t.seats, 0)
    };
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Areas</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onAddArea}
            className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {areas.map(area => {
          const stats = getAreaStats(area.id);
          const isEditing = editingId === area.id;
          
          return (
            <div
              key={area.id}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                selectedAreaId === area.id 
                  ? "border-emerald-300 bg-emerald-50" 
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
              onClick={() => !isEditing && onSelectArea(area.id)}
            >
              {/* Color Dot */}
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: area.color }}
              />

              {/* Name */}
              {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="flex-1"
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(area); }}
                >
                  <p className="text-sm font-medium text-slate-700">{area.name}</p>
                  <p className="text-xs text-slate-500">
                    {stats.tableCount} tables · {stats.seatCount} seats
                  </p>
                </div>
              )}

              {/* Delete */}
              {!isEditing && areas.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onDeleteArea(area.id); 
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}

        {areas.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            No areas yet. Add one to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
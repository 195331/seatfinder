import React, { useState } from 'react';
import { Plus, Minus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function AreaManager({ 
  areas, 
  onAreaUpdate, 
  onAreaCreate, 
  onAreaDelete,
  isUpdating 
}) {
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaSeats, setNewAreaSeats] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddArea = () => {
    if (newAreaName.trim()) {
      onAreaCreate({
        name: newAreaName.trim(),
        max_seats: newAreaSeats,
        available_seats: newAreaSeats,
        is_open: true
      });
      setNewAreaName('');
      setNewAreaSeats(20);
      setShowAddForm(false);
    }
  };

  const handleSeatsChange = (area, delta) => {
    const newAvailable = Math.max(0, Math.min(area.max_seats, area.available_seats + delta));
    onAreaUpdate(area.id, { available_seats: newAvailable });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle>Seating Areas</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-full gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Area
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Add Area Form */}
        {showAddForm && (
          <div className="p-4 bg-slate-50 border-b space-y-3">
            <Input
              placeholder="Area name (e.g., Patio, Bar)"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <Input
                type="number"
                placeholder="Max seats"
                value={newAreaSeats}
                onChange={(e) => setNewAreaSeats(parseInt(e.target.value) || 0)}
                className="w-32"
              />
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddArea} disabled={!newAreaName.trim()}>
                  Add Area
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Areas List */}
        {areas.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No seating areas defined</p>
            <p className="text-sm mt-1">Add areas like Main Dining, Patio, Bar</p>
          </div>
        ) : (
          <div className="divide-y">
            {areas.map((area) => (
              <div 
                key={area.id}
                className={cn(
                  "p-4",
                  !area.is_open && "bg-slate-50 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-5 h-5 text-slate-300 cursor-grab" />
                    <div>
                      <h4 className="font-medium text-slate-900">{area.name}</h4>
                      <p className="text-sm text-slate-500">
                        {area.available_seats} / {area.max_seats} seats available
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Open</span>
                      <Switch
                        checked={area.is_open}
                        onCheckedChange={(checked) => onAreaUpdate(area.id, { is_open: checked })}
                        disabled={isUpdating}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAreaDelete(area.id)}
                      disabled={isUpdating}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Seating Controls */}
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeatsChange(area, -5)}
                    disabled={area.available_seats === 0 || isUpdating || !area.is_open}
                    className="h-10 w-10 rounded-xl font-semibold"
                  >
                    -5
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeatsChange(area, -1)}
                    disabled={area.available_seats === 0 || isUpdating || !area.is_open}
                    className="h-10 w-10 rounded-xl"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <div className="w-20 text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {area.available_seats}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeatsChange(area, 1)}
                    disabled={area.available_seats >= area.max_seats || isUpdating || !area.is_open}
                    className="h-10 w-10 rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeatsChange(area, 5)}
                    disabled={area.available_seats >= area.max_seats || isUpdating || !area.is_open}
                    className="h-10 w-10 rounded-xl font-semibold"
                  >
                    +5
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      area.available_seats / area.max_seats > 0.4 
                        ? "bg-emerald-500" 
                        : area.available_seats / area.max_seats > 0.15 
                          ? "bg-amber-500" 
                          : "bg-red-500"
                    )}
                    style={{ 
                      width: `${(1 - area.available_seats / area.max_seats) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
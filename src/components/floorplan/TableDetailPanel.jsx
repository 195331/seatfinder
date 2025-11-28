import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Trash2, RotateCw } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TableDetailPanel({ table, areas, onUpdate, onDelete, onClose }) {
  const handleRotate = () => {
    onUpdate({ rotation: ((table.rotation || 0) + 45) % 360 });
  };

  return (
    <Card className="w-64 shrink-0 self-start">
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Table Details</CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-7 w-7"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Label */}
        <div>
          <Label className="text-sm text-slate-600">Label</Label>
          <Input
            value={table.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Window 2"
            className="mt-1"
          />
        </div>

        {/* Seats */}
        <div>
          <Label className="text-sm text-slate-600">Seats</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={table.seats}
            onChange={(e) => onUpdate({ seats: parseInt(e.target.value) || 1 })}
            className="mt-1"
          />
        </div>

        {/* Shape */}
        <div>
          <Label className="text-sm text-slate-600">Shape</Label>
          <Select 
            value={table.shape} 
            onValueChange={(v) => onUpdate({ shape: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="rectangle">Rectangular</SelectItem>
              <SelectItem value="booth">Booth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Area */}
        <div>
          <Label className="text-sm text-slate-600">Area</Label>
          <Select 
            value={table.areaId || ''} 
            onValueChange={(v) => onUpdate({ areaId: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select area" />
            </SelectTrigger>
            <SelectContent>
              {areas.map(area => (
                <SelectItem key={area.id} value={area.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    {area.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Accessible */}
        <div className="flex items-center justify-between">
          <Label className="text-sm text-slate-600">Accessible</Label>
          <Switch
            checked={table.isAccessible}
            onCheckedChange={(checked) => onUpdate({ isAccessible: checked })}
          />
        </div>

        {/* Rotation */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleRotate}
        >
          <RotateCw className="w-4 h-4" />
          Rotate 45°
        </Button>

        {/* Delete */}
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
          Delete Table
        </Button>
      </CardContent>
    </Card>
  );
}
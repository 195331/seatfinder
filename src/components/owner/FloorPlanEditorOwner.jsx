import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFeatureAccess } from '@/components/subscription/SubscriptionPlans';

const GRID_SIZE = 20;
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

const TABLE_COLORS = {
  2: '#10B981',   // green
  4: '#3B82F6',   // blue
  6: '#8B5CF6',   // purple
  10: '#F59E0B'   // amber
};

const AREA_COLORS = [
  { name: 'Main Dining', color: '#3B82F6' },
  { name: 'Patio', color: '#10B981' },
  { name: 'Bar', color: '#8B5CF6' },
  { name: 'Private Room', color: '#F59E0B' },
];

const TABLE_TYPES = [
  { seats: 2, shape: 'square', label: '2 Seats', width: 60, height: 60 },
  { seats: 4, shape: 'square', label: '4 Seats', width: 80, height: 80 },
  { seats: 6, shape: 'rect', label: '6 Seats', width: 120, height: 70 },
  { seats: 10, shape: 'rect', label: '10 Seats', width: 160, height: 90 },
];

export default function FloorPlanEditorOwner({ restaurant, onSave }) {
  const stageRef = useRef(null);
  const featureAccess = useFeatureAccess(restaurant?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState({ 
    areas: [{
      id: 'area-1',
      name: 'Main Dining',
      color: '#3B82F6',
      x: 100,
      y: 100,
      width: 600,
      height: 400
    }],
    tables: [] 
  });
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [newTableType, setNewTableType] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    if (restaurant?.floor_plan_data) {
      setData(restaurant.floor_plan_data);
    } else {
      setData({
        areas: [{
          id: 'area-1',
          name: 'Main Dining',
          color: '#3B82F6',
          x: 100,
          y: 100,
          width: 600,
          height: 400
        }],
        tables: []
      });
    }
  }, [restaurant]);

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const totalSeats = data?.tables?.reduce((sum, t) => sum + t.seats, 0) || 0;
      
      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: data,
        total_seats: totalSeats,
        available_seats: totalSeats
      });

      const existingAreas = await base44.entities.RestaurantArea.filter({ restaurant_id: restaurant.id });
      await Promise.all(existingAreas.map(a => base44.entities.RestaurantArea.delete(a.id)));
      
      for (const area of data.areas) {
        const areaSeats = data.tables.filter(t => t.areaId === area.id).reduce((sum, t) => sum + t.seats, 0);
        await base44.entities.RestaurantArea.create({
          restaurant_id: restaurant.id,
          name: area.name,
          max_seats: areaSeats,
          available_seats: areaSeats,
          is_open: true
        });
      }

      const existingTables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      await Promise.all(existingTables.map(t => base44.entities.Table.delete(t.id)));
      
      for (const table of data.tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape
        });
      }

      toast.success("Floor plan saved!");
      onSave?.();
    } catch (e) {
      toast.error("Failed to save floor plan");
    }
    setIsSaving(false);
  };

  const addArea = () => {
    const colorIndex = data.areas.length % AREA_COLORS.length;
    const preset = AREA_COLORS[colorIndex];
    const newArea = {
      id: `area-${Date.now()}`,
      name: preset.name,
      color: preset.color,
      x: 150 + (data.areas.length * 50),
      y: 150 + (data.areas.length * 50),
      width: 400,
      height: 300
    };
    setData({ ...data, areas: [...data.areas, newArea] });
    setSelectedAreaId(newArea.id);
  };

  const updateArea = (areaId, updates) => {
    setData({
      ...data,
      areas: data.areas.map(a => a.id === areaId ? { ...a, ...updates } : a)
    });
  };

  const deleteArea = (areaId) => {
    setData({
      ...data,
      areas: data.areas.filter(a => a.id !== areaId),
      tables: data.tables.filter(t => t.areaId !== areaId)
    });
    setSelectedAreaId(null);
  };

  const addTable = (type, x, y) => {
    const tableNumber = data.tables.length + 1;
    const areaAtPosition = data.areas.find(a => 
      x >= a.x && x <= a.x + a.width &&
      y >= a.y && y <= a.y + a.height
    );
    
    const newTable = {
      id: `table-${Date.now()}`,
      label: `T${tableNumber}`,
      seats: type.seats,
      shape: type.shape,
      width: type.width,
      height: type.height,
      x: snapToGrid(x),
      y: snapToGrid(y),
      areaId: areaAtPosition?.id || data.areas[0]?.id
    };
    
    setData({ ...data, tables: [...data.tables, newTable] });
    setSelectedTableId(newTable.id);
    setNewTableType(null);
  };

  const updateTable = (tableId, updates) => {
    setData({
      ...data,
      tables: data.tables.map(t => t.id === tableId ? { ...t, ...updates } : t)
    });
  };

  const deleteTable = (tableId) => {
    setData({
      ...data,
      tables: data.tables.filter(t => t.id !== tableId)
    });
    setSelectedTableId(null);
  };

  const handleStageClick = (e) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const clickedOnEmpty = e.target === stage;
    if (clickedOnEmpty) {
      setSelectedTableId(null);
      setSelectedAreaId(null);
      
      if (newTableType) {
        const pointerPos = stage.getPointerPosition();
        const relX = (pointerPos.x - camera.x) / camera.scale;
        const relY = (pointerPos.y - camera.y) / camera.scale;
        addTable(newTableType, relX, relY);
      }
    }
  };

  const handleTableDragEnd = (tableId, newPos) => {
    updateTable(tableId, { x: snapToGrid(newPos.x), y: snapToGrid(newPos.y) });
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const pointer = stage.getPointerPosition();
    const oldScale = camera.scale;
    const newScale = camera.scale * (e.evt.deltaY > 0 ? 0.9 : 1.1);
    const clampedScale = Math.max(0.5, Math.min(3, newScale));
    
    const mousePointTo = {
      x: (pointer.x - camera.x) / oldScale,
      y: (pointer.y - camera.y) / oldScale
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale
    };

    setCamera({ x: newPos.x, y: newPos.y, scale: clampedScale });
  };

  const totalSeats = data?.tables?.reduce((sum, t) => sum + t.seats, 0) || 0;

  return (
    <div className="flex gap-4">
      {/* Left Sidebar */}
      <div className="w-64 shrink-0 space-y-4 overflow-y-auto max-h-screen">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Table Types</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {TABLE_TYPES.map(type => (
              <button
                key={type.seats}
                onClick={() => setNewTableType(newTableType?.seats === type.seats ? null : type)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg border transition-all",
                  newTableType?.seats === type.seats ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div 
                  className="w-8 h-8 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: TABLE_COLORS[type.seats], borderRadius: '4px' }}
                >
                  {type.seats}
                </div>
                <span className="text-sm">{type.label}</span>
              </button>
            ))}
            {newTableType && (
              <p className="text-xs text-blue-600 text-center p-2 bg-blue-50 rounded">Click canvas to place</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Areas</CardTitle>
            <Button size="sm" variant="ghost" onClick={addArea} className="h-6 gap-1">
              <Plus className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data?.areas?.map(area => (
              <div
                key={area.id}
                onClick={() => setSelectedAreaId(area.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer",
                  selectedAreaId === area.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                )}
              >
                <div className="w-3 h-3 rounded" style={{ backgroundColor: area.color }} />
                <Input
                  value={area.name}
                  onChange={(e) => updateArea(area.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                />
                {data.areas.length > 1 && (
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); deleteArea(area.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{totalSeats}</div>
            <div className="text-xs text-slate-500">Total Seats</div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Floor Plan
        </Button>

        {selectedTableId && (
          <Card>
            <CardContent className="py-3 space-y-2">
              <Input
                value={data.tables.find(t => t.id === selectedTableId)?.label || ''}
                onChange={(e) => updateTable(selectedTableId, { label: e.target.value })}
                placeholder="Table label"
                className="h-8"
              />
              <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteTable(selectedTableId)}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onWheel={handleWheel}
          onClick={handleStageClick}
          scaleX={camera.scale}
          scaleY={camera.scale}
          x={camera.x}
          y={camera.y}
          draggable={true}
          onDragEnd={(e) => setCamera(c => ({ ...c, x: e.target.x(), y: e.target.y() }))}
        >
          <Layer>
            {/* Areas */}
            {data?.areas?.map(area => (
              <Group key={area.id}>
                <Rect
                  x={area.x}
                  y={area.y}
                  width={area.width}
                  height={area.height}
                  fill={area.color}
                  opacity={0.1}
                  stroke={area.color}
                  strokeWidth={2}
                  dash={[5, 5]}
                />
                <Text
                  x={area.x + 5}
                  y={area.y - 20}
                  text={area.name}
                  fontSize={14}
                  fontStyle="bold"
                  fill={area.color}
                />
              </Group>
            ))}

            {/* Tables */}
            {data?.tables?.map(table => (
              <Group
                key={table.id}
                draggable={true}
                onDragEnd={(e) => handleTableDragEnd(table.id, { x: e.target.x(), y: e.target.y() })}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setSelectedTableId(table.id);
                }}
              >
                <Rect
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  fill={TABLE_COLORS[table.seats] || '#94a3b8'}
                  stroke={selectedTableId === table.id ? '#fff' : 'transparent'}
                  strokeWidth={selectedTableId === table.id ? 3 : 0}
                  cornerRadius={4}
                />
                <Text
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  text={table.label}
                  fontSize={12}
                  fontStyle="bold"
                  fill="white"
                  align="center"
                  verticalAlign="middle"
                  pointerEvents="none"
                />
                <Text
                  x={table.x}
                  y={table.y + table.height / 2}
                  width={table.width}
                  height={table.height / 2}
                  text={`${table.seats}`}
                  fontSize={16}
                  fontStyle="bold"
                  fill="white"
                  align="center"
                  verticalAlign="middle"
                  pointerEvents="none"
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
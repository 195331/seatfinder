import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Move, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GRID_SIZE = 40;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const AREA_COLORS = [
  { name: 'Main Dining', color: '#3B82F6' },
  { name: 'Patio', color: '#10B981' },
  { name: 'Bar', color: '#8B5CF6' },
  { name: 'Private Room', color: '#F59E0B' },
  { name: 'Lounge', color: '#EC4899' },
];

const TABLE_TYPES = [
  { seats: 2, shape: 'circle', label: '2 Seats', icon: '●', width: 40, height: 40 },
  { seats: 4, shape: 'square', label: '4 Seats', icon: '■', width: 50, height: 50 },
  { seats: 6, shape: 'rectangle', label: '6 Seats', icon: '▬', width: 80, height: 50 },
  { seats: 10, shape: 'large', label: '10 Seats', icon: '╋', width: 100, height: 60 },
];

export default function FloorPlanEditor({ data, onChange, restaurantName }) {
  const canvasRef = useRef(null);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [draggedTable, setDraggedTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingArea, setResizingArea] = useState(null);
  const [draggingArea, setDraggingArea] = useState(null);
  const [areaResizeStart, setAreaResizeStart] = useState(null);
  const [newTableType, setNewTableType] = useState(null);

  // Initialize with a default area
  useEffect(() => {
    if (data.areas.length === 0) {
      onChange({
        ...data,
        areas: [{
          id: 'area-1',
          name: 'Main Dining',
          color: '#3B82F6',
          x: GRID_SIZE,
          y: GRID_SIZE,
          width: GRID_SIZE * 12,
          height: GRID_SIZE * 10
        }]
      });
    }
  }, []);

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const addArea = () => {
    const colorIndex = data.areas.length % AREA_COLORS.length;
    const preset = AREA_COLORS[colorIndex];
    const newArea = {
      id: `area-${Date.now()}`,
      name: preset.name,
      color: preset.color,
      x: GRID_SIZE * 2 + (data.areas.length * GRID_SIZE),
      y: GRID_SIZE * 2 + (data.areas.length * GRID_SIZE),
      width: GRID_SIZE * 8,
      height: GRID_SIZE * 6
    };
    onChange({ ...data, areas: [...data.areas, newArea] });
    setSelectedAreaId(newArea.id);
  };

  const updateArea = (areaId, updates) => {
    onChange({
      ...data,
      areas: data.areas.map(a => a.id === areaId ? { ...a, ...updates } : a)
    });
  };

  const deleteArea = (areaId) => {
    onChange({
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
    
    onChange({ ...data, tables: [...data.tables, newTable] });
    setSelectedTableId(newTable.id);
    setNewTableType(null);
  };

  const updateTable = (tableId, updates) => {
    onChange({
      ...data,
      tables: data.tables.map(t => t.id === tableId ? { ...t, ...updates } : t)
    });
  };

  const deleteTable = (tableId) => {
    onChange({
      ...data,
      tables: data.tables.filter(t => t.id !== tableId)
    });
    setSelectedTableId(null);
  };

  // Mouse handlers for canvas
  const handleCanvasMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (newTableType) {
      addTable(newTableType, x - newTableType.width / 2, y - newTableType.height / 2);
      return;
    }

    setSelectedTableId(null);
    setSelectedAreaId(null);
  };

  const handleTableMouseDown = (e, table) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggedTable(table.id);
    setDragOffset({
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y
    });
    setSelectedTableId(table.id);
    setSelectedAreaId(null);
  };

  const handleAreaMouseDown = (e, area, isResize = false) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    
    if (isResize) {
      setResizingArea(area.id);
      setAreaResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: area.width,
        height: area.height
      });
    } else {
      setDraggingArea(area.id);
      setDragOffset({
        x: e.clientX - rect.left - area.x,
        y: e.clientY - rect.top - area.y
      });
    }
    setSelectedAreaId(area.id);
    setSelectedTableId(null);
  };

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggedTable) {
      const newX = snapToGrid(Math.max(0, Math.min(CANVAS_WIDTH - 60, x - dragOffset.x)));
      const newY = snapToGrid(Math.max(0, Math.min(CANVAS_HEIGHT - 60, y - dragOffset.y)));
      
      // Find which area the table is in
      const areaAtPosition = data.areas.find(a => 
        newX >= a.x && newX <= a.x + a.width &&
        newY >= a.y && newY <= a.y + a.height
      );
      
      updateTable(draggedTable, { 
        x: newX, 
        y: newY,
        areaId: areaAtPosition?.id || data.tables.find(t => t.id === draggedTable)?.areaId
      });
    }

    if (draggingArea) {
      const newX = snapToGrid(Math.max(0, x - dragOffset.x));
      const newY = snapToGrid(Math.max(0, y - dragOffset.y));
      updateArea(draggingArea, { x: newX, y: newY });
    }

    if (resizingArea && areaResizeStart) {
      const deltaX = e.clientX - areaResizeStart.x;
      const deltaY = e.clientY - areaResizeStart.y;
      const newWidth = snapToGrid(Math.max(GRID_SIZE * 3, areaResizeStart.width + deltaX));
      const newHeight = snapToGrid(Math.max(GRID_SIZE * 3, areaResizeStart.height + deltaY));
      updateArea(resizingArea, { width: newWidth, height: newHeight });
    }
  }, [draggedTable, draggingArea, resizingArea, dragOffset, areaResizeStart, data]);

  const handleMouseUp = useCallback(() => {
    setDraggedTable(null);
    setDraggingArea(null);
    setResizingArea(null);
    setAreaResizeStart(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const totalSeats = data.tables.reduce((sum, t) => sum + t.seats, 0);

  const getTableShape = (table, isSelected) => {
    const baseClasses = cn(
      "absolute flex items-center justify-center cursor-move transition-all border-2 shadow-sm",
      isSelected ? "ring-2 ring-emerald-400 border-emerald-500 shadow-lg z-20" : "border-slate-400 hover:border-slate-500 z-10",
      draggedTable === table.id && "opacity-75"
    );

    const shapeStyles = {
      circle: "rounded-full bg-white",
      square: "rounded-lg bg-white",
      rectangle: "rounded-lg bg-white",
      large: "rounded-lg bg-white"
    };

    return (
      <div
        key={table.id}
        className={cn(baseClasses, shapeStyles[table.shape])}
        style={{
          left: table.x,
          top: table.y,
          width: table.width,
          height: table.height,
        }}
        onMouseDown={(e) => handleTableMouseDown(e, table)}
      >
        <div className="text-center pointer-events-none">
          <div className="text-xs font-bold text-slate-700">{table.label}</div>
          <div className="text-[10px] text-slate-500">{table.seats}</div>
        </div>
        {table.shape === 'large' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-slate-300 absolute" />
            <div className="w-0.5 h-full bg-slate-300 absolute" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-4 p-4 max-w-[1400px] mx-auto">
      {/* Left Sidebar */}
      <div className="w-72 shrink-0 space-y-4">
        {/* Table Palette */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Table Types (Click then place)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {TABLE_TYPES.map(type => (
              <button
                key={type.seats}
                onClick={() => setNewTableType(newTableType?.seats === type.seats ? null : type)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                  newTableType?.seats === type.seats
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center border-2 border-slate-400",
                  type.shape === 'circle' && "rounded-full",
                  type.shape === 'square' && "rounded-lg",
                  type.shape === 'rectangle' && "rounded-lg w-14 h-8",
                  type.shape === 'large' && "rounded-lg w-14 h-8 relative"
                )}>
                  <span className="text-xs font-bold">{type.seats}</span>
                  {type.shape === 'large' && (
                    <>
                      <div className="absolute w-full h-px bg-slate-300" />
                      <div className="absolute w-px h-full bg-slate-300" />
                    </>
                  )}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
            
            {newTableType && (
              <div className="p-2 bg-blue-50 rounded-lg text-xs text-blue-700 text-center">
                Click on the canvas to place table
              </div>
            )}
          </CardContent>
        </Card>

        {/* Areas */}
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Areas</CardTitle>
            <Button size="sm" variant="ghost" onClick={addArea} className="h-7 gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data.areas.map(area => {
              const areaSeats = data.tables.filter(t => t.areaId === area.id).reduce((sum, t) => sum + t.seats, 0);
              return (
                <div
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                    selectedAreaId === area.id
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div
                    className="w-4 h-4 rounded shrink-0"
                    style={{ backgroundColor: area.color }}
                  />
                  <Input
                    value={area.name}
                    onChange={(e) => updateArea(area.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
                  />
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {areaSeats} seats
                  </Badge>
                  {data.areas.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteArea(area.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900">{totalSeats}</div>
              <div className="text-sm text-slate-500">Total Seats</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-lg font-semibold">{data.tables.length}</div>
                <div className="text-xs text-slate-500">Tables</div>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-lg font-semibold">{data.areas.length}</div>
                <div className="text-xs text-slate-500">Areas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Table Options */}
        {selectedTableId && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Selected Table</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div>
                <label className="text-xs text-slate-500">Label</label>
                <Input
                  value={data.tables.find(t => t.id === selectedTableId)?.label || ''}
                  onChange={(e) => updateTable(selectedTableId, { label: e.target.value })}
                  className="h-8 mt-1"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteTable(selectedTableId)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Table
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">{restaurantName || 'Your Restaurant'} - Floor Plan</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Move className="w-4 h-4" />
            Drag tables and areas to position
          </div>
        </div>
        
        <div
          ref={canvasRef}
          className={cn(
            "relative bg-white rounded-xl border-2 border-slate-200 overflow-hidden",
            newTableType && "cursor-crosshair"
          )}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Grid */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e2e8f0" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Areas */}
          {data.areas.map(area => (
            <div
              key={area.id}
              className={cn(
                "absolute border-2 border-dashed rounded-lg transition-shadow",
                selectedAreaId === area.id ? "shadow-lg" : "",
                draggingArea === area.id && "opacity-75"
              )}
              style={{
                left: area.x,
                top: area.y,
                width: area.width,
                height: area.height,
                backgroundColor: `${area.color}20`,
                borderColor: area.color,
                cursor: 'move'
              }}
              onMouseDown={(e) => handleAreaMouseDown(e, area)}
            >
              {/* Area Label */}
              <div
                className="absolute -top-3 left-2 px-2 py-0.5 text-xs font-medium rounded text-white"
                style={{ backgroundColor: area.color }}
              >
                {area.name}
              </div>
              
              {/* Resize Handle */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                style={{ backgroundColor: area.color }}
                onMouseDown={(e) => handleAreaMouseDown(e, area, true)}
              />
            </div>
          ))}

          {/* Tables */}
          {data.tables.map(table => getTableShape(table, selectedTableId === table.id))}

          {/* Empty state */}
          {data.tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-slate-400">
                <div className="text-4xl mb-2">🪑</div>
                <p className="text-sm">Select a table type and click to place</p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs font-medium text-slate-600 mb-2">Table Legend</p>
          <div className="flex gap-4">
            {TABLE_TYPES.map(type => (
              <div key={type.seats} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 border-2 border-slate-400 flex items-center justify-center text-[8px] font-bold",
                  type.shape === 'circle' && "rounded-full",
                  type.shape === 'square' && "rounded",
                  (type.shape === 'rectangle' || type.shape === 'large') && "rounded w-8 h-5"
                )}>
                  {type.seats}
                </div>
                <span className="text-xs text-slate-600">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
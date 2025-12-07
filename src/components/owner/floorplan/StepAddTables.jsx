import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Copy, Trash2, Edit3, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GRID_SIZE = 40;
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

const TABLE_TYPES = [
  { seats: 2, shape: 'circle', label: '2-Top', width: 40, height: 40 },
  { seats: 4, shape: 'square', label: '4-Top', width: 50, height: 50 },
  { seats: 6, shape: 'rectangle', label: '6-Top', width: 80, height: 50 },
  { seats: 10, shape: 'large', label: '10-Top', width: 100, height: 60 },
];

export default function StepAddTables({ floorPlan, onChange, onNext, onBack }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [draggedTable, setDraggedTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedTables, setSelectedTables] = useState(new Set());
  const [editingTable, setEditingTable] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const getNextTableNumber = () => {
    const existingNumbers = floorPlan.tables.map(t => {
      const match = t.label.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  };

  const addTable = (type, x, y) => {
    const tableNumber = getNextTableNumber();
    const areaAtPosition = floorPlan.areas.find(a =>
      x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height
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
      areaId: areaAtPosition?.id
    };

    onChange({ tables: [...floorPlan.tables, newTable] });
    setSelectedType(null);
  };

  const updateTable = (tableId, updates) => {
    onChange({
      tables: floorPlan.tables.map(t => t.id === tableId ? { ...t, ...updates } : t)
    });
  };

  const deleteTable = (tableId) => {
    onChange({ tables: floorPlan.tables.filter(t => t.id !== tableId) });
    setSelectedTables(prev => {
      const next = new Set(prev);
      next.delete(tableId);
      return next;
    });
    setEditingTable(null);
  };

  const duplicateTable = (table) => {
    const newTable = {
      ...table,
      id: `table-${Date.now()}`,
      label: `T${getNextTableNumber()}`,
      x: snapToGrid(table.x + 50),
      y: snapToGrid(table.y + 50)
    };
    onChange({ tables: [...floorPlan.tables, newTable] });
  };

  const deleteSelected = () => {
    onChange({
      tables: floorPlan.tables.filter(t => !selectedTables.has(t.id))
    });
    setSelectedTables(new Set());
    setEditingTable(null);
  };

  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (selectedType) {
      addTable(selectedType, x - selectedType.width / 2, y - selectedType.height / 2);
    }
  };

  const handleTableMouseDown = (e, table) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggedTable(table.id);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - table.x,
      y: (e.clientY - rect.top) / zoom - table.y
    });

    if (!e.shiftKey) {
      setSelectedTables(new Set([table.id]));
    } else {
      setSelectedTables(prev => {
        const next = new Set(prev);
        next.add(table.id);
        return next;
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current || !draggedTable) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    const table = floorPlan.tables.find(t => t.id === draggedTable);
    if (!table) return;

    const newX = snapToGrid(Math.max(0, Math.min(CANVAS_WIDTH - table.width, x - dragOffset.x)));
    const newY = snapToGrid(Math.max(0, Math.min(CANVAS_HEIGHT - table.height, y - dragOffset.y)));

    const areaAtPosition = floorPlan.areas.find(a =>
      newX >= a.x && newX <= a.x + a.width && newY >= a.y && newY <= a.y + a.height
    );

    updateTable(draggedTable, { x: newX, y: newY, areaId: areaAtPosition?.id });
  }, [draggedTable, dragOffset, zoom, floorPlan]);

  const handleMouseUp = useCallback(() => {
    setDraggedTable(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (selectedTables.size === 1) {
      const tableId = Array.from(selectedTables)[0];
      const table = floorPlan.tables.find(t => t.id === tableId);
      setEditingTable(table);
    } else {
      setEditingTable(null);
    }
  }, [selectedTables, floorPlan.tables]);

  return (
    <div className="flex gap-4">
      {/* Left Panel */}
      <div className="w-64 shrink-0 space-y-4">
        <Card>
          <CardContent className="py-4 space-y-2">
            <h3 className="font-semibold text-sm mb-3">Table Types</h3>
            {TABLE_TYPES.map(type => (
              <button
                key={type.seats}
                onClick={() => setSelectedType(selectedType?.seats === type.seats ? null : type)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                  selectedType?.seats === type.seats ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center border-2 border-slate-400 text-sm font-bold bg-white",
                  type.shape === 'circle' && "rounded-full",
                  type.shape === 'square' && "rounded",
                  (type.shape === 'rectangle' || type.shape === 'large') && "rounded w-12 h-8"
                )}>
                  {type.seats}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {selectedTables.size > 0 && (
          <Card>
            <CardContent className="py-4 space-y-2">
              <h3 className="font-semibold text-sm mb-2">Selected ({selectedTables.size})</h3>
              {selectedTables.size === 1 && editingTable && (
                <Input
                  value={editingTable.label}
                  onChange={(e) => {
                    const table = floorPlan.tables.find(t => t.id === editingTable.id);
                    if (table) {
                      updateTable(table.id, { label: e.target.value });
                      setEditingTable({ ...table, label: e.target.value });
                    }
                  }}
                  placeholder="Table label"
                  className="h-8"
                />
              )}
              <Button
                size="sm"
                variant="destructive"
                className="w-full gap-2"
                onClick={deleteSelected}
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Badge variant="outline" className="flex-1 justify-center">{Math.round(zoom * 100)}%</Badge>
          <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 space-y-4">
        {selectedType && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-700">Click on the floor plan to place a {selectedType.label}</span>
          </div>
        )}

        <div className="bg-slate-100 rounded-xl overflow-hidden">
          <div
            ref={canvasRef}
            className={cn("relative bg-white", selectedType && "cursor-crosshair")}
            style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}
            onClick={handleCanvasClick}
          >
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              <defs>
                <pattern id="tableGrid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#tableGrid)" />
            </svg>

            {/* Areas */}
            {floorPlan.areas.map(area => (
              <div
                key={area.id}
                className="absolute border-2 border-dashed rounded-lg pointer-events-none"
                style={{
                  left: area.x * zoom,
                  top: area.y * zoom,
                  width: area.width * zoom,
                  height: area.height * zoom,
                  backgroundColor: `${area.color}15`,
                  borderColor: `${area.color}50`
                }}
              >
                <div className="absolute -top-2 left-2 px-2 py-0.5 text-[10px] font-medium rounded text-white" style={{ backgroundColor: area.color }}>
                  {area.name}
                </div>
              </div>
            ))}

            {/* Tables */}
            {floorPlan.tables.map(table => {
              const isSelected = selectedTables.has(table.id);
              return (
                <div
                  key={table.id}
                  className={cn(
                    "absolute flex flex-col items-center justify-center cursor-move transition-all border-2 shadow-sm group",
                    isSelected ? "ring-2 ring-emerald-400 border-emerald-500 shadow-lg z-20" : "border-slate-400 hover:border-slate-600 z-10",
                    table.shape === 'circle' && "rounded-full",
                    table.shape === 'square' && "rounded-lg",
                    (table.shape === 'rectangle' || table.shape === 'large') && "rounded-lg"
                  )}
                  style={{
                    left: table.x * zoom,
                    top: table.y * zoom,
                    width: table.width * zoom,
                    height: table.height * zoom,
                    backgroundColor: 'white'
                  }}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onDoubleClick={() => setEditingTable(table)}
                >
                  <div className="text-center pointer-events-none">
                    <div className="font-bold text-slate-900" style={{ fontSize: 11 * zoom }}>{table.label}</div>
                    <div className="text-slate-500" style={{ fontSize: 9 * zoom }}>{table.seats} seats</div>
                  </div>
                  {isSelected && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-lg shadow-lg p-1 border border-slate-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateTable(table); }}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                        className="p-1 hover:bg-red-50 rounded text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {floorPlan.tables.length === 0 && !selectedType && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">🪑</div>
                  <p className="text-sm">Select a table type and click to place</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={floorPlan.tables.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            size="lg"
          >
            Review & Publish
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
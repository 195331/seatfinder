import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  ZoomIn, ZoomOut, Maximize2, RotateCw, Copy, Trash2, 
  Move, Grid3x3, AlertCircle, CheckCircle, Save, Loader2,
  AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, Undo, Redo
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const MIN_SPACING = 12;

const TABLE_SHAPES = {
  round: { label: 'Round', path: 'circle' },
  square: { label: 'Square', path: 'rect' },
  rectangle: { label: 'Rectangle', path: 'rect' },
  booth: { label: 'Booth', path: 'rect' }
};

const TABLE_STATES = {
  free: { color: '#f1f5f9', borderColor: '#cbd5e1', label: 'Free' },
  occupied: { color: '#fed7aa', borderColor: '#fdba74', label: 'Occupied' },
  reserved: { color: '#bfdbfe', borderColor: '#93c5fd', label: 'Reserved' }
};

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const canvasRef = useRef(null);
  const [outline, setOutline] = useState(null);
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [draggedTable, setDraggedTable] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [mode, setMode] = useState('select'); // select | draw-outline | draw-area | add-table
  const [snapEnabled, setSnapEnabled] = useState({ edges: true, center: true, tables: true, outline: true });
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing floor plan
  useEffect(() => {
    if (restaurant?.floor_plan_data) {
      const data = restaurant.floor_plan_data;
      setOutline(data.outline || null);
      setAreas(data.areas || []);
      setTables(data.tables || []);
      saveToHistory();
    }
  }, [restaurant]);

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ outline, areas, tables: [...tables] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setOutline(prevState.outline);
      setAreas(prevState.areas);
      setTables(prevState.tables);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setOutline(nextState.outline);
      setAreas(nextState.areas);
      setTables(nextState.tables);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Collision detection
  const checkCollision = (table1, table2) => {
    const padding = MIN_SPACING;
    return !(
      table1.x + table1.width + padding < table2.x ||
      table1.x > table2.x + table2.width + padding ||
      table1.y + table1.height + padding < table2.y ||
      table1.y > table2.y + table2.height + padding
    );
  };

  const isInsideOutline = (table) => {
    if (!outline) return true;
    const centerX = table.x + table.width / 2;
    const centerY = table.y + table.height / 2;
    
    // Check if center is inside rectangle outline
    return centerX >= outline.x && 
           centerX <= outline.x + outline.width &&
           centerY >= outline.y && 
           centerY <= outline.y + outline.height;
  };

  const findNearestValidPosition = (table) => {
    if (!outline) return table;
    
    let newX = table.x;
    let newY = table.y;
    
    // Push inside outline bounds
    if (newX < outline.x) newX = outline.x + MIN_SPACING;
    if (newX + table.width > outline.x + outline.width) newX = outline.x + outline.width - table.width - MIN_SPACING;
    if (newY < outline.y) newY = outline.y + MIN_SPACING;
    if (newY + table.height > outline.y + outline.height) newY = outline.y + outline.height - table.height - MIN_SPACING;
    
    return { ...table, x: newX, y: newY };
  };

  const applySnapping = (table) => {
    let snappedX = table.x;
    let snappedY = table.y;
    const snapThreshold = 10;
    
    if (snapEnabled.outline && outline) {
      // Snap to outline edges
      if (Math.abs(table.x - outline.x) < snapThreshold) snappedX = outline.x;
      if (Math.abs(table.x + table.width - (outline.x + outline.width)) < snapThreshold) 
        snappedX = outline.x + outline.width - table.width;
      if (Math.abs(table.y - outline.y) < snapThreshold) snappedY = outline.y;
      if (Math.abs(table.y + table.height - (outline.y + outline.height)) < snapThreshold) 
        snappedY = outline.y + outline.height - table.height;
    }
    
    if (snapEnabled.center && outline) {
      // Snap to center
      const centerX = outline.x + outline.width / 2;
      const centerY = outline.y + outline.height / 2;
      const tableCenterX = table.x + table.width / 2;
      const tableCenterY = table.y + table.height / 2;
      
      if (Math.abs(tableCenterX - centerX) < snapThreshold) 
        snappedX = centerX - table.width / 2;
      if (Math.abs(tableCenterY - centerY) < snapThreshold) 
        snappedY = centerY - table.height / 2;
    }
    
    if (snapEnabled.tables) {
      // Snap to other tables
      tables.forEach(other => {
        if (other.id === table.id) return;
        
        if (Math.abs(table.x - other.x) < snapThreshold) snappedX = other.x;
        if (Math.abs(table.x - (other.x + other.width)) < snapThreshold) snappedX = other.x + other.width;
        if (Math.abs(table.y - other.y) < snapThreshold) snappedY = other.y;
        if (Math.abs(table.y - (other.y + other.height)) < snapThreshold) snappedY = other.y + other.height;
      });
    }
    
    return { ...table, x: snappedX, y: snappedY };
  };

  const addTable = (x, y) => {
    const newTable = {
      id: Date.now() + Math.random(),
      x,
      y,
      width: 80,
      height: 80,
      seats: 4,
      label: `T${tables.length + 1}`,
      shape: 'round',
      rotation: 0,
      state: 'free'
    };
    
    setTables([...tables, newTable]);
    saveToHistory();
  };

  const updateTable = (id, updates) => {
    setTables(tables.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTable = (id) => {
    setTables(tables.filter(t => t.id !== id));
    if (selectedTable?.id === id) setSelectedTable(null);
    saveToHistory();
  };

  const duplicateTable = (table) => {
    const newTable = {
      ...table,
      id: Date.now() + Math.random(),
      x: table.x + 20,
      y: table.y + 20,
      label: `${table.label}-copy`
    };
    setTables([...tables, newTable]);
    saveToHistory();
  };

  const validateFloorPlan = () => {
    const newErrors = [];
    
    if (!outline) {
      newErrors.push({ type: 'critical', message: 'Restaurant outline is required' });
    }
    
    if (tables.length === 0) {
      newErrors.push({ type: 'critical', message: 'At least one table is required' });
    }
    
    // Check overlaps
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        if (checkCollision(tables[i], tables[j])) {
          newErrors.push({ 
            type: 'error', 
            message: `Tables ${tables[i].label} and ${tables[j].label} are overlapping` 
          });
        }
      }
      
      if (!isInsideOutline(tables[i])) {
        newErrors.push({ 
          type: 'error', 
          message: `Table ${tables[i].label} is outside the outline` 
        });
      }
    }
    
    setErrors(newErrors);
    return newErrors.filter(e => e.type === 'critical').length === 0;
  };

  const handlePublish = async () => {
    if (!validateFloorPlan()) {
      toast.error('Please fix all errors before publishing');
      return;
    }
    
    setIsSaving(true);
    try {
      const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0);
      const floorPlanData = { outline, areas, tables, publishedAt: new Date().toISOString() };
      
      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: floorPlanData,
        total_seats: totalSeats,
        available_seats: totalSeats
      });
      
      // Sync tables
      const existingTables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      await Promise.all(existingTables.map(t => base44.entities.Table.delete(t.id)));
      
      for (const table of tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape,
          rotation: table.rotation
        });
      }
      
      toast.success('Floor plan published!');
      onPublish?.();
    } catch (e) {
      toast.error('Failed to publish');
    }
    setIsSaving(false);
  };

  const handleCanvasClick = (e) => {
    if (mode === 'add-table') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      addTable(x, y);
      setMode('select');
    }
  };

  const handleTableMouseDown = (e, table) => {
    e.stopPropagation();
    setSelectedTable(table);
    setDraggedTable(table);
  };

  const handleMouseMove = (e) => {
    if (isPanning && panStart) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y)
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
    
    if (draggedTable) {
      const rect = canvasRef.current.getBoundingClientRect();
      let newX = (e.clientX - rect.left - pan.x) / zoom - draggedTable.width / 2;
      let newY = (e.clientY - rect.top - pan.y) / zoom - draggedTable.height / 2;
      
      let updatedTable = { ...draggedTable, x: newX, y: newY };
      updatedTable = applySnapping(updatedTable);
      
      // Check collisions
      const hasCollision = tables.some(t => 
        t.id !== updatedTable.id && checkCollision(updatedTable, t)
      );
      
      if (!hasCollision && isInsideOutline(updatedTable)) {
        updateTable(draggedTable.id, { x: updatedTable.x, y: updatedTable.y });
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedTable) {
      saveToHistory();
      setDraggedTable(null);
    }
    setIsPanning(false);
    setPanStart(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'select' ? 'default' : 'outline'}
              onClick={() => setMode('select')}
            >
              <Move className="w-4 h-4 mr-1" />
              Select
            </Button>
            <Button
              size="sm"
              variant={mode === 'add-table' ? 'default' : 'outline'}
              onClick={() => setMode('add-table')}
            >
              + Table
            </Button>
            <Button
              size="sm"
              variant={mode === 'draw-outline' ? 'default' : 'outline'}
              onClick={() => setMode('draw-outline')}
            >
              Draw Outline
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={snapEnabled.edges} onCheckedChange={v => setSnapEnabled({...snapEnabled, edges: v})} />
              Snap edges
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={snapEnabled.tables} onCheckedChange={v => setSnapEnabled({...snapEnabled, tables: v})} />
              Snap tables
            </label>
          </div>
        </div>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <span className="text-red-800">{err.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Canvas */}
      <Card className="relative overflow-hidden" style={{ height: '600px' }}>
        <div
          ref={canvasRef}
          className="absolute inset-0 bg-slate-50 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={(e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY });
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            width="100%"
            height="100%"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            {/* Grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />
            
            {/* Outline */}
            {outline && (
              <rect
                x={outline.x}
                y={outline.y}
                width={outline.width}
                height={outline.height}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}
            
            {/* Tables */}
            {tables.map(table => {
              const isSelected = selectedTable?.id === table.id;
              const state = TABLE_STATES[table.state];
              
              return (
                <g
                  key={table.id}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  style={{ cursor: 'move' }}
                  transform={`rotate(${table.rotation}, ${table.x + table.width/2}, ${table.y + table.height/2})`}
                >
                  {/* Shadow */}
                  <ellipse
                    cx={table.x + table.width/2}
                    cy={table.y + table.height + 5}
                    rx={table.width/2}
                    ry={5}
                    fill="#00000010"
                  />
                  
                  {/* Table */}
                  {table.shape === 'round' ? (
                    <circle
                      cx={table.x + table.width/2}
                      cy={table.y + table.height/2}
                      r={table.width/2}
                      fill={state.color}
                      stroke={isSelected ? '#10b981' : state.borderColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : (
                    <rect
                      x={table.x}
                      y={table.y}
                      width={table.width}
                      height={table.height}
                      rx={8}
                      fill={state.color}
                      stroke={isSelected ? '#10b981' : state.borderColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  )}
                  
                  {/* Label */}
                  <text
                    x={table.x + table.width/2}
                    y={table.y + table.height/2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-sm font-semibold"
                    fill="#475569"
                  >
                    {table.label}
                  </text>
                  
                  {/* Seat dots */}
                  {[...Array(table.seats)].map((_, i) => {
                    const angle = (i / table.seats) * Math.PI * 2;
                    const radius = table.width / 2 + 15;
                    const dotX = table.x + table.width/2 + Math.cos(angle) * radius;
                    const dotY = table.y + table.height/2 + Math.sin(angle) * radius;
                    return <circle key={i} cx={dotX} cy={dotY} r={4} fill="#94a3b8" />;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      {/* Selected Table Toolbar */}
      {selectedTable && (
        <Card className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Label:</label>
              <Input
                value={selectedTable.label}
                onChange={(e) => updateTable(selectedTable.id, { label: e.target.value })}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Seats:</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={selectedTable.seats}
                onChange={(e) => updateTable(selectedTable.id, { seats: parseInt(e.target.value) })}
                className="w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Shape:</label>
              <Select
                value={selectedTable.shape}
                onValueChange={(v) => updateTable(selectedTable.id, { shape: v })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TABLE_SHAPES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => updateTable(selectedTable.id, { rotation: (selectedTable.rotation + 45) % 360 })}>
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicateTable(selectedTable)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteTable(selectedTable.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Publish */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{tables.reduce((s, t) => s + t.seats, 0)} Total Seats</div>
          <div className="text-sm text-slate-500">{tables.length} tables</div>
        </div>
        <Button onClick={handlePublish} disabled={isSaving || errors.filter(e => e.type === 'critical').length > 0} className="bg-emerald-600">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          Publish Floor Plan
        </Button>
      </div>
    </div>
  );
}
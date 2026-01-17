import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line, Group, Transformer } from 'react-konva';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MousePointer2, Square, Circle as CircleIcon, Type, Pencil, 
  ZoomIn, ZoomOut, Maximize2, Sparkles, Trash2, Copy, Lock, 
  Unlock, Eye, EyeOff, Layers, Grid3x3, AlertTriangle, CheckCircle,
  Loader2, Undo, Redo, RotateCw, Home
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

const CANVAS_W = 2000;
const CANVAS_H = 1400;
const GRID_SIZE = 40;

const LAYERS_CONFIG = [
  { id: 'main', name: 'Main Dining', color: '#3b82f6' },
  { id: 'roof', name: 'Rooftop', color: '#10b981' },
  { id: 'lounge', name: 'Lounge', color: '#f59e0b' }
];

const TABLE_SHAPES = [
  { id: 'round', label: 'Round', icon: CircleIcon, seats: 4 },
  { id: 'square', label: 'Square', icon: Square, seats: 4 },
  { id: 'rectangle', label: 'Rectangle', seats: 6 },
  { id: 'booth', label: 'Booth', seats: 6 }
];

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const layerRefs = useRef({});

  const [tool, setTool] = useState('select');
  const [activeLayer, setActiveLayer] = useState('main');
  const [layerVisibility, setLayerVisibility] = useState({ main: true, roof: true, lounge: true });
  
  const [objects, setObjects] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [zoom, setZoom] = useState(0.5);
  const [stagePos, setStagePos] = useState({ x: 20, y: 20 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const [drawingWall, setDrawingWall] = useState(null);
  const [aiModal, setAiModal] = useState({ open: false, prompt: '', targetIds: [] });
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, targetId: null });
  const [isSaving, setIsSaving] = useState(false);
  const [overlaps, setOverlaps] = useState([]);

  // Load existing floor plan
  useEffect(() => {
    if (!restaurant?.floor_plan_data?.objects) return;
    const loaded = restaurant.floor_plan_data.objects || [];
    setObjects(loaded);
    pushToHistory(loaded);
  }, [restaurant?.id]);

  // Fit to content on load
  useEffect(() => {
    if (objects.length > 0 && stageRef.current) {
      fitToContent();
    }
  }, [objects.length > 0]);

  const pushToHistory = (newObjects) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, JSON.parse(JSON.stringify(newObjects))];
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    setObjects(history[historyIndex - 1]);
    setHistoryIndex(prev => prev - 1);
    setSelectedIds([]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setObjects(history[historyIndex + 1]);
    setHistoryIndex(prev => prev + 1);
    setSelectedIds([]);
  };

  const fitToContent = () => {
    if (!stageRef.current || objects.length === 0) {
      setZoom(0.5);
      setStagePos({ x: 20, y: 20 });
      return;
    }

    const tables = objects.filter(o => o.type === 'table');
    if (tables.length === 0) return;

    const xs = tables.map(t => t.x);
    const ys = tables.map(t => t.y);
    const minX = Math.min(...xs) - 100;
    const minY = Math.min(...ys) - 100;
    const maxX = Math.max(...xs.map((x, i) => x + (tables[i].width || 80))) + 100;
    const maxY = Math.max(...ys.map((y, i) => y + (tables[i].height || 80))) + 100;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const stage = stageRef.current;
    const containerW = stage.width();
    const containerH = stage.height();

    const scaleX = containerW / contentW;
    const scaleY = containerH / contentH;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.9;

    setZoom(newZoom);
    setStagePos({
      x: (containerW - contentW * newZoom) / 2 - minX * newZoom,
      y: (containerH - contentH * newZoom) / 2 - minY * newZoom
    });
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    const clampedScale = Math.max(0.1, Math.min(3, newScale));

    setZoom(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale
    });
  };

  const snapToGridValue = (value) => {
    if (!snapToGrid) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const addTable = (shape) => {
    const newTable = {
      id: `table_${Date.now()}`,
      type: 'table',
      layer: activeLayer,
      shape,
      x: snapToGridValue(400),
      y: snapToGridValue(300),
      width: shape === 'rectangle' || shape === 'booth' ? 120 : 80,
      height: shape === 'booth' ? 100 : 80,
      rotation: 0,
      seats: shape === 'round' || shape === 'square' ? 4 : 6,
      label: `T${objects.filter(o => o.type === 'table').length + 1}`,
      locked: false,
      fill: '#ffffff',
      stroke: '#cbd5e1'
    };
    const updated = [...objects, newTable];
    setObjects(updated);
    pushToHistory(updated);
    setSelectedIds([newTable.id]);
  };

  const addText = () => {
    const newText = {
      id: `text_${Date.now()}`,
      type: 'text',
      layer: activeLayer,
      x: snapToGridValue(400),
      y: snapToGridValue(300),
      text: 'Label',
      fontSize: 18,
      fill: '#111827',
      locked: false,
      pointerEvents: false
    };
    const updated = [...objects, newText];
    setObjects(updated);
    pushToHistory(updated);
    setSelectedIds([newText.id]);
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedIds([]);
      setContextMenu({ show: false, x: 0, y: 0, targetId: null });
    }
  };

  const handleObjectClick = (e, id) => {
    if (tool !== 'select') return;
    
    const isMultiSelect = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    if (isMultiSelect) {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleDragEnd = (id) => {
    const obj = objects.find(o => o.id === id);
    if (obj && snapToGrid) {
      const updated = objects.map(o => 
        o.id === id ? { ...o, x: snapToGridValue(o.x), y: snapToGridValue(o.y) } : o
      );
      setObjects(updated);
    }
    pushToHistory(objects);
  };

  const handleTransformEnd = (id) => {
    const node = layerRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const updated = objects.map(obj => {
      if (obj.id !== id) return obj;
      return {
        ...obj,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: obj.type === 'table' ? Math.max(60, obj.width * scaleX) : obj.width,
        height: obj.type === 'table' ? Math.max(60, obj.height * scaleY) : obj.height
      };
    });

    setObjects(updated);
    node.scaleX(1);
    node.scaleY(1);
    pushToHistory(updated);
  };

  const updateTransformer = () => {
    if (!transformerRef.current) return;
    const nodes = selectedIds
      .map(id => layerRefs.current[id])
      .filter(Boolean)
      .filter(node => !objects.find(o => o.id === node.attrs.id && o.locked));
    
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  };

  useEffect(() => {
    updateTransformer();
  }, [selectedIds, objects]);

  const deleteSelected = () => {
    const updated = objects.filter(o => !selectedIds.includes(o.id));
    setObjects(updated);
    pushToHistory(updated);
    setSelectedIds([]);
  };

  const duplicateSelected = () => {
    const toDuplicate = objects.filter(o => selectedIds.includes(o.id));
    const duplicated = toDuplicate.map(obj => ({
      ...obj,
      id: `${obj.type}_${Date.now()}_${Math.random()}`,
      x: obj.x + 40,
      y: obj.y + 40,
      label: obj.type === 'table' ? `${obj.label}-copy` : obj.label
    }));
    const updated = [...objects, ...duplicated];
    setObjects(updated);
    pushToHistory(updated);
    setSelectedIds(duplicated.map(d => d.id));
  };

  const toggleLock = () => {
    const updated = objects.map(o => 
      selectedIds.includes(o.id) ? { ...o, locked: !o.locked } : o
    );
    setObjects(updated);
    pushToHistory(updated);
  };

  const bringToFront = () => {
    const selected = objects.filter(o => selectedIds.includes(o.id));
    const rest = objects.filter(o => !selectedIds.includes(o.id));
    const updated = [...rest, ...selected];
    setObjects(updated);
    pushToHistory(updated);
  };

  const sendToBack = () => {
    const selected = objects.filter(o => selectedIds.includes(o.id));
    const rest = objects.filter(o => !selectedIds.includes(o.id));
    const updated = [...selected, ...rest];
    setObjects(updated);
    pushToHistory(updated);
  };

  const handleContextMenu = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage.getPointerPosition();
    
    setContextMenu({
      show: true,
      x: e.evt.clientX,
      y: e.evt.clientY,
      targetId: e.target.attrs.id || null
    });
  };

  const checkOverlaps = () => {
    const tables = objects.filter(o => o.type === 'table' && layerVisibility[o.layer]);
    const found = [];
    
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i];
        const b = tables[j];
        if (a.layer !== b.layer) continue;
        
        const aBox = { x: a.x, y: a.y, w: a.width || 80, h: a.height || 80 };
        const bBox = { x: b.x, y: b.y, w: b.width || 80, h: b.height || 80 };
        
        if (!(aBox.x + aBox.w < bBox.x || aBox.x > bBox.x + bBox.w ||
              aBox.y + aBox.h < bBox.y || aBox.y > bBox.y + bBox.h)) {
          found.push([a.id, b.id]);
        }
      }
    }
    setOverlaps(found);
    return found;
  };

  const autoFixOverlaps = () => {
    const found = checkOverlaps();
    if (found.length === 0) {
      toast.success('No overlaps to fix');
      return;
    }

    const updated = [...objects];
    found.forEach(([aId, bId]) => {
      const bIndex = updated.findIndex(o => o.id === bId);
      if (bIndex !== -1) {
        updated[bIndex] = { ...updated[bIndex], y: updated[bIndex].y + 100 };
      }
    });

    setObjects(updated);
    pushToHistory(updated);
    toast.success(`Fixed ${found.length} overlap(s)`);
    setOverlaps([]);
  };

  useEffect(() => {
    checkOverlaps();
  }, [objects, layerVisibility]);

  const runAI = async () => {
    if (!aiModal.prompt.trim()) return;
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a restaurant floor plan assistant. The user says: "${aiModal.prompt}"
        
Current objects: ${JSON.stringify(objects.filter(o => aiModal.targetIds.includes(o.id)))}

Return a JSON object with modifications:
{
  "action": "align" | "distribute" | "rotate" | "resize",
  "changes": [{ "id": "...", "x": 0, "y": 0, "rotation": 0, "width": 80, "height": 80 }]
}

Common actions:
- "align left/right/top/bottom" - align all objects
- "distribute horizontally/vertically" - space evenly
- "rotate 45/90 degrees" - rotate objects
- "make bigger/smaller" - resize objects`,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string" },
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  x: { type: "number" },
                  y: { type: "number" },
                  rotation: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result?.changes) {
        const updated = objects.map(obj => {
          const change = result.changes.find(c => c.id === obj.id);
          return change ? { ...obj, ...change } : obj;
        });
        setObjects(updated);
        pushToHistory(updated);
        toast.success('AI changes applied');
      }
    } catch (err) {
      toast.error('AI failed');
    } finally {
      setAiModal({ open: false, prompt: '', targetIds: [] });
    }
  };

  const handlePublish = async () => {
    const tables = objects.filter(o => o.type === 'table');
    if (tables.length === 0) {
      toast.error('Add at least one table before publishing');
      return;
    }

    const found = checkOverlaps();
    if (found.length > 0) {
      toast.error(`${found.length} overlap(s) detected. Fix or use Auto-Fix button.`);
      return;
    }

    setIsSaving(true);
    try {
      const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
      
      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: { objects, settings: { zoom, stagePos } },
        total_seats: totalSeats,
        available_seats: totalSeats
      });

      // Sync Table entities
      const existing = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      await Promise.all(existing.map(t => base44.entities.Table.delete(t.id)));

      for (const table of tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: table.label,
          capacity: table.seats,
          status: 'free',
          position_x: table.x,
          position_y: table.y,
          shape: table.shape,
          rotation: table.rotation || 0,
          width: table.width || 80,
          height: table.height || 80,
          layer: table.layer || 'main'
        });
      }

      toast.success('Floor plan published!');
      onPublish?.();
    } catch (err) {
      toast.error('Failed to publish');
    } finally {
      setIsSaving(false);
    }
  };

  const visibleObjects = objects.filter(o => layerVisibility[o.layer]);

  return (
    <div className="space-y-3">
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-black">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg">Floor Plan Studio</div>
              <div className="text-sm opacity-90">
                {objects.filter(o => o.type === 'table').length} tables • {objects.filter(o => o.type === 'table').reduce((s, t) => s + (t.seats || 0), 0)} seats
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button size="sm" variant="secondary" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold px-2">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="secondary" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={fitToContent}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button 
              size="sm" 
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handlePublish}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-[280px_1fr_280px] gap-3">
        {/* Left Panel */}
        <Card className="p-4 h-[700px] overflow-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">LAYERS</h3>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>

            {LAYERS_CONFIG.map(layer => (
              <div
                key={layer.id}
                className={cn(
                  "p-3 rounded-lg border-2 cursor-pointer transition-all",
                  activeLayer === layer.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
                )}
                onClick={() => setActiveLayer(layer.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }} />
                    <span className="font-semibold text-sm">{layer.name}</span>
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    setLayerVisibility(prev => ({ ...prev, [layer.id]: !prev[layer.id] }));
                  }}>
                    {layerVisibility[layer.id] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  {objects.filter(o => o.layer === layer.id && o.type === 'table').length} tables
                </div>
              </div>
            ))}

            <div className="border-t pt-4">
              <h3 className="font-bold text-sm mb-2">TOOLS</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={tool === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool('select')}
                >
                  <MousePointer2 className="w-4 h-4 mr-1" /> Select
                </Button>
                <Button
                  variant={tool === 'wall' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool('wall')}
                >
                  <Pencil className="w-4 h-4 mr-1" /> Wall
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-bold text-sm mb-2">ADD TABLE</h3>
              <div className="space-y-2">
                {TABLE_SHAPES.map(shape => (
                  <Button
                    key={shape.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => addTable(shape.id)}
                  >
                    <span className="flex items-center gap-2">
                      <shape.icon className="w-4 h-4" />
                      {shape.label}
                    </span>
                    <Badge variant="secondary">{shape.seats}</Badge>
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <Button variant="outline" className="w-full" onClick={addText}>
                <Type className="w-4 h-4 mr-2" /> Add Text Label
              </Button>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Grid</span>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Snap</span>
                <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Dark</span>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
            </div>
          </div>
        </Card>

        {/* Canvas */}
        <Card className="relative overflow-hidden">
          <Stage
            ref={stageRef}
            width={1200}
            height={700}
            scaleX={zoom}
            scaleY={zoom}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            onClick={handleStageClick}
            draggable={tool === 'select'}
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
            className={cn(darkMode && "bg-slate-800")}
          >
            {/* Grid */}
            <Layer>
              {showGrid && (
                <>
                  {Array.from({ length: Math.ceil(CANVAS_W / GRID_SIZE) }).map((_, i) => (
                    <Line
                      key={`v${i}`}
                      points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_H]}
                      stroke={darkMode ? "#334155" : "#e2e8f0"}
                      strokeWidth={1}
                    />
                  ))}
                  {Array.from({ length: Math.ceil(CANVAS_H / GRID_SIZE) }).map((_, i) => (
                    <Line
                      key={`h${i}`}
                      points={[0, i * GRID_SIZE, CANVAS_W, i * GRID_SIZE]}
                      stroke={darkMode ? "#334155" : "#e2e8f0"}
                      strokeWidth={1}
                    />
                  ))}
                </>
              )}
            </Layer>

            {/* Objects */}
            <Layer>
              {visibleObjects.map(obj => {
                if (obj.type === 'table') {
                  const isSelected = selectedIds.includes(obj.id);
                  const isOverlapping = overlaps.some(pair => pair.includes(obj.id));
                  
                  return (
                    <Group
                      key={obj.id}
                      ref={node => layerRefs.current[obj.id] = node}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation || 0}
                      draggable={!obj.locked && tool === 'select'}
                      onClick={(e) => handleObjectClick(e, obj.id)}
                      onDragEnd={() => handleDragEnd(obj.id)}
                      onTransformEnd={() => handleTransformEnd(obj.id)}
                      onContextMenu={handleContextMenu}
                    >
                      {/* Shadow */}
                      {obj.shape === 'round' ? (
                        <Circle
                          radius={(obj.width || 80) / 2}
                          fill="#00000010"
                          offsetY={-3}
                        />
                      ) : (
                        <Rect
                          width={obj.width || 80}
                          height={obj.height || 80}
                          fill="#00000010"
                          offsetY={-3}
                          cornerRadius={obj.shape === 'booth' ? 12 : 8}
                        />
                      )}

                      {/* Table Shape */}
                      {obj.shape === 'round' ? (
                        <Circle
                          radius={(obj.width || 80) / 2}
                          fill={isOverlapping ? '#fee2e2' : obj.fill || '#ffffff'}
                          stroke={isSelected ? '#8b5cf6' : (isOverlapping ? '#ef4444' : obj.stroke || '#cbd5e1')}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                      ) : (
                        <Rect
                          width={obj.width || 80}
                          height={obj.height || 80}
                          fill={isOverlapping ? '#fee2e2' : obj.fill || '#ffffff'}
                          stroke={isSelected ? '#8b5cf6' : (isOverlapping ? '#ef4444' : obj.stroke || '#cbd5e1')}
                          strokeWidth={isSelected ? 3 : 2}
                          cornerRadius={obj.shape === 'booth' ? 12 : 8}
                        />
                      )}

                      {/* Label */}
                      <Text
                        text={obj.label}
                        fontSize={14}
                        fontStyle="bold"
                        fill="#111827"
                        width={obj.width || 80}
                        align="center"
                        y={obj.shape === 'round' ? 0 : ((obj.height || 80) / 2) - 20}
                        offsetY={obj.shape === 'round' ? ((obj.width || 80) / 4) : 0}
                      />
                      <Text
                        text={`${obj.seats} seats`}
                        fontSize={11}
                        fill="#64748b"
                        width={obj.width || 80}
                        align="center"
                        y={obj.shape === 'round' ? 0 : ((obj.height || 80) / 2) + 2}
                        offsetY={obj.shape === 'round' ? -((obj.width || 80) / 8) : 0}
                      />

                      {/* Lock Badge */}
                      {obj.locked && (
                        <Group x={(obj.width || 80) - 20} y={5}>
                          <Circle radius={10} fill="#111827" opacity={0.8} />
                          <Text text="🔒" fontSize={10} x={-5} y={-5} />
                        </Group>
                      )}
                    </Group>
                  );
                }

                if (obj.type === 'text') {
                  return (
                    <Text
                      key={obj.id}
                      ref={node => layerRefs.current[obj.id] = node}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      text={obj.text}
                      fontSize={obj.fontSize || 18}
                      fill={obj.fill || '#111827'}
                      fontStyle="bold"
                      draggable={!obj.locked && tool === 'select'}
                      onClick={(e) => handleObjectClick(e, obj.id)}
                      onDragEnd={() => handleDragEnd(obj.id)}
                      onContextMenu={handleContextMenu}
                      listening={tool === 'select'}
                    />
                  );
                }

                if (obj.type === 'wall') {
                  return (
                    <Line
                      key={obj.id}
                      ref={node => layerRefs.current[obj.id] = node}
                      id={obj.id}
                      points={obj.points}
                      stroke={obj.stroke || '#111827'}
                      strokeWidth={obj.strokeWidth || 6}
                      lineCap="round"
                      onClick={(e) => handleObjectClick(e, obj.id)}
                      onContextMenu={handleContextMenu}
                      listening={tool === 'select'}
                    />
                  );
                }

                return null;
              })}

              <Transformer ref={transformerRef} />
            </Layer>
          </Stage>

          {/* Context Menu */}
          {contextMenu.show && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-2xl border p-2 w-56"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setAiModal({ open: true, prompt: '', targetIds: selectedIds.length ? selectedIds : [contextMenu.targetId] });
                  setContextMenu({ show: false, x: 0, y: 0, targetId: null });
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Ask AI
              </Button>
              {contextMenu.targetId && (
                <>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { duplicateSelected(); setContextMenu({ show: false, x: 0, y: 0, targetId: null }); }}>
                    <Copy className="w-4 h-4 mr-2" /> Duplicate
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { toggleLock(); setContextMenu({ show: false, x: 0, y: 0, targetId: null }); }}>
                    {objects.find(o => o.id === contextMenu.targetId)?.locked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {objects.find(o => o.id === contextMenu.targetId)?.locked ? 'Unlock' : 'Lock'}
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={() => { deleteSelected(); setContextMenu({ show: false, x: 0, y: 0, targetId: null }); }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        {/* Right Panel */}
        <Card className="p-4 h-[700px] overflow-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">PROPERTIES</h3>
              {selectedIds.length > 0 && <Badge>{selectedIds.length} selected</Badge>}
            </div>

            {selectedIds.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={toggleLock}>
                    <Lock className="w-4 h-4 mr-1" /> Lock
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={duplicateSelected}>
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={bringToFront}>
                    Front
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={sendToBack}>
                    Back
                  </Button>
                </div>
                <Button size="sm" variant="destructive" className="w-full" onClick={deleteSelected}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </div>
            )}

            {overlaps.length > 0 && (
              <div className="border-t pt-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm text-amber-900">
                        {overlaps.length} Overlap(s) Detected
                      </div>
                      <div className="text-xs text-amber-700">
                        Tables are overlapping on the floor plan
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={autoFixOverlaps}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Auto-Fix Overlaps
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* AI Modal */}
      {aiModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-[500px] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h3 className="font-bold text-lg">Ask AI</h3>
            </div>
            <Input
              placeholder="e.g., 'align these tables' or 'rotate 45 degrees'"
              value={aiModal.prompt}
              onChange={(e) => setAiModal(prev => ({ ...prev, prompt: e.target.value }))}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAiModal({ open: false, prompt: '', targetIds: [] })}>
                Cancel
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={runAI}>
                <Sparkles className="w-4 h-4 mr-2" /> Apply
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
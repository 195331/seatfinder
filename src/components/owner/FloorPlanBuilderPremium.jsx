import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Line, Group, Text, Transformer } from "react-konva";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

// Mild futuristic palette
const COLORS = {
  bg: "#0B1220",
  panel: "rgba(255,255,255,0.06)",
  panelBorder: "rgba(255,255,255,0.10)",
  grid: "rgba(255,255,255,0.06)",
  outline: "rgba(168, 85, 247, 0.55)",
  outlineFill: "rgba(168, 85, 247, 0.08)",
  wall: "rgba(255,255,255,0.55)",
  wallGlow: "rgba(34,211,238,0.35)",
  selected: "#22D3EE",
  tableFree: "#111827",
  tableStroke: "rgba(255,255,255,0.22)",
  tableText: "rgba(255,255,255,0.92)",
  seatChip: "rgba(34,211,238,0.12)",
  seatChipStroke: "rgba(34,211,238,0.45)",
};

const DEFAULT_TABLE_SIZES = [
  { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 76, h: 76, shape: "round" },
  { seats: 6, w: 92, h: 72, shape: "rect" },
  { seats: 8, w: 110, h: 76, shape: "rect" },
  { seats: 10, w: 130, h: 80, shape: "rect" },
];

function snapAngle(dx, dy) {
  // snap to 0/45/90 degrees
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { dx: Math.cos(snapped) * len, dy: Math.sin(snapped) * len };
}

function getNodeClientRectSafe(node) {
  try {
    return node.getClientRect({ skipShadow: true, skipStroke: false });
  } catch {
    return null;
  }
}

function intersects(a, b) {
  if (!a || !b) return false;
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

export default function FloorPlanBuilderKonvaPremium({
  restaurant,
  onPublish,
}) {
  // ---------- Canvas sizing ----------
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [stageSize, setStageSize] = useState({ width: 1200, height: 640 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageSize({ width: Math.max(900, r.width), height: Math.max(560, r.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- Viewport / camera ----------
  const [scale, setScale] = useState(1);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  // ---------- Modes ----------
  // select | add-table | draw-outline | draw-wall | add-text
  const [mode, setMode] = useState("select");
  const [activeSeats, setActiveSeats] = useState(4); // quick add size
  const [activeShape, setActiveShape] = useState("round");

  // ---------- Floor plan data ----------
  // We keep everything as "items". Only tables are reservable by diners.
  const [outline, setOutline] = useState(null); // {x,y,w,h,rotation?} optional
  const [walls, setWalls] = useState([]); // [{id, points:[x1,y1,x2,y2], locked}]
  const [tables, setTables] = useState([]); // [{id,x,y,w,h,shape,seats,label,rotation,locked,groupId}]
  const [notes, setNotes] = useState([]); // background-only text notes (NOT reservable)

  // ---------- Selection / multi-select ----------
  const [selectedIds, setSelectedIds] = useState([]); // can include table/wall/note ids
  const [lastPointer, setLastPointer] = useState({ x: 0, y: 0 });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const clearSelection = () => setSelectedIds([]);
  const toggleSelect = (id, additive) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (!additive) s.clear();
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
  };

  // ---------- Context menu ----------
  const [ctxMenu, setCtxMenu] = useState(null);
  // {x,y,target:{type,id}} relative to container

  const closeCtx = () => setCtxMenu(null);

  // ---------- Transformer ----------
  const trRef = useRef(null);

  const allSelectableNodes = useRef({}); // id -> konva node
  const registerNode = (id, node) => {
    if (!node) return;
    allSelectableNodes.current[id] = node;
  };

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    const nodes = selectedIds
      .map((id) => allSelectableNodes.current[id])
      .filter(Boolean);

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, tables, walls, notes]);

  // ---------- Load existing (optional) ----------
  useEffect(() => {
    const fp = restaurant?.floor_plan_data;
    if (!fp) return;

    // Defensive parsing
    setOutline(fp.outline || null);
    setWalls(Array.isArray(fp.walls) ? fp.walls : []);
    setTables(Array.isArray(fp.tables) ? fp.tables : []);
    setNotes(Array.isArray(fp.notes) ? fp.notes : []);

    // Try to "fit" once loaded
    setTimeout(() => fitToContent(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  // ---------- Helpers ----------
  const worldPosFromEvent = useCallback((e) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const p = stage.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    // Convert screen -> world
    return {
      x: (p.x - cam.x) / scale,
      y: (p.y - cam.y) / scale,
    };
  }, [cam.x, cam.y, scale]);

  const fitToContent = useCallback(() => {
    // Fit outline if present, otherwise fit tables
    const pad = 40;
    const contentRect = (() => {
      if (outline) return { x: outline.x, y: outline.y, w: outline.w, h: outline.h };
      if (tables.length === 0) return { x: 0, y: 0, w: 900, h: 600 };
      const xs = tables.map(t => t.x);
      const ys = tables.map(t => t.y);
      const xe = tables.map(t => t.x + t.w);
      const ye = tables.map(t => t.y + t.h);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xe) - Math.min(...xs),
        h: Math.max(...ye) - Math.min(...ys),
      };
    })();

    const vw = stageSize.width;
    const vh = stageSize.height;
    const s = clamp(Math.min((vw - pad * 2) / contentRect.w, (vh - pad * 2) / contentRect.h), 0.4, 2.0);

    setScale(s);
    setCam({
      x: (vw / 2) - (contentRect.x + contentRect.w / 2) * s,
      y: (vh / 2) - (contentRect.y + contentRect.h / 2) * s,
    });
  }, [outline, tables, stageSize.width, stageSize.height]);

  // ---------- Grid rendering ----------
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const spacing = 40;
    const lines = [];
    const w = 4000;
    const h = 2500;

    for (let x = -w; x <= w; x += spacing) {
      lines.push({ points: [x, -h, x, h], key: `vx_${x}` });
    }
    for (let y = -h; y <= h; y += spacing) {
      lines.push({ points: [-w, y, w, y], key: `hy_${y}` });
    }
    return lines;
  }, [showGrid]);

  // ---------- Drawing (outline / wall) ----------
  const [drawing, setDrawing] = useState(null);
  // outline drawing: {type:'outline', start:{x,y}, curr:{x,y}}
  // wall drawing: {type:'wall', start:{x,y}, curr:{x,y}}

  // ---------- Collision check for tables ----------
  const tableRects = useMemo(() => {
    return tables.map(t => ({
      id: t.id,
      x: t.x,
      y: t.y,
      width: t.w,
      height: t.h,
    }));
  }, [tables]);

  const wouldCollide = useCallback((id, rect) => {
    for (const r of tableRects) {
      if (r.id === id) continue;
      if (intersects(r, rect)) return true;
    }
    return false;
  }, [tableRects]);

  // ---------- Add table ----------
  const addTableAt = useCallback((x, y) => {
    const base = DEFAULT_TABLE_SIZES.find(s => s.seats === activeSeats && s.shape === activeShape)
      || DEFAULT_TABLE_SIZES.find(s => s.seats === activeSeats)
      || DEFAULT_TABLE_SIZES[1];

    const t = {
      id: uid(),
      x: x - base.w / 2,
      y: y - base.h / 2,
      w: base.w,
      h: base.h,
      seats: activeSeats,
      shape: activeShape,
      label: `T${tables.length + 1}`,
      rotation: 0,
      locked: false,
      groupId: null,
      type: "table",
      reservable: true, // IMPORTANT: diners only reserve tables
    };

    // slight auto-space if colliding
    let rect = { x: t.x, y: t.y, width: t.w, height: t.h };
    if (wouldCollide(t.id, rect)) {
      t.x += 28;
      t.y += 28;
    }

    setTables(prev => [...prev, t]);
    setSelectedIds([t.id]);
  }, [activeSeats, activeShape, tables.length, wouldCollide]);

  // ---------- Add note ----------
  const addNoteAt = useCallback((x, y) => {
    const n = {
      id: uid(),
      x,
      y,
      text: "Note",
      fontSize: 16,
      color: "rgba(255,255,255,0.75)",
      locked: false,
      type: "note",
      reservable: false, // NEVER reservable
    };
    setNotes(prev => [...prev, n]);
    setSelectedIds([n.id]);
  }, []);

  // ---------- Group / lock ----------
  const lockSelected = (locked) => {
    const ids = new Set(selectedIds);
    setTables(prev => prev.map(t => ids.has(t.id) ? { ...t, locked } : t));
    setWalls(prev => prev.map(w => ids.has(w.id) ? { ...w, locked } : w));
    setNotes(prev => prev.map(n => ids.has(n.id) ? { ...n, locked } : n));
  };

  const groupSelectedTables = () => {
    const ids = selectedIds.filter(id => tables.some(t => t.id === id));
    if (ids.length < 2) return;
    const gid = uid();
    setTables(prev => prev.map(t => ids.includes(t.id) ? { ...t, groupId: gid } : t));
  };

  const ungroupSelectedTables = () => {
    const ids = new Set(selectedIds);
    setTables(prev => prev.map(t => ids.has(t.id) ? { ...t, groupId: null } : t));
  };

  // ---------- Delete ----------
  const deleteSelected = () => {
    const ids = new Set(selectedIds);
    setTables(prev => prev.filter(t => !ids.has(t.id)));
    setWalls(prev => prev.filter(w => !ids.has(w.id)));
    setNotes(prev => prev.filter(n => !ids.has(n.id)));
    clearSelection();
  };

  // ---------- Duplicate table ----------
  const duplicateSelectedTables = () => {
    const ids = new Set(selectedIds);
    const toDup = tables.filter(t => ids.has(t.id));
    if (toDup.length === 0) return;
    const copies = toDup.map(t => ({
      ...t,
      id: uid(),
      x: t.x + 24,
      y: t.y + 24,
      label: `${t.label}`,
      locked: false,
    }));
    setTables(prev => [...prev, ...copies]);
    setSelectedIds(copies.map(c => c.id));
  };

  // ---------- Right click menu actions ----------
  const askAIForTarget = (target) => {
    // Placeholder: you can wire to your AI endpoint later.
    // For now, it just suggests helpful actions.
    alert(
      `Ask AI (placeholder)\n\nTarget: ${target.type}\n\nExamples:\n- “Make a booth wall around this area”\n- “Align these tables evenly”\n- “Optimize spacing for 2 servers”\n- “Suggest layout for 40 seats + walkway”`
    );
  };

  // ---------- Stage events ----------
  const onWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = scale;
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.06;
    const newScale = clamp(dir > 0 ? oldScale * factor : oldScale / factor, 0.35, 2.5);

    // zoom around pointer
    const mousePointTo = {
      x: (pointer.x - cam.x) / oldScale,
      y: (pointer.y - cam.y) / oldScale,
    };

    setScale(newScale);
    setCam({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const onStageMouseDown = (e) => {
    closeCtx();

    const isEmpty = e.target === e.target.getStage();
    const additive = e.evt.shiftKey || e.evt.metaKey;

    const p = worldPosFromEvent(e);
    setLastPointer(p);

    if (mode === "add-table" && isEmpty) {
      addTableAt(p.x, p.y);
      return;
    }

    if (mode === "add-text" && isEmpty) {
      addNoteAt(p.x, p.y);
      setMode("select");
      return;
    }

    if (mode === "draw-outline" && isEmpty) {
      setDrawing({ type: "outline", start: p, curr: p });
      return;
    }

    if (mode === "draw-wall" && isEmpty) {
      setDrawing({ type: "wall", start: p, curr: p });
      return;
    }

    if (isEmpty && mode === "select") {
      if (!additive) clearSelection();
    }
  };

  const onStageMouseMove = (e) => {
    if (!drawing) return;
    const p = worldPosFromEvent(e);
    setDrawing(prev => prev ? { ...prev, curr: p } : prev);
  };

  const onStageMouseUp = () => {
    if (!drawing) return;

    if (drawing.type === "outline") {
      const x = Math.min(drawing.start.x, drawing.curr.x);
      const y = Math.min(drawing.start.y, drawing.curr.y);
      const w = Math.abs(drawing.curr.x - drawing.start.x);
      const h = Math.abs(drawing.curr.y - drawing.start.y);

      // auto “clean” outline
      if (w > 60 && h > 60) {
        setOutline({ x, y, w, h });
        fitToContent();
      }
      setDrawing(null);
      setMode("select");
      return;
    }

    if (drawing.type === "wall") {
      const dx = drawing.curr.x - drawing.start.x;
      const dy = drawing.curr.y - drawing.start.y;
      const snapped = snapAngle(dx, dy);

      // Minimum length
      const len = Math.sqrt(snapped.dx * snapped.dx + snapped.dy * snapped.dy);
      if (len > 40) {
        const wall = {
          id: uid(),
          points: [drawing.start.x, drawing.start.y, drawing.start.x + snapped.dx, drawing.start.y + snapped.dy],
          locked: false,
          type: "wall",
          reservable: false,
        };
        setWalls(prev => [...prev, wall]);
        setSelectedIds([wall.id]);
      }

      setDrawing(null);
      setMode("select");
      return;
    }
  };

  // ---------- Right click ----------
  const onContextMenu = (e, target) => {
    e.evt.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const r = container.getBoundingClientRect();
    const px = e.evt.clientX - r.left;
    const py = e.evt.clientY - r.top;

    setCtxMenu({ x: px, y: py, target });
  };

  // ---------- Drag table / group ----------
  const moveGroup = (groupId, dx, dy) => {
    setTables(prev => prev.map(t => t.groupId === groupId ? ({ ...t, x: t.x + dx, y: t.y + dy }) : t));
  };

  const onTableDragMove = (id, e) => {
    const node = e.target;
    const t = tables.find(x => x.id === id);
    if (!t) return;

    const x = node.x();
    const y = node.y();

    // If table is grouped, move the group (but only when dragging a member)
    if (t.groupId) {
      const dx = x - t.x;
      const dy = y - t.y;
      moveGroup(t.groupId, dx, dy);
      // keep dragged node visually in sync
      node.position({ x: t.x + dx, y: t.y + dy });
      return;
    }

    // Keep free placement. Only soft collision prevention:
    const rect = { x, y, width: t.w, height: t.h };
    const coll = wouldCollide(id, rect);

    // Outline is optional: no “restriction”, but we can gently highlight if outside
    node.opacity(coll ? 0.55 : 1.0);
  };

  const onTableDragEnd = (id, e) => {
    const node = e.target;
    const t = tables.find(x => x.id === id);
    if (!t) return;

    const x = node.x();
    const y = node.y();

    // grouped handled in moveGroup already
    if (t.groupId) return;

    const rect = { x, y, width: t.w, height: t.h };
    const coll = wouldCollide(id, rect);

    if (coll) {
      // revert
      node.position({ x: t.x, y: t.y });
      node.opacity(1);
      return;
    }

    setTables(prev => prev.map(tt => tt.id === id ? { ...tt, x, y } : tt));
    node.opacity(1);
  };

  // ---------- Transformer config ----------
  const transformerEnabled = useMemo(() => {
    // only tables + notes can transform, walls shouldn’t scale
    const ids = new Set(selectedIds);
    const hasWallOnly = walls.some(w => ids.has(w.id)) && !tables.some(t => ids.has(t.id)) && !notes.some(n => ids.has(n.id));
    return !hasWallOnly;
  }, [selectedIds, walls, tables, notes]);

  const totalSeats = useMemo(() => tables.reduce((s, t) => s + (t.seats || 0), 0), [tables]);

  // ---------- Publish ----------
  const handlePublish = async () => {
    // IMPORTANT: diners can only reserve tables; notes/walls are background only.
    const floorPlanData = {
      version: 2,
      outline,
      walls,
      tables: tables.map(t => ({ ...t, reservable: true, type: "table" })),
      notes: notes.map(n => ({ ...n, reservable: false, type: "note" })),
      publishedAt: new Date().toISOString(),
    };

    // If you're already saving via base44 elsewhere, keep it there.
    // This function just hands back the data if you want.
    onPublish?.(floorPlanData);
    alert("Published (demo). Wire this to base44 update if you want.");
  };

  // ---------- UI helpers ----------
  const selectedTable = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return tables.find(t => t.id === selectedIds[0]) || null;
  }, [selectedIds, tables]);

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Futuristic Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "select" ? "default" : "outline"}
            onClick={() => setMode("select")}
            className="rounded-full"
          >
            Select
          </Button>

          <Button
            variant={mode === "add-table" ? "default" : "outline"}
            onClick={() => setMode("add-table")}
            className="rounded-full"
          >
            Add Table
          </Button>

          <Button
            variant={mode === "draw-outline" ? "default" : "outline"}
            onClick={() => setMode("draw-outline")}
            className="rounded-full"
          >
            Draw Outline
          </Button>

          <Button
            variant={mode === "draw-wall" ? "default" : "outline"}
            onClick={() => setMode("draw-wall")}
            className="rounded-full"
          >
            Draw Wall
          </Button>

          <Button
            variant={mode === "add-text" ? "default" : "outline"}
            onClick={() => setMode("add-text")}
            className="rounded-full"
          >
            Add Note
          </Button>

          <Button variant="outline" className="rounded-full" onClick={fitToContent}>
            Fit
          </Button>

          <Button variant="outline" className="rounded-full" onClick={() => setCam({ x: 0, y: 0 })}>
            Center
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            Grid
          </div>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => lockSelected(true)}
            disabled={selectedIds.length === 0}
          >
            Lock
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => lockSelected(false)}
            disabled={selectedIds.length === 0}
          >
            Unlock
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={groupSelectedTables}
            disabled={selectedIds.length < 2}
          >
            Group
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={ungroupSelectedTables}
            disabled={selectedIds.length === 0}
          >
            Ungroup
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={duplicateSelectedTables}
            disabled={selectedIds.length === 0}
          >
            Duplicate
          </Button>
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Table size picker */}
      <Card className="border-0 rounded-2xl p-3"
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-200 mr-2">Quick tables:</div>
          {DEFAULT_TABLE_SIZES.map((s) => (
            <button
              key={`${s.seats}_${s.shape}`}
              onClick={() => { setActiveSeats(s.seats); setActiveShape(s.shape); setMode("add-table"); }}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm transition-all",
                activeSeats === s.seats && activeShape === s.shape
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-slate-200 border-white/15 hover:border-white/30"
              )}
            >
              {s.seats} seats
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-slate-200 text-sm">
            Zoom:
            <button className="px-2 py-1 rounded-lg border border-white/15 hover:border-white/30" onClick={() => setScale(s => clamp(s * 0.92, 0.35, 2.5))}>-</button>
            <span className="w-14 text-center">{Math.round(scale * 100)}%</span>
            <button className="px-2 py-1 rounded-lg border border-white/15 hover:border-white/30" onClick={() => setScale(s => clamp(s * 1.08, 0.35, 2.5))}>+</button>
          </div>
        </div>
      </Card>

      {/* Selected table inspector */}
      {selectedTable && (
        <Card className="border-0 rounded-2xl p-3"
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-slate-200 text-sm">Selected: <span className="font-semibold">{selectedTable.label}</span></div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-300">Label</div>
              <Input
                value={selectedTable.label}
                onChange={(e) => setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, label: e.target.value } : t))}
                className="w-28 bg-white/5 border-white/10 text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-300">Seats</div>
              <Input
                type="number"
                min={1}
                max={20}
                value={selectedTable.seats}
                onChange={(e) => setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, seats: parseInt(e.target.value || "0", 10) } : t))}
                className="w-20 bg-white/5 border-white/10 text-slate-100"
              />
            </div>

            <Button
              variant="outline"
              className="rounded-full border-white/15 text-slate-100 hover:border-white/30"
              onClick={() => setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, rotation: ((t.rotation || 0) + 15) % 360 } : t))}
            >
              Rotate +15°
            </Button>

            <div className="ml-auto text-slate-300 text-sm">
              Total seats: <span className="text-white font-semibold">{totalSeats}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Canvas */}
      <Card
        className="border-0 rounded-3xl overflow-hidden"
        style={{
          background: COLORS.bg,
          border: `1px solid ${COLORS.panelBorder}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div ref={containerRef} className="relative w-full" style={{ height: 640 }} onClick={closeCtx}>
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onWheel={onWheel}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            draggable={mode === "select"} // pan by dragging empty space (feels like SevenRooms)
            x={cam.x}
            y={cam.y}
            scaleX={scale}
            scaleY={scale}
            onDragEnd={(e) => {
              setCam({ x: e.target.x(), y: e.target.y() });
            }}
          >
            <Layer>
              {/* Grid (subtle) */}
              {gridLines.map((l) => (
                <Line
                  key={l.key}
                  points={l.points}
                  stroke={COLORS.grid}
                  strokeWidth={1}
                />
              ))}

              {/* Outline */}
              {outline && (
                <>
                  <Rect
                    x={outline.x}
                    y={outline.y}
                    width={outline.w}
                    height={outline.h}
                    fill={COLORS.outlineFill}
                    stroke={COLORS.outline}
                    strokeWidth={2}
                    dash={[8, 8]}
                    cornerRadius={18}
                    listening={false}
                  />
                  <Text
                    x={outline.x + 14}
                    y={outline.y + 10}
                    text="Dining Area"
                    fontSize={14}
                    fill="rgba(255,255,255,0.65)"
                    listening={false}
                  />
                </>
              )}

              {/* Walls */}
              {walls.map((w) => (
                <Line
                  key={w.id}
                  points={w.points}
                  stroke={COLORS.wall}
                  strokeWidth={6}
                  lineCap="round"
                  shadowColor={COLORS.wallGlow}
                  shadowBlur={12}
                  shadowOpacity={0.6}
                  listening
                  onMouseDown={(e) => {
                    const additive = e.evt.shiftKey || e.evt.metaKey;
                    toggleSelect(w.id, additive);
                  }}
                  onContextMenu={(e) => onContextMenu(e, { type: "wall", id: w.id })}
                  ref={(node) => registerNode(w.id, node)}
                />
              ))}

              {/* Drawing preview */}
              {drawing && drawing.type === "outline" && (
                <Rect
                  x={Math.min(drawing.start.x, drawing.curr.x)}
                  y={Math.min(drawing.start.y, drawing.curr.y)}
                  width={Math.abs(drawing.curr.x - drawing.start.x)}
                  height={Math.abs(drawing.curr.y - drawing.start.y)}
                  stroke={COLORS.selected}
                  strokeWidth={2}
                  dash={[6, 6]}
                  cornerRadius={16}
                  listening={false}
                />
              )}
              {drawing && drawing.type === "wall" && (
                <Line
                  points={[drawing.start.x, drawing.start.y, drawing.curr.x, drawing.curr.y]}
                  stroke={COLORS.selected}
                  strokeWidth={4}
                  dash={[6, 6]}
                  lineCap="round"
                  listening={false}
                />
              )}

              {/* Notes (background only, never reservable) */}
              {notes.map((n) => (
                <Text
                  key={n.id}
                  x={n.x}
                  y={n.y}
                  text={n.text}
                  fontSize={n.fontSize || 16}
                  fill={n.color || "rgba(255,255,255,0.75)"}
                  draggable={!n.locked}
                  onDragEnd={(e) => {
                    const node = e.target;
                    setNotes(prev => prev.map(nn => nn.id === n.id ? { ...nn, x: node.x(), y: node.y() } : nn));
                  }}
                  onMouseDown={(e) => {
                    const additive = e.evt.shiftKey || e.evt.metaKey;
                    toggleSelect(n.id, additive);
                  }}
                  onDblClick={() => {
                    const next = prompt("Edit note text", n.text);
                    if (typeof next === "string") {
                      setNotes(prev => prev.map(nn => nn.id === n.id ? { ...nn, text: next } : nn));
                    }
                  }}
                  onContextMenu={(e) => onContextMenu(e, { type: "note", id: n.id })}
                  ref={(node) => registerNode(n.id, node)}
                />
              ))}

              {/* Tables */}
              {tables.map((t) => {
                const selected = selectedSet.has(t.id);
                const stroke = selected ? COLORS.selected : COLORS.tableStroke;

                return (
                  <Group
                    key={t.id}
                    x={t.x}
                    y={t.y}
                    rotation={t.rotation || 0}
                    draggable={!t.locked}
                    onDragMove={(e) => onTableDragMove(t.id, e)}
                    onDragEnd={(e) => onTableDragEnd(t.id, e)}
                    onMouseDown={(e) => {
                      const additive = e.evt.shiftKey || e.evt.metaKey;
                      toggleSelect(t.id, additive);
                    }}
                    onContextMenu={(e) => onContextMenu(e, { type: "table", id: t.id })}
                    ref={(node) => registerNode(t.id, node)}
                  >
                    {/* Glow */}
                    <Rect
                      x={-6}
                      y={-6}
                      width={t.w + 12}
                      height={t.h + 12}
                      cornerRadius={18}
                      fill="rgba(34,211,238,0.06)"
                      stroke="rgba(34,211,238,0.10)"
                      strokeWidth={1}
                      listening={false}
                    />

                    {t.shape === "round" ? (
                      <Circle
                        x={t.w / 2}
                        y={t.h / 2}
                        radius={Math.min(t.w, t.h) / 2}
                        fill={COLORS.tableFree}
                        stroke={stroke}
                        strokeWidth={2}
                        shadowColor="rgba(0,0,0,0.55)"
                        shadowBlur={10}
                        shadowOffset={{ x: 0, y: 6 }}
                        shadowOpacity={0.35}
                      />
                    ) : (
                      <Rect
                        x={0}
                        y={0}
                        width={t.w}
                        height={t.h}
                        cornerRadius={16}
                        fill={COLORS.tableFree}
                        stroke={stroke}
                        strokeWidth={2}
                        shadowColor="rgba(0,0,0,0.55)"
                        shadowBlur={10}
                        shadowOffset={{ x: 0, y: 6 }}
                        shadowOpacity={0.35}
                      />
                    )}

                    {/* Label */}
                    <Text
                      x={0}
                      y={t.h / 2 - 12}
                      width={t.w}
                      align="center"
                      text={t.label}
                      fontSize={14}
                      fill={COLORS.tableText}
                      listening={false}
                    />

                    {/* Seats chip */}
                    <Rect
                      x={t.w / 2 - 22}
                      y={t.h / 2 + 6}
                      width={44}
                      height={20}
                      cornerRadius={10}
                      fill={COLORS.seatChip}
                      stroke={COLORS.seatChipStroke}
                      strokeWidth={1}
                      listening={false}
                    />
                    <Text
                      x={t.w / 2 - 22}
                      y={t.h / 2 + 8}
                      width={44}
                      align="center"
                      text={`${t.seats}`}
                      fontSize={12}
                      fill="rgba(255,255,255,0.85)"
                      listening={false}
                    />
                  </Group>
                );
              })}

              {/* Transformer */}
              {transformerEnabled && (
                <Transformer
                  ref={trRef}
                  rotateEnabled
                  enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]}
                  boundBoxFunc={(oldBox, newBox) => {
                    // avoid tiny scaling
                    if (newBox.width < 40 || newBox.height < 40) return oldBox;
                    return newBox;
                  }}
                />
              )}
            </Layer>
          </Stage>

          {/* Context Menu */}
          {ctxMenu && (
            <div
              className="absolute z-50 rounded-xl overflow-hidden"
              style={{
                left: ctxMenu.x,
                top: ctxMenu.y,
                width: 220,
                background: "rgba(15,23,42,0.92)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                backdropFilter: "blur(10px)",
              }}
            >
              <div className="px-3 py-2 text-xs text-slate-300 border-b border-white/10">
                {ctxMenu.target.type.toUpperCase()}
              </div>

              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
                onClick={() => { askAIForTarget(ctxMenu.target); closeCtx(); }}
              >
                ✨ Ask AI
              </button>

              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
                onClick={() => { duplicateSelectedTables(); closeCtx(); }}
              >
                Duplicate
              </button>

              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
                onClick={() => { lockSelected(true); closeCtx(); }}
              >
                Lock
              </button>

              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
                onClick={() => { lockSelected(false); closeCtx(); }}
              >
                Unlock
              </button>

              <button
                className="w-full text-left px-3 py-2 text-sm text-red-200 hover:bg-red-500/15"
                onClick={() => { deleteSelected(); closeCtx(); }}
              >
                Delete
              </button>
            </div>
          )}

          {/* Floating hint */}
          <div className="absolute left-4 bottom-4 text-xs text-white/70">
            <div className="rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              Pan: drag empty space • Zoom: mouse wheel • Multi-select: Shift+Click • Notes are background only (not reservable)
            </div>
          </div>
        </div>
      </Card>

      {/* Footer Publish */}
      <div className="flex items-center justify-between">
        <div className="text-slate-600">
          <div className="text-xl font-bold">{totalSeats} seats</div>
          <div className="text-sm">{tables.length} tables • {walls.length} walls • {notes.length} notes</div>
        </div>
        <Button className="rounded-full" onClick={handlePublish}>
          Publish Floor Plan
        </Button>
      </div>
    </div>
  );
}

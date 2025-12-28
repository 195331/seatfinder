import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Copy,
  Trash2,
  Move,
  AlertCircle,
  CheckCircle,
  Loader2,
  Undo,
  Redo,
  Grid3x3,
  MousePointer2,
  PencilRuler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const MIN_SPACING = 12; // padding between tables
const SNAP_THRESHOLD = 10;

const TABLE_SHAPES = {
  round: { label: "Round" },
  square: { label: "Square" },
  rectangle: { label: "Rectangle" },
  booth: { label: "Booth" },
};

const TABLE_STATES = {
  free: { fill: "#f8fafc", stroke: "#cbd5e1", label: "Free" },
  occupied: { fill: "#ffedd5", stroke: "#fdba74", label: "Occupied" },
  reserved: { fill: "#dbeafe", stroke: "#93c5fd", label: "Reserved" },
};

// ---------- helpers ----------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

// AABB of a possibly rotated rectangle (in world coords)
function getAABB(table) {
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;

  // circles have same AABB regardless of rotation
  if (table.shape === "round") {
    return {
      x: table.x,
      y: table.y,
      w: table.width,
      h: table.height,
    };
  }

  const theta = degToRad(table.rotation || 0);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const w = table.width;
  const h = table.height;

  // rotated rect AABB size
  const aabbW = Math.abs(w * cos) + Math.abs(h * sin);
  const aabbH = Math.abs(w * sin) + Math.abs(h * cos);

  return {
    x: cx - aabbW / 2,
    y: cy - aabbH / 2,
    w: aabbW,
    h: aabbH,
  };
}

function aabbOverlap(a, b, padding = 0) {
  return !(
    a.x + a.w + padding < b.x ||
    a.x > b.x + b.w + padding ||
    a.y + a.h + padding < b.y ||
    a.y > b.y + b.h + padding
  );
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

// try to place an area label where it doesn’t overlap tables
function findLabelPosition(area, tables) {
  // label box size (approx, in world coords)
  const labelW = 160;
  const labelH = 26;

  const candidates = [
    { x: area.x + 10, y: area.y + 10 },
    { x: area.x + area.width - labelW - 10, y: area.y + 10 },
    { x: area.x + 10, y: area.y + area.height - labelH - 10 },
    { x: area.x + area.width - labelW - 10, y: area.y + area.height - labelH - 10 },
    { x: area.x + area.width / 2 - labelW / 2, y: area.y + 10 },
  ];

  for (const c of candidates) {
    const labelRect = { x: c.x, y: c.y, w: labelW, h: labelH };
    const hits = tables.some((t) => {
      const aabb = getAABB(t);
      return aabbOverlap(aabb, labelRect, 0);
    });
    if (!hits) return c;
  }

  // fallback
  return { x: area.x + 10, y: area.y + 10 };
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const canvasRef = useRef(null);

  // core state
  const [outline, setOutline] = useState(null); // {x,y,width,height}
  const [areas, setAreas] = useState([]); // optional: {id,name,x,y,width,height}
  const [tables, setTables] = useState([]);

  // selection & interaction
  const [selectedId, setSelectedId] = useState(null);

  // drag state: avoids “jump”
  const [drag, setDrag] = useState(null); 
  // drag = { id, offsetX, offsetY, lastValid: {x,y} }

  // ghost preview while dragging (even if invalid)
  const [ghost, setGhost] = useState(null);
  // ghost = { table, valid, reason }

  // outline drawing
  const [outlineDraft, setOutlineDraft] = useState(null); // {x,y,width,height}

  // view controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  // modes
  const [mode, setMode] = useState("select"); // select | add-table | draw-outline
  const [showGrid, setShowGrid] = useState(false);

  // snapping toggles (all optional)
  const [snapEnabled, setSnapEnabled] = useState({
    outlineEdges: true,
    outlineCenter: true,
    otherTables: true,
  });

  // add-table preset
  const [addPreset, setAddPreset] = useState({
    shape: "round",
    seats: 4,
    size: "md", // sm/md/lg
  });

  // publish validation
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // ---------- derived ----------
  const selectedTable = useMemo(() => tables.find((t) => t.id === selectedId) || null, [tables, selectedId]);

  // coordinate helpers (CSS transform: translate(pan) scale(zoom) => screen = world*zoom + pan)
  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    };
  }, [pan.x, pan.y, zoom]);

  // ---------- history (undo/redo) ----------
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback((nextState) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, deepCopy(nextState)];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx <= 0) return idx;
      const newIdx = idx - 1;
      const state = history[newIdx];
      if (state) {
        setOutline(state.outline);
        setAreas(state.areas);
        setTables(state.tables);
        setSelectedId(null);
      }
      return newIdx;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx >= history.length - 1) return idx;
      const newIdx = idx + 1;
      const state = history[newIdx];
      if (state) {
        setOutline(state.outline);
        setAreas(state.areas);
        setTables(state.tables);
        setSelectedId(null);
      }
      return newIdx;
    });
  }, [history]);

  // ---------- load existing ----------
  useEffect(() => {
    if (!restaurant) return;

    const fp = restaurant?.floor_plan_data;
    if (fp) {
      const loadedOutline = fp.outline || null;
      const loadedAreas = fp.areas || [];
      const loadedTables = fp.tables || [];
      setOutline(loadedOutline);
      setAreas(loadedAreas);
      setTables(loadedTables);
      // initialize history (single entry)
      setHistory([{ outline: loadedOutline, areas: loadedAreas, tables: loadedTables }]);
      setHistoryIndex(0);
      setSelectedId(null);
    } else {
      // empty init
      setOutline(null);
      setAreas([]);
      setTables([]);
      setHistory([{ outline: null, areas: [], tables: [] }]);
      setHistoryIndex(0);
      setSelectedId(null);
    }
  }, [restaurant]);

  // ---------- table sizing ----------
  const presetToSize = (size, shape) => {
    // modern “pretty” default sizes
    // round/square should remain symmetrical
    if (shape === "rectangle" || shape === "booth") {
      if (size === "sm") return { w: 90, h: 60 };
      if (size === "lg") return { w: 140, h: 90 };
      return { w: 120, h: 80 };
    }
    if (size === "sm") return { w: 70, h: 70 };
    if (size === "lg") return { w: 110, h: 110 };
    return { w: 90, h: 90 };
  };

  // ---------- collision + boundary ----------
  const constrainInsideOutline = useCallback((table) => {
    if (!outline) return table;

    // clamp FULL bounding box inside outline
    const pad = MIN_SPACING;

    const xMin = outline.x + pad;
    const yMin = outline.y + pad;
    const xMax = outline.x + outline.width - table.width - pad;
    const yMax = outline.y + outline.height - table.height - pad;

    return {
      ...table,
      x: clamp(table.x, xMin, xMax),
      y: clamp(table.y, yMin, yMax),
    };
  }, [outline]);

  const getCollisionReason = useCallback((candidate) => {
    if (outline) {
      // full box check (not center)
      const inside =
        candidate.x >= outline.x + MIN_SPACING &&
        candidate.y >= outline.y + MIN_SPACING &&
        candidate.x + candidate.width <= outline.x + outline.width - MIN_SPACING &&
        candidate.y + candidate.height <= outline.y + outline.height - MIN_SPACING;

      if (!inside) return "Outside restaurant boundary";
    }

    const a = getAABB(candidate);
    for (const t of tables) {
      if (t.id === candidate.id) continue;
      const b = getAABB(t);
      if (aabbOverlap(a, b, MIN_SPACING)) return `Overlaps ${t.label}`;
    }

    return null;
  }, [outline, tables]);

  // ---------- snapping ----------
  const applySnapping = useCallback((candidate) => {
    if (!outline && !snapEnabled.otherTables) return candidate;

    let x = candidate.x;
    let y = candidate.y;

    // Snap to outline edges/center (soft)
    if (outline) {
      const left = outline.x;
      const right = outline.x + outline.width;
      const top = outline.y;
      const bottom = outline.y + outline.height;

      if (snapEnabled.outlineEdges) {
        if (Math.abs(x - left) < SNAP_THRESHOLD) x = left;
        if (Math.abs(x + candidate.width - right) < SNAP_THRESHOLD) x = right - candidate.width;
        if (Math.abs(y - top) < SNAP_THRESHOLD) y = top;
        if (Math.abs(y + candidate.height - bottom) < SNAP_THRESHOLD) y = bottom - candidate.height;
      }

      if (snapEnabled.outlineCenter) {
        const cx = left + outline.width / 2;
        const cy = top + outline.height / 2;
        const tcx = x + candidate.width / 2;
        const tcy = y + candidate.height / 2;

        if (Math.abs(tcx - cx) < SNAP_THRESHOLD) x = cx - candidate.width / 2;
        if (Math.abs(tcy - cy) < SNAP_THRESHOLD) y = cy - candidate.height / 2;
      }
    }

    // Snap to other tables (edges)
    if (snapEnabled.otherTables) {
      tables.forEach((t) => {
        if (t.id === candidate.id) return;

        if (Math.abs(x - t.x) < SNAP_THRESHOLD) x = t.x;
        if (Math.abs(x - (t.x + t.width)) < SNAP_THRESHOLD) x = t.x + t.width;
        if (Math.abs((x + candidate.width) - t.x) < SNAP_THRESHOLD) x = t.x - candidate.width;
        if (Math.abs((x + candidate.width) - (t.x + t.width)) < SNAP_THRESHOLD) x = t.x + t.width - candidate.width;

        if (Math.abs(y - t.y) < SNAP_THRESHOLD) y = t.y;
        if (Math.abs(y - (t.y + t.height)) < SNAP_THRESHOLD) y = t.y + t.height;
        if (Math.abs((y + candidate.height) - t.y) < SNAP_THRESHOLD) y = t.y - candidate.height;
        if (Math.abs((y + candidate.height) - (t.y + t.height)) < SNAP_THRESHOLD) y = t.y + t.height - candidate.height;
      });
    }

    return { ...candidate, x, y };
  }, [outline, snapEnabled, tables]);

  // ---------- CRUD tables ----------
  const setTablesAndMaybeHistory = (nextTables, commitHistory = false) => {
    setTables(nextTables);
    if (commitHistory) {
      pushHistory({ outline, areas, tables: nextTables });
    }
  };

  const updateTable = useCallback((id, updates, commitHistory = false) => {
    setTables((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      if (commitHistory) pushHistory({ outline, areas, tables: next });
      return next;
    });
  }, [areas, outline, pushHistory]);

  const addTableAt = useCallback((x, y) => {
    const { w, h } = presetToSize(addPreset.size, addPreset.shape);

    const newTable = {
      id: Date.now() + Math.random(),
      x: x - w / 2,
      y: y - h / 2,
      width: w,
      height: h,
      seats: addPreset.seats,
      label: `T${tables.length + 1}`,
      shape: addPreset.shape,
      rotation: 0,
      state: "free",
    };

    let candidate = newTable;
    candidate = applySnapping(candidate);
    candidate = constrainInsideOutline(candidate);

    const reason = getCollisionReason(candidate);
    if (reason) {
      toast.error(`Can't place table: ${reason}`);
      return;
    }

    const next = [...tables, candidate];
    setTables(next);
    pushHistory({ outline, areas, tables: next });
    setSelectedId(candidate.id);
  }, [addPreset, tables, applySnapping, constrainInsideOutline, getCollisionReason, pushHistory, outline, areas]);

  const deleteTable = useCallback((id) => {
    setTables((prev) => {
      const next = prev.filter((t) => t.id !== id);
      pushHistory({ outline, areas, tables: next });
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  }, [areas, outline, pushHistory, selectedId]);

  const duplicateTable = useCallback((table) => {
    const copy = {
      ...table,
      id: Date.now() + Math.random(),
      x: table.x + 24,
      y: table.y + 24,
      label: `${table.label}-copy`,
    };

    let candidate = applySnapping(copy);
    candidate = constrainInsideOutline(candidate);
    const reason = getCollisionReason(candidate);

    if (reason) {
      toast.error(`Can't duplicate here: ${reason}`);
      return;
    }

    const next = [...tables, candidate];
    setTables(next);
    pushHistory({ outline, areas, tables: next });
    setSelectedId(candidate.id);
  }, [tables, applySnapping, constrainInsideOutline, getCollisionReason, pushHistory, outline, areas]);

  // ---------- validation ----------
  const validateFloorPlan = useCallback(() => {
    const errs = [];

    if (!outline) errs.push({ type: "critical", message: "Restaurant outline is required." });
    if (tables.length === 0) errs.push({ type: "critical", message: "Add at least one table." });

    // overlaps + boundary
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];

      // inside full box
      if (outline) {
        const inside =
          t.x >= outline.x + MIN_SPACING &&
          t.y >= outline.y + MIN_SPACING &&
          t.x + t.width <= outline.x + outline.width - MIN_SPACING &&
          t.y + t.height <= outline.y + outline.height - MIN_SPACING;

        if (!inside) errs.push({ type: "error", message: `Table ${t.label} is outside the outline.` });
      }

      // overlap
      const a = getAABB(t);
      for (let j = i + 1; j < tables.length; j++) {
        const b = getAABB(tables[j]);
        if (aabbOverlap(a, b, MIN_SPACING)) {
          errs.push({ type: "error", message: `Tables ${t.label} and ${tables[j].label} overlap.` });
        }
      }
    }

    setErrors(errs);
    return errs.filter((e) => e.type === "critical" || e.type === "error").length === 0;
  }, [outline, tables]);

  useEffect(() => {
    // live validation keeps UI honest
    validateFloorPlan();
  }, [outline, tables, validateFloorPlan]);

  // ---------- publish ----------
  const handlePublish = async () => {
    const ok = validateFloorPlan();
    if (!ok) {
      toast.error("Fix issues before publishing.");
      return;
    }

    setIsSaving(true);
    try {
      const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
      const floorPlanData = {
        outline,
        areas,
        tables,
        publishedAt: new Date().toISOString(),
      };

      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: floorPlanData,
        total_seats: totalSeats,
        available_seats: totalSeats,
      });

      // Sync tables entity (simple “replace all” strategy)
      const existingTables = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      await Promise.all(existingTables.map((t) => base44.entities.Table.delete(t.id)));

      for (const t of tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: t.label,
          capacity: t.seats,
          status: t.state || "free",
          position_x: t.x,
          position_y: t.y,
          shape: t.shape,
          rotation: t.rotation || 0,
        });
      }

      toast.success("Floor plan published!");
      onPublish?.();
    } catch (e) {
      toast.error("Failed to publish.");
    }
    setIsSaving(false);
  };

  // ---------- pointer interactions ----------
  const beginPan = (clientX, clientY) => {
    setIsPanning(true);
    setPanStart({ x: clientX, y: clientY, panX: pan.x, panY: pan.y });
  };

  const handleCanvasPointerDown = (e) => {
    // allow panning with:
    // - middle mouse button
    // - Alt + left click
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      beginPan(e.clientX, e.clientY);
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    if (mode === "add-table") {
      addTableAt(world.x, world.y);
      setMode("select");
      return;
    }

    if (mode === "draw-outline") {
      // start drawing rectangle
      setOutlineDraft({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    // in select mode, clicking empty clears selection
    setSelectedId(null);
  };

  const handleCanvasPointerMove = (e) => {
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: panStart.panX + dx, y: panStart.panY + dy });
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    // outline drafting
    if (outlineDraft && mode === "draw-outline") {
      const w = world.x - outlineDraft.x;
      const h = world.y - outlineDraft.y;

      const nx = w < 0 ? world.x : outlineDraft.x;
      const ny = h < 0 ? world.y : outlineDraft.y;

      setOutlineDraft({
        x: nx,
        y: ny,
        width: Math.abs(w),
        height: Math.abs(h),
      });
      return;
    }

    // dragging table
    if (drag) {
      const t = tables.find((x) => x.id === drag.id);
      if (!t) return;

      // desired top-left based on offset (NO JUMP)
      let candidate = {
        ...t,
        x: world.x - drag.offsetX,
        y: world.y - drag.offsetY,
      };

      candidate = applySnapping(candidate);
      candidate = constrainInsideOutline(candidate);

      const reason = getCollisionReason(candidate);
      const valid = !reason;

      setGhost({ table: candidate, valid, reason });

      if (valid) {
        // apply live move
        updateTable(drag.id, { x: candidate.x, y: candidate.y }, false);
        setDrag((prev) => (prev ? { ...prev, lastValid: { x: candidate.x, y: candidate.y } } : prev));
      }

      return;
    }
  };

  const handleCanvasPointerUp = () => {
    if (outlineDraft && mode === "draw-outline") {
      // finalize outline
      if (outlineDraft.width < 40 || outlineDraft.height < 40) {
        toast.error("Outline too small — drag bigger.");
        setOutlineDraft(null);
        return;
      }

      const nextOutline = {
        x: outlineDraft.x,
        y: outlineDraft.y,
        width: outlineDraft.width,
        height: outlineDraft.height,
      };

      setOutline(nextOutline);
      setOutlineDraft(null);

      // push history
      pushHistory({ outline: nextOutline, areas, tables });

      return;
    }

    // end drag
    if (drag) {
      // if invalid at end, snap back to last valid
      if (ghost && !ghost.valid) {
        updateTable(drag.id, { x: drag.lastValid.x, y: drag.lastValid.y }, false);
        toast.error(ghost.reason || "Invalid placement");
      }

      // commit history for drag end
      pushHistory({ outline, areas, tables });

      setDrag(null);
      setGhost(null);
    }

    setIsPanning(false);
    setPanStart(null);
  };

  const handleTablePointerDown = (e, table) => {
    e.stopPropagation();

    setSelectedId(table.id);

    if (mode !== "select") return;

    const world = screenToWorld(e.clientX, e.clientY);

    // store offset from cursor to top-left => smooth drag
    const offsetX = world.x - table.x;
    const offsetY = world.y - table.y;

    setDrag({
      id: table.id,
      offsetX,
      offsetY,
      lastValid: { x: table.x, y: table.y },
    });
  };

  // ---------- UI: totals ----------
  const totalSeats = useMemo(() => tables.reduce((s, t) => s + (t.seats || 0), 0), [tables]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={mode === "select" ? "default" : "outline"}
              onClick={() => setMode("select")}
            >
              <MousePointer2 className="w-4 h-4 mr-1" />
              Select
            </Button>

            <Button
              size="sm"
              variant={mode === "add-table" ? "default" : "outline"}
              onClick={() => setMode("add-table")}
            >
              + Table
            </Button>

            <Button
              size="sm"
              variant={mode === "draw-outline" ? "default" : "outline"}
              onClick={() => setMode("draw-outline")}
            >
              <PencilRuler className="w-4 h-4 mr-1" />
              Draw Outline
            </Button>

            <div className="flex items-center gap-2 ml-2">
              <Select
                value={addPreset.shape}
                onValueChange={(v) => setAddPreset((p) => ({ ...p, shape: v }))}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Shape" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TABLE_SHAPES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(addPreset.seats)}
                onValueChange={(v) => setAddPreset((p) => ({ ...p, seats: Number(v) }))}
              >
                <SelectTrigger className="w-24 h-9">
                  <SelectValue placeholder="Seats" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 6, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} seats
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={addPreset.size}
                onValueChange={(v) => setAddPreset((p) => ({ ...p, size: v }))}
              >
                <SelectTrigger className="w-24 h-9">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2">
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              <span className="flex items-center gap-1"><Grid3x3 className="w-4 h-4" /> Grid</span>
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={snapEnabled.outlineEdges}
                onCheckedChange={(v) => setSnapEnabled((s) => ({ ...s, outlineEdges: v }))}
              />
              Snap outline
            </label>

            <label className="flex items-center gap-2">
              <Switch
                checked={snapEnabled.otherTables}
                onCheckedChange={(v) => setSnapEnabled((s) => ({ ...s, otherTables: v }))}
              />
              Snap tables
            </label>
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-3">
          Tips: <b>Alt + drag</b> (or middle mouse) to pan • Scroll to zoom • Draw outline first • Tables are <b>freeform</b> (no grid lock)
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
      <Card className="relative overflow-hidden" style={{ height: "620px" }}>
        <div
          ref={canvasRef}
          className="absolute inset-0 bg-white"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerUp}
          style={{ touchAction: "none" }}
        >
          <svg
            width="100%"
            height="100%"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {/* optional grid (OFF by default) */}
            {showGrid && (
              <>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
                  </pattern>
                </defs>
                <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />
              </>
            )}

            {/* canvas boundary (subtle) */}
            <rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="2"
            />

            {/* outline */}
            {outline && (
              <rect
                x={outline.x}
                y={outline.y}
                width={outline.width}
                height={outline.height}
                fill="#10b98108"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="6,6"
                rx="14"
              />
            )}

            {/* outline draft */}
            {outlineDraft && (
              <rect
                x={outlineDraft.x}
                y={outlineDraft.y}
                width={outlineDraft.width}
                height={outlineDraft.height}
                fill="#0ea5e908"
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeDasharray="4,4"
                rx="14"
              />
            )}

            {/* areas (optional) */}
            {areas.map((a) => (
              <rect
                key={a.id}
                x={a.x}
                y={a.y}
                width={a.width}
                height={a.height}
                fill="#f59e0b10"
                stroke="#f59e0b"
                strokeWidth="1.5"
                rx="12"
              />
            ))}

            {/* tables */}
            {tables.map((table) => {
              const isSelected = selectedId === table.id;
              const state = TABLE_STATES[table.state || "free"];

              return (
                <g
                  key={table.id}
                  onPointerDown={(e) => handleTablePointerDown(e, table)}
                  style={{ cursor: mode === "select" ? "grab" : "pointer" }}
                  transform={`rotate(${table.rotation || 0}, ${table.x + table.width / 2}, ${table.y + table.height / 2})`}
                >
                  {/* shadow */}
                  <ellipse
                    cx={table.x + table.width / 2}
                    cy={table.y + table.height + 7}
                    rx={table.width / 2}
                    ry={6}
                    fill="#00000010"
                  />

                  {/* table shape */}
                  {table.shape === "round" ? (
                    <circle
                      cx={table.x + table.width / 2}
                      cy={table.y + table.height / 2}
                      r={table.width / 2}
                      fill={state.fill}
                      stroke={isSelected ? "#10b981" : state.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  ) : (
                    <rect
                      x={table.x}
                      y={table.y}
                      width={table.width}
                      height={table.height}
                      rx={12}
                      fill={state.fill}
                      stroke={isSelected ? "#10b981" : state.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  )}

                  {/* label pill */}
                  <g>
                    <rect
                      x={table.x + table.width / 2 - 28}
                      y={table.y + table.height / 2 - 12}
                      width={56}
                      height={24}
                      rx={12}
                      fill="#ffffffcc"
                      stroke="#e2e8f0"
                    />
                    <text
                      x={table.x + table.width / 2}
                      y={table.y + table.height / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontSize: 12, fontWeight: 700 }}
                      fill="#334155"
                    >
                      {table.label}
                    </text>
                  </g>

                  {/* seat dots */}
                  {Array.from({ length: Math.min(table.seats || 0, 12) }).map((_, i) => {
                    const seats = Math.max(1, table.seats || 1);
                    const angle = (i / seats) * Math.PI * 2;
                    const radius = table.width / 2 + 14;
                    const dotX = table.x + table.width / 2 + Math.cos(angle) * radius;
                    const dotY = table.y + table.height / 2 + Math.sin(angle) * radius;
                    return <circle key={i} cx={dotX} cy={dotY} r={3.6} fill="#94a3b8" />;
                  })}
                </g>
              );
            })}

            {/* ghost preview (shows invalid placement clearly) */}
            {ghost?.table && (
              <g
                opacity={0.55}
                transform={`rotate(${ghost.table.rotation || 0}, ${ghost.table.x + ghost.table.width / 2}, ${ghost.table.y + ghost.table.height / 2})`}
              >
                {ghost.table.shape === "round" ? (
                  <circle
                    cx={ghost.table.x + ghost.table.width / 2}
                    cy={ghost.table.y + ghost.table.height / 2}
                    r={ghost.table.width / 2}
                    fill={ghost.valid ? "#10b98133" : "#ef444433"}
                    stroke={ghost.valid ? "#10b981" : "#ef4444"}
                    strokeWidth="3"
                    strokeDasharray="6,6"
                  />
                ) : (
                  <rect
                    x={ghost.table.x}
                    y={ghost.table.y}
                    width={ghost.table.width}
                    height={ghost.table.height}
                    rx="12"
                    fill={ghost.valid ? "#10b98133" : "#ef444433"}
                    stroke={ghost.valid ? "#10b981" : "#ef4444"}
                    strokeWidth="3"
                    strokeDasharray="6,6"
                  />
                )}
              </g>
            )}

            {/* area labels (ALWAYS ON TOP) */}
            {areas.map((a) => {
              const pos = findLabelPosition(a, tables);
              return (
                <g key={`${a.id}-label`}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={160}
                    height={26}
                    rx={13}
                    fill="#ffffffee"
                    stroke="#e2e8f0"
                  />
                  <text
                    x={pos.x + 80}
                    y={pos.y + 13}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: 12, fontWeight: 700 }}
                    fill="#0f172a"
                  >
                    {a.name || "Area"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* ghost hint */}
          {ghost && drag && (
            <div className="absolute left-4 bottom-4">
              <div
                className={`px-3 py-2 rounded-xl text-sm shadow ${
                  ghost.valid ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                {ghost.valid ? "✅ Placement OK" : `❌ ${ghost.reason}`}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Selected Table Toolbar */}
      {selectedTable && (
        <Card className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={selectedTable.label}
                onChange={(e) => updateTable(selectedTable.id, { label: e.target.value }, false)}
                className="w-28"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Seats</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={selectedTable.seats}
                onChange={(e) => updateTable(selectedTable.id, { seats: Number(e.target.value || 1) }, false)}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Shape</label>
              <Select
                value={selectedTable.shape}
                onValueChange={(v) => {
                  const { w, h } = presetToSize(addPreset.size, v);
                  // keep center same when changing shape
                  const cx = selectedTable.x + selectedTable.width / 2;
                  const cy = selectedTable.y + selectedTable.height / 2;
                  updateTable(
                    selectedTable.id,
                    { shape: v, width: w, height: h, x: cx - w / 2, y: cy - h / 2 },
                    true
                  );
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TABLE_SHAPES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Rotation</label>
              <Input
                type="number"
                min="0"
                max="359"
                value={selectedTable.rotation || 0}
                onChange={(e) => updateTable(selectedTable.id, { rotation: Number(e.target.value || 0) % 360 }, false)}
                className="w-24"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateTable(selectedTable.id, { rotation: ((selectedTable.rotation || 0) + 15) % 360 }, false)}
              >
                <RotateCw className="w-4 h-4 mr-1" />
                +15°
              </Button>

              <Button size="sm" variant="outline" onClick={() => duplicateTable(selectedTable)}>
                <Copy className="w-4 h-4 mr-1" />
                Duplicate
              </Button>

              <Button size="sm" variant="destructive" onClick={() => deleteTable(selectedTable.id)}>
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-500 mt-3">
            Drag is freeform. If you see red, it means overlap/boundary issue — the planner won’t let you drop there.
          </div>
        </Card>
      )}

      {/* Publish */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{totalSeats} Total Seats</div>
          <div className="text-sm text-slate-500">{tables.length} tables</div>
        </div>

        <Button
          onClick={handlePublish}
          disabled={isSaving || errors.some((e) => e.type === "critical" || e.type === "error")}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-4 h-4 mr-2" />
          )}
          Publish Floor Plan
        </Button>
      </div>
    </div>
  );
}

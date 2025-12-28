import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Square,
  Circle,
  Type,
  Pencil,
  Layers,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Sparkles,
  Grid3x3,
  CheckCircle,
  Loader2,
  AlertCircle,
  Undo,
  Redo,
  BringToFront,
  SendToBack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * FLOOR PLAN STUDIO (Premium)
 * - Free placement (grid optional)
 * - Walls + text labels (non-reservable)
 * - Resize + rotate handles
 * - Multi-select, group, lock items
 * - Right click context menu with Ask AI
 * - Optional overlap prevention + auto-fix
 * - Area labels always visible
 */

const CANVAS_W = 2400;
const CANVAS_H = 1600;

const GRID_SIZE = 40;
const SNAP_STEP = 10; // finer than grid
const MIN_SIZE = 28;

const DEFAULT_TABLES = [
  { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 78, h: 78, shape: "square" },
  { seats: 6, w: 96, h: 78, shape: "rect" },
  { seats: 8, w: 118, h: 82, shape: "rect" },
  { seats: 10, w: 140, h: 86, shape: "rect" },
];

const COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#64748b",
  "#111827",
  "#ffffff",
];

const TABLE_STYLE_PRESET = {
  fill: "#ffffff",
  stroke: "#cbd5e1",
  shadow: true,
};

const AREA_STYLE_PRESET = {
  fill: "#e0f2fe",
  stroke: "#60a5fa",
  dash: "6,6",
  opacity: 0.35,
};

const WALL_STYLE_PRESET = {
  stroke: "#111827",
  width: 6,
};

const TEXT_STYLE_PRESET = {
  color: "#111827",
  size: 16,
};

function deepClone(obj) {
  // structuredClone is best, fallback to JSON
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function snapValue(v, step) {
  return Math.round(v / step) * step;
}

function rectsIntersect(a, b, pad = 0) {
  return !(
    a.x + a.w + pad <= b.x ||
    a.x >= b.x + b.w + pad ||
    a.y + a.h + pad <= b.y ||
    a.y >= b.y + b.h + pad
  );
}

// Axis-aligned bounds for rotated rect (approx)
function rotatedBBox(item) {
  if (item.type !== "table" && item.type !== "area" && item.type !== "textBox") {
    return null;
  }
  const x = item.x;
  const y = item.y;
  const w = item.w;
  const h = item.h;
  const r = ((item.rotation || 0) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const corners = [
    { x: x, y: y },
    { x: x + w, y: y },
    { x: x + w, y: y + h },
    { x: x, y: y + h },
  ].map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: cx + dx * Math.cos(r) - dy * Math.sin(r),
      y: cy + dx * Math.sin(r) + dy * Math.cos(r),
    };
  });

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function selectionBBox(items) {
  const boxes = items
    .map((it) => (it.type === "wall" ? null : rotatedBBox(it)))
    .filter(Boolean);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function makeId(prefix = "it") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeLine(x1, y1, x2, y2) {
  return { x1, y1, x2, y2 };
}

function midpointLine(w) {
  return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const viewportRef = useRef(null);

  // Studio view state
  const [tool, setTool] = useState("select"); // select | pan | table | wall | area | text
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 60, y: 40 });

  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [preventOverlap, setPreventOverlap] = useState(true);

  // Data model
  const [outline, setOutline] = useState(null); // optional rect outline (fast)
  const [items, setItems] = useState([]); // tables + walls + text + areas

  // Selection
  const [selection, setSelection] = useState([]); // ids
  const selectedItems = useMemo(
    () => items.filter((it) => selection.includes(it.id)),
    [items, selection]
  );

  // Drag session (imperative to reduce jitter)
  const dragRef = useRef({
    active: false,
    kind: null, // move|resize|rotate|drawWall|drawArea|placeTable|placeText|pan|drawOutline
    startClient: null,
    startWorld: null,
    startPan: null,
    startItems: null,
    targetId: null,
    handle: null,
    tempId: null,
  });

  // Context menu
  const [ctxMenu, setCtxMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    targetId: null,
  });

  // Color popover
  const [colorPop, setColorPop] = useState({
    open: false,
    x: 0,
    y: 0,
    targetId: null,
    field: "fill", // fill|stroke|text
  });

  // AI modal
  const [aiModal, setAiModal] = useState({
    open: false,
    targetId: null,
    prompt: "",
    mode: "selection", // selection|layout
    isRunning: false,
  });

  // History
  const [history, setHistory] = useState([]);
  const [hIndex, setHIndex] = useState(-1);

  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // ---------- Load existing floor plan ----------
  useEffect(() => {
    if (!restaurant) return;

    const fp = restaurant.floor_plan_data;
    if (fp && (fp.items || fp.outline)) {
      const loadedOutline = fp.outline || null;
      const loadedItems = Array.isArray(fp.items) ? fp.items : [];
      setOutline(loadedOutline);
      setItems(loadedItems);
      setSelection([]);
      // push history snapshot after state set
      setTimeout(() => {
        pushHistory({ outline: loadedOutline, items: loadedItems });
      }, 0);
    } else {
      // fresh
      setOutline(null);
      setItems([]);
      setSelection([]);
      setTimeout(() => {
        pushHistory({ outline: null, items: [] });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  function snapshot(nextOutline = outline, nextItems = items) {
    return deepClone({ outline: nextOutline, items: nextItems });
  }

  function pushHistory(stateObj) {
    setHistory((prev) => {
      const trimmed = prev.slice(0, hIndex + 1);
      trimmed.push(deepClone(stateObj));
      return trimmed;
    });
    setHIndex((prev) => prev + 1);
  }

  function undo() {
    if (hIndex <= 0) return;
    const prev = history[hIndex - 1];
    setOutline(prev.outline || null);
    setItems(prev.items || []);
    setSelection([]);
    setHIndex((i) => i - 1);
  }

  function redo() {
    if (hIndex >= history.length - 1) return;
    const next = history[hIndex + 1];
    setOutline(next.outline || null);
    setItems(next.items || []);
    setSelection([]);
    setHIndex((i) => i + 1);
  }

  // ---------- Coordinate helpers ----------
  function clientToWorld(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    return { x: wx, y: wy };
  }

  function worldToClient(pt) {
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: rect.left + pan.x + pt.x * zoom,
      y: rect.top + pan.y + pt.y * zoom,
    };
  }

  // ---------- Validation ----------
  function computeWarnings(nextItems) {
    const warn = [];

    const tables = nextItems.filter((i) => i.type === "table");
    if (!tables.length) {
      warn.push({ type: "critical", message: "Add at least one table." });
    }

    // overlaps (approx)
    for (let i = 0; i < tables.length; i++) {
      const a = rotatedBBox(tables[i]);
      for (let j = i + 1; j < tables.length; j++) {
        const b = rotatedBBox(tables[j]);
        if (a && b && rectsIntersect(a, b, 6)) {
          warn.push({
            type: "warn",
            message: `Tables overlap: ${tables[i].label || "Table"} & ${
              tables[j].label || "Table"
            }`,
          });
        }
      }
    }

    // outside outline (soft warning only)
    if (outline) {
      tables.forEach((t) => {
        const bb = rotatedBBox(t);
        if (!bb) return;
        const out =
          bb.x < outline.x ||
          bb.y < outline.y ||
          bb.x + bb.w > outline.x + outline.w ||
          bb.y + bb.h > outline.y + outline.h;
        if (out) {
          warn.push({
            type: "info",
            message: `${t.label || "A table"} is outside the outline (allowed, but diners may not see it).`,
          });
        }
      });
    }

    return warn;
  }

  useEffect(() => {
    setErrors(computeWarnings(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, outline]);

  // ---------- Item creation ----------
  function addTablePreset(seats) {
    const preset =
      DEFAULT_TABLES.find((p) => p.seats === seats) || DEFAULT_TABLES[1];
    setTool("table");
    dragRef.current.pendingTable = { seats, ...preset };
    toast.message("Click on canvas to place table");
  }

  function createTableAt(x, y, preset) {
    const seats = preset?.seats ?? 4;
    const w = preset?.w ?? 78;
    const h = preset?.h ?? 78;
    const shape = preset?.shape ?? "square";

    const id = makeId("tbl");
    const label = `T${items.filter((i) => i.type === "table").length + 1}`;
    const newTable = {
      id,
      type: "table",
      x: x - w / 2,
      y: y - h / 2,
      w,
      h,
      rotation: 0,
      shape,
      seats,
      label,
      locked: false,
      z: 50,
      style: deepClone(TABLE_STYLE_PRESET),
    };
    return newTable;
  }

  function addAreaAt(x, y) {
    const id = makeId("area");
    const newArea = {
      id,
      type: "area",
      x: x - 220,
      y: y - 140,
      w: 440,
      h: 280,
      rotation: 0,
      name: "Area",
      locked: false,
      z: 10,
      style: deepClone(AREA_STYLE_PRESET),
    };
    setItems((prev) => {
      const next = [...prev, newArea];
      pushHistory({ outline, items: next });
      return next;
    });
    setSelection([id]);
  }

  function addTextAt(x, y, text = "Note") {
    const id = makeId("txt");
    const newText = {
      id,
      type: "textBox",
      x,
      y,
      w: 160,
      h: 36,
      rotation: 0,
      text,
      locked: false,
      z: 5, // background-ish
      style: deepClone(TEXT_STYLE_PRESET),
    };
    setItems((prev) => {
      const next = [...prev, newText];
      pushHistory({ outline, items: next });
      return next;
    });
    setSelection([id]);
  }

  function addWallSegment(x1, y1, x2, y2) {
    const id = makeId("wall");
    const wall = {
      id,
      type: "wall",
      ...normalizeLine(x1, y1, x2, y2),
      locked: false,
      z: 20,
      style: deepClone(WALL_STYLE_PRESET),
    };
    setItems((prev) => {
      const next = [...prev, wall];
      pushHistory({ outline, items: next });
      return next;
    });
    setSelection([id]);
  }

  // ---------- Layering ----------
  function sortByZ(a, b) {
    return (a.z || 0) - (b.z || 0);
  }

  function bringToFront(ids) {
    setItems((prev) => {
      const maxZ = Math.max(0, ...prev.map((i) => i.z || 0));
      const next = prev.map((it) =>
        ids.includes(it.id) ? { ...it, z: maxZ + 5 } : it
      );
      pushHistory({ outline, items: next });
      return next;
    });
  }

  function sendToBack(ids) {
    setItems((prev) => {
      const minZ = Math.min(0, ...prev.map((i) => i.z || 0));
      const next = prev.map((it) =>
        ids.includes(it.id) ? { ...it, z: minZ - 5 } : it
      );
      pushHistory({ outline, items: next });
      return next;
    });
  }

  // ---------- Lock / Group ----------
  function toggleLock(ids) {
    setItems((prev) => {
      const next = prev.map((it) =>
        ids.includes(it.id) ? { ...it, locked: !it.locked } : it
      );
      pushHistory({ outline, items: next });
      return next;
    });
  }

  function groupSelection() {
    if (selection.length < 2) return;
    const gid = makeId("grp");
    setItems((prev) => {
      const next = prev.map((it) =>
        selection.includes(it.id) ? { ...it, groupId: gid } : it
      );
      pushHistory({ outline, items: next });
      return next;
    });
    toast.success("Grouped");
  }

  function ungroupSelection() {
    setItems((prev) => {
      const next = prev.map((it) =>
        selection.includes(it.id) ? { ...it, groupId: null } : it
      );
      pushHistory({ outline, items: next });
      return next;
    });
    toast.success("Ungrouped");
  }

  // ---------- Duplicate / Delete ----------
  function duplicateIds(ids) {
    setItems((prev) => {
      const clones = [];
      prev.forEach((it) => {
        if (!ids.includes(it.id)) return;
        const copy = deepClone(it);
        copy.id = makeId(it.type);
        copy.locked = false;
        copy.z = (it.z || 0) + 1;
        // offset copy
        if (it.type === "wall") {
          copy.x1 += 20;
          copy.y1 += 20;
          copy.x2 += 20;
          copy.y2 += 20;
        } else {
          copy.x += 20;
          copy.y += 20;
        }
        if (it.type === "table") copy.label = `${it.label || "T"}-copy`;
        clones.push(copy);
      });
      const next = [...prev, ...clones];
      pushHistory({ outline, items: next });
      return next;
    });
    toast.success("Duplicated");
  }

  function deleteIds(ids) {
    setItems((prev) => {
      const next = prev.filter((it) => !ids.includes(it.id));
      pushHistory({ outline, items: next });
      return next;
    });
    setSelection((sel) => sel.filter((id) => !ids.includes(id)));
  }

  // ---------- Snapping / Overlap control ----------
  function applySnap(it, dx, dy, isShiftHeld) {
    if (!snapToGrid || isShiftHeld) return { dx, dy };
    // subtle snap (not big grid lock)
    const nextX = it.type === "wall" ? it.x1 + dx : it.x + dx;
    const nextY = it.type === "wall" ? it.y1 + dy : it.y + dy;
    const snappedX = snapValue(nextX, SNAP_STEP);
    const snappedY = snapValue(nextY, SNAP_STEP);
    const sdx = snappedX - (it.type === "wall" ? it.x1 : it.x);
    const sdy = snappedY - (it.type === "wall" ? it.y1 : it.y);
    return { dx: sdx, dy: sdy };
  }

  function wouldOverlap(nextItems, movingIds) {
    const tables = nextItems.filter((i) => i.type === "table");
    const moved = tables.filter((t) => movingIds.includes(t.id));
    const stationary = tables.filter((t) => !movingIds.includes(t.id));
    for (const m of moved) {
      const bbM = rotatedBBox(m);
      for (const s of stationary) {
        const bbS = rotatedBBox(s);
        if (bbM && bbS && rectsIntersect(bbM, bbS, 6)) return true;
      }
    }
    return false;
  }

  // ---------- Pointer events ----------
  function onCanvasPointerDown(e) {
    // Close menus
    setCtxMenu((m) => ({ ...m, open: false }));
    setColorPop((p) => ({ ...p, open: false }));

    // Right click handled by context menu
    if (e.button === 2) return;

    const world = clientToWorld(e);

    // PAN tool
    if (tool === "pan" || e.spaceKey) {
      dragRef.current = {
        active: true,
        kind: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startPan: { ...pan },
      };
      return;
    }

    // TABLE placement tool
    if (tool === "table" && dragRef.current.pendingTable) {
      const newTable = createTableAt(world.x, world.y, dragRef.current.pendingTable);
      setItems((prev) => {
        const next = [...prev, newTable];
        pushHistory({ outline, items: next });
        return next;
      });
      setSelection([newTable.id]);
      return;
    }

    // WALL drawing tool
    if (tool === "wall") {
      const id = makeId("wallPreview");
      dragRef.current = {
        active: true,
        kind: "drawWall",
        startWorld: world,
        tempId: id,
      };
      const preview = {
        id,
        type: "wall",
        x1: world.x,
        y1: world.y,
        x2: world.x,
        y2: world.y,
        locked: true,
        z: 19,
        style: deepClone(WALL_STYLE_PRESET),
        _preview: true,
      };
      setItems((prev) => [...prev, preview]);
      return;
    }

    // AREA add
    if (tool === "area") {
      addAreaAt(world.x, world.y);
      return;
    }

    // TEXT add
    if (tool === "text") {
      addTextAt(world.x, world.y, "Label");
      return;
    }

    // OUTLINE draw (quick)
    if (tool === "outline") {
      dragRef.current = {
        active: true,
        kind: "drawOutline",
        startWorld: world,
      };
      setOutline({ x: world.x, y: world.y, w: 10, h: 10 });
      return;
    }

    // otherwise: click empty canvas -> clear selection
    if (!e.shiftKey) setSelection([]);
  }

  function hitTest(world) {
    // Top-most item first
    const sorted = [...items].sort((a, b) => (b.z || 0) - (a.z || 0));
    for (const it of sorted) {
      if (it.type === "wall") {
        // distance to segment threshold
        const { x1, y1, x2, y2 } = it;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : ((world.x - x1) * dx + (world.y - y1) * dy) / len2;
        const tt = clamp(t, 0, 1);
        const px = x1 + tt * dx;
        const py = y1 + tt * dy;
        const dist = Math.hypot(world.x - px, world.y - py);
        if (dist <= (it.style?.width || 6) + 6) return it;
      } else {
        const bb = rotatedBBox(it);
        if (!bb) continue;
        if (world.x >= bb.x && world.x <= bb.x + bb.w && world.y >= bb.y && world.y <= bb.y + bb.h) {
          return it;
        }
      }
    }
    return null;
  }

  function onViewportPointerDown(e) {
    // stop right click default context
    // handled in onContextMenu
    if (e.button === 2) return;

    const world = clientToWorld(e);
    const hit = hitTest(world);

    // If click on item in select tool, select it and begin move
    if (tool === "select" && hit && !hit.locked) {
      const nextSel = (() => {
        if (e.shiftKey) {
          return selection.includes(hit.id)
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id];
        }
        return selection.includes(hit.id) ? selection : [hit.id];
      })();
      setSelection(nextSel);

      dragRef.current = {
        active: true,
        kind: "move",
        startWorld: world,
        startItems: deepClone(items),
        targetId: hit.id,
      };
      return;
    }

    // if click on locked item, just select (no move)
    if (tool === "select" && hit && hit.locked) {
      if (!e.shiftKey) setSelection([hit.id]);
      return;
    }

    // otherwise canvas pointer down
    onCanvasPointerDown(e);
  }

  function onViewportPointerMove(e) {
    const dr = dragRef.current;
    if (!dr.active) return;

    // PAN
    if (dr.kind === "pan") {
      const dx = e.clientX - dr.startClient.x;
      const dy = e.clientY - dr.startClient.y;
      setPan({ x: dr.startPan.x + dx, y: dr.startPan.y + dy });
      return;
    }

    const world = clientToWorld(e);

    // DRAW WALL PREVIEW
    if (dr.kind === "drawWall") {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== dr.tempId) return it;
          // optional angle snap with shift
          let x2 = world.x;
          let y2 = world.y;
          if (e.shiftKey) {
            const dx = x2 - dr.startWorld.x;
            const dy = y2 - dr.startWorld.y;
            const ang = Math.atan2(dy, dx);
            const snapAng = (Math.PI / 4) * Math.round(ang / (Math.PI / 4));
            const len = Math.hypot(dx, dy);
            x2 = dr.startWorld.x + Math.cos(snapAng) * len;
            y2 = dr.startWorld.y + Math.sin(snapAng) * len;
          }
          return { ...it, x2, y2 };
        })
      );
      return;
    }

    // DRAW OUTLINE
    if (dr.kind === "drawOutline") {
      const x = Math.min(dr.startWorld.x, world.x);
      const y = Math.min(dr.startWorld.y, world.y);
      const w = Math.abs(world.x - dr.startWorld.x);
      const h = Math.abs(world.y - dr.startWorld.y);
      setOutline({ x, y, w, h });
      return;
    }

    // MOVE selection
    if (dr.kind === "move" && dr.startItems) {
      const dxRaw = world.x - dr.startWorld.x;
      const dyRaw = world.y - dr.startWorld.y;

      // move only selected, not locked
      const startItems = dr.startItems;
      const movingIds = selection.length ? selection : [dr.targetId];

      const isShiftHeld = e.shiftKey;

      let next = startItems.map((it) => {
        if (!movingIds.includes(it.id)) return it;
        if (it.locked) return it;

        if (it.type === "wall") {
          const { dx, dy } = applySnap(it, dxRaw, dyRaw, isShiftHeld);
          return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
        } else {
          const { dx, dy } = applySnap(it, dxRaw, dyRaw, isShiftHeld);
          return { ...it, x: it.x + dx, y: it.y + dy };
        }
      });

      if (preventOverlap && wouldOverlap(next, movingIds)) {
        // don't apply overlap move (keeps it smooth but safe)
        return;
      }
      setItems(next);
      return;
    }

    // RESIZE / ROTATE handled via handles (see below)
  }

  function onViewportPointerUp() {
    const dr = dragRef.current;
    if (!dr.active) return;

    if (dr.kind === "drawWall") {
      // commit wall
      setItems((prev) => {
        const preview = prev.find((i) => i.id === dr.tempId);
        const rest = prev.filter((i) => i.id !== dr.tempId);
        if (!preview) return prev;

        const len = Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1);
        if (len < 10) return rest; // ignore tiny line

        const committed = {
          ...preview,
          id: makeId("wall"),
          locked: false,
          _preview: undefined,
        };
        const next = [...rest, committed];
        pushHistory({ outline, items: next });
        setSelection([committed.id]);
        return next;
      });
    }

    if (dr.kind === "move" || dr.kind === "drawOutline") {
      pushHistory(snapshot());
    }

    dragRef.current = { active: false, kind: null };
  }

  // ---------- Context menu ----------
  function onContextMenu(e) {
    e.preventDefault();
    setColorPop((p) => ({ ...p, open: false }));

    const world = clientToWorld(e);
    const hit = hitTest(world);

    if (hit) {
      // select it if not selected
      if (!selection.includes(hit.id)) setSelection([hit.id]);
      setCtxMenu({ open: true, x: e.clientX, y: e.clientY, targetId: hit.id });
    } else {
      setCtxMenu({ open: true, x: e.clientX, y: e.clientY, targetId: null });
    }
  }

  function openColorPicker(field) {
    setCtxMenu((m) => ({ ...m, open: false }));
    setColorPop({
      open: true,
      x: ctxMenu.x,
      y: ctxMenu.y,
      targetId: ctxMenu.targetId,
      field,
    });
  }

  function applyColor(color) {
    const ids = ctxMenu.targetId ? [ctxMenu.targetId] : selection;

    setItems((prev) => {
      const next = prev.map((it) => {
        if (!ids.includes(it.id)) return it;
        if (it.locked) return it;

        if (it.type === "textBox") {
          if (colorPop.field === "text") {
            return { ...it, style: { ...it.style, color } };
          }
          return it;
        }

        if (it.type === "wall") {
          if (colorPop.field === "stroke") {
            return { ...it, style: { ...it.style, stroke: color } };
          }
          return it;
        }

        // table / area
        if (colorPop.field === "fill") {
          return { ...it, style: { ...it.style, fill: color } };
        }
        if (colorPop.field === "stroke") {
          return { ...it, style: { ...it.style, stroke: color } };
        }
        return it;
      });
      pushHistory({ outline, items: next });
      return next;
    });

    setColorPop((p) => ({ ...p, open: false }));
  }

  // ---------- Resize + Rotate handles ----------
  const selBBox = useMemo(() => selectionBBox(selectedItems), [selectedItems]);

  function startRotate(e) {
    e.stopPropagation();
    if (!selBBox) return;
    dragRef.current = {
      active: true,
      kind: "rotate",
      startWorld: clientToWorld(e),
      startItems: deepClone(items),
      startBBox: selBBox,
    };
  }

  function startResize(e, handle) {
    e.stopPropagation();
    dragRef.current = {
      active: true,
      kind: "resize",
      handle,
      startWorld: clientToWorld(e),
      startItems: deepClone(items),
      startBBox: selBBox,
    };
  }

  // Attach rotate/resize behaviors to pointermove
  useEffect(() => {
    function onMove(e) {
      const dr = dragRef.current;
      if (!dr.active) return;
      if (dr.kind !== "resize" && dr.kind !== "rotate") return;
      if (!dr.startItems || !dr.startBBox) return;

      const world = clientToWorld(e);
      const movingIds = selection;

      if (dr.kind === "rotate") {
        const bb = dr.startBBox;
        const cx = bb.x + bb.w / 2;
        const cy = bb.y + bb.h / 2;

        const a0 = Math.atan2(dr.startWorld.y - cy, dr.startWorld.x - cx);
        const a1 = Math.atan2(world.y - cy, world.x - cx);
        const deg = ((a1 - a0) * 180) / Math.PI;

        const next = dr.startItems.map((it) => {
          if (!movingIds.includes(it.id)) return it;
          if (it.locked) return it;
          if (it.type === "wall") return it; // skip wall rotation for now (keep simple)
          return { ...it, rotation: (it.rotation || 0) + deg };
        });

        setItems(next);
        return;
      }

      if (dr.kind === "resize") {
        const bb0 = dr.startBBox;
        let dx = world.x - dr.startWorld.x;
        let dy = world.y - dr.startWorld.y;

        // no hard grid restriction, optional snap
        if (snapToGrid && !e.shiftKey) {
          dx = snapValue(dx, SNAP_STEP);
          dy = snapValue(dy, SNAP_STEP);
        }

        // Resize tables/areas/text (not walls)
        const next = dr.startItems.map((it) => {
          if (!movingIds.includes(it.id)) return it;
          if (it.locked) return it;
          if (it.type === "wall") return it;

          // Resize in local axis-aligned space (simple)
          let x = it.x;
          let y = it.y;
          let w = it.w;
          let h = it.h;

          const handle = dr.handle;

          if (handle.includes("e")) w = clamp(w + dx, MIN_SIZE, 900);
          if (handle.includes("s")) h = clamp(h + dy, MIN_SIZE, 900);
          if (handle.includes("w")) {
            w = clamp(w - dx, MIN_SIZE, 900);
            x = it.x + dx;
          }
          if (handle.includes("n")) {
            h = clamp(h - dy, MIN_SIZE, 900);
            y = it.y + dy;
          }

          // keep text height reasonable
          if (it.type === "textBox") {
            h = clamp(h, 28, 120);
            w = clamp(w, 80, 600);
          }

          return { ...it, x, y, w, h };
        });

        if (preventOverlap && wouldOverlap(next, movingIds)) return;
        setItems(next);
      }
    }

    function onUp() {
      const dr = dragRef.current;
      if (!dr.active) return;
      if (dr.kind === "resize" || dr.kind === "rotate") {
        pushHistory(snapshot());
      }
      dragRef.current = { active: false, kind: null };
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selection, selBBox, snapToGrid, preventOverlap, outline, history, hIndex]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    function onKeyDown(e) {
      // delete
      if ((e.key === "Backspace" || e.key === "Delete") && selection.length) {
        deleteIds(selection);
      }
      // escape
      if (e.key === "Escape") {
        setCtxMenu((m) => ({ ...m, open: false }));
        setColorPop((p) => ({ ...p, open: false }));
        setAiModal((a) => ({ ...a, open: false }));
        setSelection([]);
      }
      // undo/redo
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (isCmd && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // quick tools
      if (e.key === "v") setTool("select");
      if (e.key === "h") setTool("pan");
      if (e.key === "w") setTool("wall");
      if (e.key === "t") setTool("text");
      if (e.key === "a") setTool("area");
      if (e.key === "o") setTool("outline");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, history, hIndex, outline, items]);

  // ---------- “Ask AI” (local placeholder + hook point for real AI) ----------
  async function runAi(prompt, mode) {
    // This is a “good enough” local AI stand-in.
    // You can replace internals with your Base44 LLM call later.
    const lower = prompt.toLowerCase();

    if (mode === "layout") {
      // Generate tables based on text (heuristic)
      const seatsMatch = lower.match(/(\d+)\s*seats/);
      const totalSeatsTarget = seatsMatch ? parseInt(seatsMatch[1], 10) : 40;

      const mix = (() => {
        if (lower.includes("date night")) return { two: 0.5, four: 0.35, six: 0.15 };
        if (lower.includes("family")) return { two: 0.15, four: 0.5, six: 0.35 };
        return { two: 0.25, four: 0.55, six: 0.20 };
      })();

      const counts = { 2: 0, 4: 0, 6: 0, 8: 0, 10: 0 };
      let remaining = totalSeatsTarget;

      while (remaining > 0) {
        const r = Math.random();
        let pick = 4;
        if (r < mix.two) pick = 2;
        else if (r < mix.two + mix.four) pick = 4;
        else pick = 6;

        if (remaining - pick < 0) pick = remaining >= 4 ? 4 : 2;
        counts[pick] += 1;
        remaining -= pick;
        if (Object.values(counts).reduce((a, b) => a + b, 0) > 60) break;
      }

      // Place inside outline if exists, else center area
      const region = outline
        ? { x: outline.x + 80, y: outline.y + 80, w: outline.w - 160, h: outline.h - 160 }
        : { x: 200, y: 160, w: 1200, h: 800 };

      const next = items.filter((it) => it.type !== "table"); // replace tables
      let x = region.x;
      let y = region.y;
      const rowH = 120;
      const gap = 34;

      const makeOne = (seats) => {
        const preset = DEFAULT_TABLES.find((p) => p.seats === seats) || DEFAULT_TABLES[1];
        const t = createTableAt(x, y, { seats, ...preset });
        // keep consistent labels
        t.label = `T${next.filter((i) => i.type === "table").length + 1}`;
        t.x = x;
        t.y = y;
        return t;
      };

      const addMany = (seats, n) => {
        for (let i = 0; i < n; i++) {
          const preset = DEFAULT_TABLES.find((p) => p.seats === seats) || DEFAULT_TABLES[1];
          const w = preset.w + gap;
          if (x + w > region.x + region.w) {
            x = region.x;
            y += rowH;
          }
          if (y + rowH > region.y + region.h) break;

          const t = createTableAt(x + preset.w / 2, y + preset.h / 2, { seats, ...preset });
          t.x = x;
          t.y = y;
          next.push(t);
          x += w;
        }
      };

      // order: bigger first (looks nicer)
      addMany(6, counts[6]);
      addMany(4, counts[4]);
      addMany(2, counts[2]);

      return { type: "layout", nextItems: next };
    }

    // Selection AI: simple smart actions
    const ids = selection.length ? selection : aiModal.targetId ? [aiModal.targetId] : [];
    if (!ids.length) return { type: "none" };

    if (lower.includes("align") || lower.includes("straight")) {
      // align selected items to same y
      const moving = items.filter((it) => ids.includes(it.id) && it.type !== "wall" && !it.locked);
      if (!moving.length) return { type: "none" };
      const targetY = Math.round(moving[0].y);
      const nextItems = items.map((it) => (ids.includes(it.id) ? { ...it, y: targetY } : it));
      return { type: "selection", nextItems };
    }

    if (lower.includes("space") || lower.includes("spread")) {
      // distribute horizontally
      const moving = items
        .filter((it) => ids.includes(it.id) && it.type !== "wall" && !it.locked)
        .sort((a, b) => a.x - b.x);

      if (moving.length < 2) return { type: "none" };
      const left = moving[0].x;
      const right = moving[moving.length - 1].x;
      const step = (right - left) / (moving.length - 1);

      const nextItems = items.map((it) => {
        const idx = moving.findIndex((m) => m.id === it.id);
        if (idx === -1) return it;
        return { ...it, x: left + step * idx };
      });
      return { type: "selection", nextItems };
    }

    if (lower.includes("rotate")) {
      const nextItems = items.map((it) => {
        if (!ids.includes(it.id) || it.locked) return it;
        if (it.type === "wall") return it;
        return { ...it, rotation: ((it.rotation || 0) + 45) % 360 };
      });
      return { type: "selection", nextItems };
    }

    return { type: "none" };
  }

  async function handleAskAi(mode = "selection", targetId = null) {
    setAiModal({
      open: true,
      targetId,
      prompt: "",
      mode,
      isRunning: false,
    });
    setCtxMenu((m) => ({ ...m, open: false }));
  }

  async function runAiApply() {
    setAiModal((a) => ({ ...a, isRunning: true }));
    try {
      const res = await runAi(aiModal.prompt || "", aiModal.mode);
      if (res?.nextItems) {
        setItems(res.nextItems);
        pushHistory({ outline, items: res.nextItems });
        toast.success("AI applied");
      } else {
        toast.message("AI had no changes for that request.");
      }
    } catch {
      toast.error("AI failed");
    } finally {
      setAiModal((a) => ({ ...a, isRunning: false, open: false }));
    }
  }

  // ---------- Publish ----------
  function floorPlanDataForSave() {
    return {
      outline,
      items,
      settings: { showGrid, snapToGrid, preventOverlap },
      publishedAt: new Date().toISOString(),
    };
  }

  async function handlePublish() {
    const warn = computeWarnings(items);
    const critical = warn.filter((w) => w.type === "critical");
    if (critical.length) {
      toast.error("Fix required issues before publishing.");
      return;
    }

    // If overlaps exist and preventOverlap is OFF, allow publish but warn
    const hasOverlap = warn.some((w) => w.type === "warn");
    if (hasOverlap && preventOverlap) {
      toast.error("Overlaps detected. Turn off Prevent Overlap or adjust tables.");
      return;
    }

    setIsSaving(true);
    try {
      const tables = items.filter((i) => i.type === "table");
      const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);

      const fp = floorPlanDataForSave();

      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: fp,
        total_seats: totalSeats,
        available_seats: totalSeats,
      });

      // Sync Tables entity
      const existingTables = await base44.entities.Table.filter({
        restaurant_id: restaurant.id,
      });
      await Promise.all(existingTables.map((t) => base44.entities.Table.delete(t.id)));

      for (const t of tables) {
        await base44.entities.Table.create({
          restaurant_id: restaurant.id,
          label: t.label,
          capacity: t.seats,
          status: "free",
          position_x: t.x,
          position_y: t.y,
          shape: t.shape,
          rotation: t.rotation || 0,
        });
      }

      toast.success("Floor plan published!");
      onPublish?.();
    } catch (e) {
      toast.error("Failed to publish");
    } finally {
      setIsSaving(false);
    }
  }

  // ---------- UI helpers ----------
  const totalSeats = useMemo(() => {
    return items
      .filter((i) => i.type === "table")
      .reduce((s, t) => s + (t.seats || 0), 0);
  }, [items]);

  const tableCount = useMemo(() => items.filter((i) => i.type === "table").length, [items]);

  const topErrors = useMemo(() => errors.slice(0, 5), [errors]);

  // ---------- Render: SVG layers ----------
  const orderedItems = useMemo(() => [...items].sort(sortByZ), [items]);

  function renderGrid() {
    if (!showGrid) return null;
    return (
      <g>
        <defs>
          <pattern id="gridFine" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#gridFine)" />
      </g>
    );
  }

  function isSelected(id) {
    return selection.includes(id);
  }

  function renderArea(it) {
    const fill = it.style?.fill ?? AREA_STYLE_PRESET.fill;
    const stroke = it.style?.stroke ?? AREA_STYLE_PRESET.stroke;
    const dash = it.style?.dash ?? AREA_STYLE_PRESET.dash;
    const opacity = it.style?.opacity ?? AREA_STYLE_PRESET.opacity;

    return (
      <g key={it.id}>
        <rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.h}
          rx={12}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray={dash}
        />
        {/* Area label ALWAYS visible (top layer-ish) */}
        <g pointerEvents="none">
          <rect
            x={it.x + 12}
            y={it.y + 10}
            width={Math.max(70, (it.name?.length || 4) * 8 + 26)}
            height={26}
            rx={8}
            fill={stroke}
            opacity={0.95}
          />
          <text x={it.x + 24} y={it.y + 28} fill="#ffffff" fontSize={13} fontWeight={700}>
            {it.name || "Area"}
          </text>
        </g>
      </g>
    );
  }

  function renderWall(it) {
    const stroke = it.style?.stroke ?? WALL_STYLE_PRESET.stroke;
    const width = it.style?.width ?? WALL_STYLE_PRESET.width;

    const selected = isSelected(it.id);
    return (
      <g key={it.id}>
        <line
          x1={it.x1}
          y1={it.y1}
          x2={it.x2}
          y2={it.y2}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
        />
        {selected && (
          <line
            x1={it.x1}
            y1={it.y1}
            x2={it.x2}
            y2={it.y2}
            stroke="#8b5cf6"
            strokeWidth={width + 6}
            strokeLinecap="round"
            opacity={0.25}
          />
        )}
      </g>
    );
  }

  function renderText(it) {
    const selected = isSelected(it.id);
    const color = it.style?.color ?? TEXT_STYLE_PRESET.color;
    const size = it.style?.size ?? TEXT_STYLE_PRESET.size;

    return (
      <g key={it.id} transform={`rotate(${it.rotation || 0}, ${it.x + it.w / 2}, ${it.y + it.h / 2})`}>
        {selected && (
          <rect
            x={it.x - 6}
            y={it.y - 6}
            width={it.w + 12}
            height={it.h + 12}
            rx={10}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="6,4"
          />
        )}
        <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={10} fill="#ffffff" opacity={0.65} />
        <text x={it.x + 10} y={it.y + it.h / 2 + 6} fill={color} fontSize={size} fontWeight={700}>
          {it.text || "Label"}
        </text>
      </g>
    );
  }

  function renderTable(it) {
    const selected = isSelected(it.id);
    const fill = it.style?.fill ?? TABLE_STYLE_PRESET.fill;
    const stroke = it.style?.stroke ?? TABLE_STYLE_PRESET.stroke;

    const shadow = it.style?.shadow ?? true;

    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;

    const baseStroke = selected ? "#8b5cf6" : stroke;
    const baseStrokeW = selected ? 3 : 2;

    return (
      <g
        key={it.id}
        transform={`rotate(${it.rotation || 0}, ${cx}, ${cy})`}
      >
        {/* shadow */}
        {shadow && (
          <ellipse
            cx={cx}
            cy={it.y + it.h + 10}
            rx={it.w / 2}
            ry={8}
            fill="#00000012"
          />
        )}

        {/* shape */}
        {it.shape === "round" ? (
          <circle cx={cx} cy={cy} r={Math.min(it.w, it.h) / 2} fill={fill} stroke={baseStroke} strokeWidth={baseStrokeW} />
        ) : (
          <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={14} fill={fill} stroke={baseStroke} strokeWidth={baseStrokeW} />
        )}

        {/* label + seats (centered, clean) */}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={14} fontWeight={800} fill="#111827">
          {it.label || "T"}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#475569">
          {it.seats} seats
        </text>

        {/* lock badge */}
        {it.locked && (
          <g>
            <circle cx={it.x + it.w - 10} cy={it.y + 10} r={10} fill="#111827" opacity={0.9} />
            <text x={it.x + it.w - 10} y={it.y + 14} textAnchor="middle" fontSize={10} fill="#fff">
              🔒
            </text>
          </g>
        )}
      </g>
    );
  }

  function renderOutline() {
    if (!outline) return null;
    return (
      <g>
        <rect
          x={outline.x}
          y={outline.y}
          width={outline.w}
          height={outline.h}
          fill="none"
          stroke="#f97316"
          strokeWidth={3}
          strokeDasharray="10,8"
          rx={14}
        />
        <g pointerEvents="none">
          <rect x={outline.x + 14} y={outline.y + 12} width={170} height={30} rx={10} fill="#f97316" opacity={0.95} />
          <text x={outline.x + 26} y={outline.y + 32} fill="#fff" fontSize={13} fontWeight={800}>
            Restaurant Outline
          </text>
        </g>
      </g>
    );
  }

  // ---------- Selection box + handles ----------
  function renderSelectionUI() {
    if (!selBBox || selection.length === 0) return null;

    const { x, y, w, h } = selBBox;

    const handleSize = 10;
    const handles = [
      { k: "nw", x: x, y: y },
      { k: "n", x: x + w / 2, y: y },
      { k: "ne", x: x + w, y: y },
      { k: "e", x: x + w, y: y + h / 2 },
      { k: "se", x: x + w, y: y + h },
      { k: "s", x: x + w / 2, y: y + h },
      { k: "sw", x: x, y: y + h },
      { k: "w", x: x, y: y + h / 2 },
    ];

    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="8,6" />
        {/* rotate handle */}
        <g onPointerDown={startRotate} style={{ cursor: "grab" }}>
          <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y - 26} stroke="#8b5cf6" strokeWidth={2} />
          <circle cx={x + w / 2} cy={y - 34} r={10} fill="#8b5cf6" />
          <text x={x + w / 2} y={y - 30} textAnchor="middle" fontSize={12} fill="#fff">
            ⟳
          </text>
        </g>

        {/* resize handles */}
        {handles.map((hnd) => (
          <rect
            key={hnd.k}
            x={hnd.x - handleSize / 2}
            y={hnd.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            rx={3}
            fill="#ffffff"
            stroke="#8b5cf6"
            strokeWidth={2}
            onPointerDown={(e) => startResize(e, hnd.k)}
            style={{ cursor: `${hnd.k}-resize` }}
          />
        ))}
      </g>
    );
  }

  // ---------- Inspector panel ----------
  const primary = selectedItems[0] || null;

  function updateItem(id, patch) {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
      return next;
    });
  }

  function updateItemStyle(id, patch) {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, style: { ...(it.style || {}), ...patch } } : it));
      return next;
    });
  }

  function commitInspector() {
    pushHistory(snapshot());
  }

  // ---------- Layout ----------
  return (
    <div className="w-full space-y-3">
      {/* TOP BAR (pro look) */}
      <div className="rounded-xl overflow-hidden shadow-sm border bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white font-black">
              SF
            </div>
            <div className="text-white">
              <div className="text-sm font-black tracking-wide">START BUILDING YOUR FLOOR PLAN</div>
              <div className="text-xs opacity-90">
                {restaurant?.name || "Restaurant"} • {tableCount} tables • {totalSeats} seats
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={undo} disabled={hIndex <= 0}>
              <Undo className="w-4 h-4 mr-1" /> Undo
            </Button>
            <Button size="sm" variant="secondary" onClick={redo} disabled={hIndex >= history.length - 1}>
              <Redo className="w-4 h-4 mr-1" /> Redo
            </Button>

            <div className="mx-2 h-8 w-px bg-white/25" />

            <Button size="sm" variant="secondary" onClick={() => setZoom((z) => clamp(z - 0.1, 0.4, 2))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="px-2 text-white text-sm font-bold">{Math.round(zoom * 100)}%</div>
            <Button size="sm" variant="secondary" onClick={() => setZoom((z) => clamp(z + 0.1, 0.4, 2))}>
              <ZoomIn className="w-4 h-4" />
            </Button>

            <div className="mx-2 h-8 w-px bg-white/25" />

            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePublish}
              disabled={isSaving || errors.some((e) => e.type === "critical")}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Publish
            </Button>
          </div>
        </div>

        {/* MAIN STUDIO GRID */}
        <div className="grid grid-cols-[270px_1fr_300px] gap-3 p-3 bg-slate-50">
          {/* LEFT TOOLKIT */}
          <Card className="p-3 h-[680px] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-black tracking-wider text-slate-600">TOOLKIT</div>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>

            {/* Tools */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={tool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("select")}
              >
                <MousePointer2 className="w-4 h-4 mr-1" /> Select
              </Button>
              <Button
                variant={tool === "pan" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("pan")}
              >
                <Hand className="w-4 h-4 mr-1" /> Pan
              </Button>
              <Button
                variant={tool === "wall" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("wall")}
              >
                <Pencil className="w-4 h-4 mr-1" /> Wall
              </Button>
              <Button
                variant={tool === "outline" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("outline")}
              >
                <Square className="w-4 h-4 mr-1" /> Outline
              </Button>
              <Button
                variant={tool === "area" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("area")}
              >
                <Grid3x3 className="w-4 h-4 mr-1" /> Area
              </Button>
              <Button
                variant={tool === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("text")}
              >
                <Type className="w-4 h-4 mr-1" /> Text
              </Button>
            </div>

            <div className="my-3 border-t" />

            {/* Table presets */}
            <div className="text-xs font-black tracking-wider text-slate-600 mb-2">TABLES</div>
            <div className="space-y-2">
              {[2, 4, 6, 8, 10].map((n) => (
                <Button key={n} variant="outline" className="w-full justify-between" onClick={() => addTablePreset(n)}>
                  <span className="font-semibold">{n}-Top</span>
                  <Badge variant="secondary">{n} seats</Badge>
                </Button>
              ))}
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  setTool("table");
                  dragRef.current.pendingTable = { seats: 4, w: 120, h: 70, shape: "rect" };
                  toast.message("Click to place a custom table, then resize it.");
                }}
              >
                <span className="font-semibold">Custom Table</span>
                <Badge variant="secondary">resize</Badge>
              </Button>
            </div>

            <div className="my-3 border-t" />

            {/* View toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Grid</div>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Snap</div>
                <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Prevent overlap</div>
                <Switch checked={preventOverlap} onCheckedChange={setPreventOverlap} />
              </div>

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => handleAskAi("layout", null)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ask AI to build layout
              </Button>
            </div>

            <div className="my-3 border-t" />

            {/* Mini legend */}
            <div className="text-xs text-slate-500 leading-relaxed">
              Tips:
              <div>• Right-click anything → Ask AI / Color / Lock</div>
              <div>• Shift-click multi-select</div>
              <div>• Press V/H/W/T/A/O for tools</div>
              <div>• Hold Shift while dragging to ignore snap</div>
            </div>
          </Card>

          {/* CANVAS */}
          <Card className="relative overflow-hidden h-[680px]">
            <div
              ref={viewportRef}
              className={cn(
                "absolute inset-0 bg-white",
                tool === "table" ? "cursor-crosshair" : tool === "wall" ? "cursor-crosshair" : "cursor-default"
              )}
              onPointerDown={onViewportPointerDown}
              onPointerMove={onViewportPointerMove}
              onPointerUp={onViewportPointerUp}
              onContextMenu={onContextMenu}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  touchAction: "none",
                }}
              >
                {renderGrid()}
                {renderOutline()}

                {/* Items */}
                {orderedItems.map((it) => {
                  if (it._preview) {
                    // preview wall on top
                    return renderWall(it);
                  }
                  if (it.type === "area") return renderArea(it);
                  if (it.type === "textBox") return renderText(it);
                  if (it.type === "wall") return renderWall(it);
                  if (it.type === "table") return renderTable(it);
                  return null;
                })}

                {/* Selection handles */}
                {renderSelectionUI()}
              </svg>

              {/* Context menu */}
              {ctxMenu.open && (
                <div
                  className="fixed z-50"
                  style={{ left: ctxMenu.x, top: ctxMenu.y }}
                >
                  <Card className="p-2 w-[220px] shadow-lg border">
                    <div className="text-xs text-slate-500 px-2 pb-2">
                      {ctxMenu.targetId ? "Item actions" : "Canvas actions"}
                    </div>

                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAskAi(ctxMenu.targetId ? "selection" : "layout", ctxMenu.targetId)}
                      >
                        <Sparkles className="w-4 h-4 mr-2" /> Ask AI
                      </Button>

                      {ctxMenu.targetId && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              duplicateIds([ctxMenu.targetId]);
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              toggleLock([ctxMenu.targetId]);
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            {items.find((i) => i.id === ctxMenu.targetId)?.locked ? (
                              <>
                                <Unlock className="w-4 h-4 mr-2" /> Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4 mr-2" /> Lock
                              </>
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              bringToFront([ctxMenu.targetId]);
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <BringToFront className="w-4 h-4 mr-2" /> Bring to front
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              sendToBack([ctxMenu.targetId]);
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <SendToBack className="w-4 h-4 mr-2" /> Send to back
                          </Button>

                          <div className="h-px bg-slate-100 my-1" />

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => openColorPicker("fill")}
                          >
                            🎨 Fill color
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => openColorPicker("stroke")}
                          >
                            🎯 Stroke color
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => openColorPicker("text")}
                          >
                            🔤 Text color
                          </Button>

                          <div className="h-px bg-slate-100 my-1" />

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-red-600 hover:text-red-700"
                            onClick={() => {
                              deleteIds([ctxMenu.targetId]);
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </Button>
                        </>
                      )}

                      {!ctxMenu.targetId && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              setTool("outline");
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <Square className="w-4 h-4 mr-2" /> Draw outline
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              setTool("wall");
                              setCtxMenu((m) => ({ ...m, open: false }));
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> Draw wall
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* Color picker popover */}
              {colorPop.open && (
                <div className="fixed z-50" style={{ left: colorPop.x + 10, top: colorPop.y + 10 }}>
                  <Card className="p-3 w-[220px] shadow-lg border">
                    <div className="text-sm font-bold mb-2">Pick a color</div>
                    <div className="grid grid-cols-8 gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border"
                          style={{ background: c }}
                          onClick={() => applyColor(c)}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setColorPop((p) => ({ ...p, open: false }))}>
                        Close
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </Card>

          {/* RIGHT INSPECTOR */}
          <Card className="p-3 h-[680px] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-black tracking-wider text-slate-600">PROPERTIES</div>
              {selection.length > 0 && (
                <Badge variant="secondary">{selection.length} selected</Badge>
              )}
            </div>

            {primary ? (
              <div className="space-y-3">
                {/* Shared actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleAskAi("selection", primary.id)}
                  >
                    <Sparkles className="w-4 h-4 mr-1" /> Ask AI
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleLock(selection.length ? selection : [primary.id])}
                  >
                    {primary.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </Button>
                </div>

                {selection.length >= 2 && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={groupSelection}>
                      Group
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={ungroupSelection}>
                      Ungroup
                    </Button>
                  </div>
                )}

                <div className="border-t" />

                {primary.type === "table" && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-slate-600 mb-1">Table label</div>
                      <Input
                        value={primary.label || ""}
                        onChange={(e) => updateItem(primary.id, { label: e.target.value })}
                        onBlur={commitInspector}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Seats</div>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={primary.seats || 4}
                          onChange={(e) =>
                            updateItem(primary.id, { seats: parseInt(e.target.value || "4", 10) })
                          }
                          onBlur={commitInspector}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Rotation</div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            updateItem(primary.id, { rotation: ((primary.rotation || 0) + 45) % 360 });
                            setTimeout(commitInspector, 0);
                          }}
                        >
                          <RotateCw className="w-4 h-4 mr-2" />
                          {primary.rotation || 0}°
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateItem(primary.id, { shape: "round" });
                          setTimeout(commitInspector, 0);
                        }}
                      >
                        <Circle className="w-4 h-4 mr-2" /> Round
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateItem(primary.id, { shape: "rect" });
                          setTimeout(commitInspector, 0);
                        }}
                      >
                        <Square className="w-4 h-4 mr-2" /> Rect
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateItemStyle(primary.id, { shadow: !primary.style?.shadow });
                          setTimeout(commitInspector, 0);
                        }}
                      >
                        Shadow: {primary.style?.shadow ? "On" : "Off"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          duplicateIds([primary.id]);
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy
                      </Button>
                    </div>
                  </>
                )}

                {primary.type === "area" && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-slate-600 mb-1">Area name</div>
                      <Input
                        value={primary.name || ""}
                        onChange={(e) => updateItem(primary.id, { name: e.target.value })}
                        onBlur={commitInspector}
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      Tip: Areas are background zones. Labels always stay visible.
                    </div>
                  </>
                )}

                {primary.type === "wall" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Thickness</div>
                        <Input
                          type="number"
                          min={2}
                          max={24}
                          value={primary.style?.width || 6}
                          onChange={(e) =>
                            updateItemStyle(primary.id, { width: parseInt(e.target.value || "6", 10) })
                          }
                          onBlur={commitInspector}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Color</div>
                        <Button variant="outline" className="w-full" onClick={() => {
                          setColorPop({ open: true, x: window.innerWidth / 2, y: 180, targetId: primary.id, field: "stroke" });
                        }}>
                          Pick
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Tip: Hold <b>Shift</b> while drawing to snap to angles.
                    </div>
                  </>
                )}

                {primary.type === "textBox" && (
                  <>
                    <div>
                      <div className="text-xs font-bold text-slate-600 mb-1">Text content</div>
                      <Input
                        value={primary.text || ""}
                        onChange={(e) => updateItem(primary.id, { text: e.target.value })}
                        onBlur={commitInspector}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Font size</div>
                        <Input
                          type="number"
                          min={10}
                          max={48}
                          value={primary.style?.size || 16}
                          onChange={(e) =>
                            updateItemStyle(primary.id, { size: parseInt(e.target.value || "16", 10) })
                          }
                          onBlur={commitInspector}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-1">Color</div>
                        <Button variant="outline" className="w-full" onClick={() => {
                          setColorPop({ open: true, x: window.innerWidth / 2, y: 180, targetId: primary.id, field: "text" });
                        }}>
                          Pick
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="border-t mt-3 pt-3" />

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteIds(selection.length ? selection : [primary.id])}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500 text-center py-12">
                Select an item to edit properties
              </div>
            )}

            <div className="border-t mt-4 pt-4" />

            {/* Warnings / errors */}
            {topErrors.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-black tracking-wider text-slate-600 mb-2">ISSUES</div>
                {topErrors.map((err, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg text-xs",
                      err.type === "critical" && "bg-red-50 text-red-800",
                      err.type === "warn" && "bg-amber-50 text-amber-800",
                      err.type === "info" && "bg-blue-50 text-blue-800"
                    )}
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* AI modal */}
      {aiModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-[500px] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <div className="text-lg font-bold">Ask AI</div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-600 mb-2">
                  {aiModal.mode === "layout"
                    ? "Example: 'Generate 40 seats with a date night vibe' or 'Add a family area with 10 six-tops'"
                    : "Example: 'Align these tables' or 'Space them evenly' or 'Rotate 45 degrees'"}
                </div>
                <Input
                  placeholder="What would you like me to do?"
                  value={aiModal.prompt}
                  onChange={(e) => setAiModal((a) => ({ ...a, prompt: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !aiModal.isRunning) runAiApply();
                  }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiModal((a) => ({ ...a, open: false }))}>
                  Cancel
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={runAiApply}
                  disabled={aiModal.isRunning || !aiModal.prompt.trim()}
                >
                  {aiModal.isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Apply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
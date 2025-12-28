import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Sparkles,
  Plus,
  MousePointer2,
  PencilRuler,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo,
  Redo,
  RotateCw,
  Copy,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CANVAS_W = 1600;
const CANVAS_H = 1000;

const PAD = 18;              // boundary padding inside outline
const MIN_GAP = 10;          // min gap between tables
const SNAP_T = 10;           // snap threshold px

const TABLE_STYLES = {
  free: { fill: "#ffffff", stroke: "#dbeafe", ring: "#60a5fa" },
  occupied: { fill: "#fff7ed", stroke: "#fed7aa", ring: "#fb923c" },
  reserved: { fill: "#eff6ff", stroke: "#bfdbfe", ring: "#3b82f6" },
};

const SHAPES = {
  round: { label: "Round" },
  square: { label: "Square" },
  rectangle: { label: "Rectangle" },
  booth: { label: "Booth" },
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function deepCopy(x) {
  return JSON.parse(JSON.stringify(x));
}

// AABB for overlap checks (rotation-safe approximation)
function getAABB(t) {
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;

  if (t.shape === "round") {
    return { x: t.x, y: t.y, w: t.width, h: t.height };
  }

  const rot = ((t.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const aabbW = Math.abs(t.width * cos) + Math.abs(t.height * sin);
  const aabbH = Math.abs(t.width * sin) + Math.abs(t.height * cos);

  return { x: cx - aabbW / 2, y: cy - aabbH / 2, w: aabbW, h: aabbH };
}

function overlaps(a, b, pad = 0) {
  return !(
    a.x + a.w + pad < b.x ||
    a.x > b.x + b.w + pad ||
    a.y + a.h + pad < b.y ||
    a.y > b.y + b.h + pad
  );
}

function insideOutlineBox(table, outline) {
  if (!outline) return true;
  return (
    table.x >= outline.x + PAD &&
    table.y >= outline.y + PAD &&
    table.x + table.width <= outline.x + outline.width - PAD &&
    table.y + table.height <= outline.y + outline.height - PAD
  );
}

function tableDimsForType(type) {
  // Premium-looking default sizes by “type”
  // (You can tweak these later)
  switch (type) {
    case "t2":
      return { shape: "round", width: 72, height: 72, seats: 2 };
    case "t4":
      return { shape: "round", width: 92, height: 92, seats: 4 };
    case "t6":
      return { shape: "rectangle", width: 122, height: 86, seats: 6 };
    case "t8":
      return { shape: "rectangle", width: 144, height: 96, seats: 8 };
    case "booth":
      return { shape: "booth", width: 160, height: 78, seats: 4 };
    default:
      return { shape: "round", width: 92, height: 92, seats: 4 };
  }
}

function nextLabel(existing) {
  const used = new Set(existing.map((t) => t.label));
  let i = 1;
  while (used.has(`T${i}`)) i++;
  return `T${i}`;
}

/**
 * Smart / "AI" layout generation:
 * - Uses your preferences to pack tables into clean rows with aisles
 * - Creates a layout that looks intentional (not random clutter)
 */
function generateSmartLayout({ outline, vibe, targetSeats, aisle, includeBooths, tableMix }) {
  if (!outline) return { tables: [], warnings: ["Draw the outline first."] };

  // Decide table counts
  // If tableMix provided, use it; else derive from targetSeats + vibe.
  const mix = tableMix || (() => {
    const seats = Math.max(10, Number(targetSeats || 40));
    // Ratios by vibe:
    const ratios =
      vibe === "max"
        ? { t2: 0.10, t4: 0.55, t6: 0.25, t8: 0.10 }
        : vibe === "cozy"
        ? { t2: 0.25, t4: 0.55, t6: 0.15, t8: 0.05 }
        : { t2: 0.18, t4: 0.58, t6: 0.18, t8: 0.06 }; // balanced

    const counts = { t2: 0, t4: 0, t6: 0, t8: 0 };
    let remaining = seats;

    const order = ["t8", "t6", "t4", "t2"];
    for (const k of order) {
      const want = Math.max(0, Math.floor((seats * ratios[k]) / (k === "t2" ? 2 : k === "t4" ? 4 : k === "t6" ? 6 : 8)));
      counts[k] = want;
      remaining -= want * (k === "t2" ? 2 : k === "t4" ? 4 : k === "t6" ? 6 : 8);
    }

    // Fill remaining mostly with 4-tops
    counts.t4 += Math.max(0, Math.ceil(remaining / 4));
    return counts;
  })();

  // Build table spec list
  const specs = [];
  if (includeBooths) {
    // Add a few booths first
    specs.push(...Array(3).fill("booth"));
  }
  Object.entries(mix).forEach(([k, n]) => {
    for (let i = 0; i < Number(n || 0); i++) specs.push(k);
  });

  // Packing regions
  const usable = {
    x: outline.x + PAD,
    y: outline.y + PAD,
    w: outline.width - PAD * 2,
    h: outline.height - PAD * 2,
  };

  // Big center aisle that makes it look realistic
  const aisleW = clamp(Number(aisle || 70), 40, 160);
  const colW = (usable.w - aisleW) / 2;

  const left = { x: usable.x, y: usable.y, w: colW, h: usable.h };
  const right = { x: usable.x + colW + aisleW, y: usable.y, w: colW, h: usable.h };

  const placed = [];
  const warnings = [];

  function tryPlaceInRegion(region, specList) {
    let x = region.x;
    let y = region.y;
    let rowH = 0;

    const remainingSpecs = [];

    for (const type of specList) {
      const d = tableDimsForType(type);

      // slight variation so it doesn’t look copy/paste
      const jitter = vibe === "cozy" ? 6 : 3;

      // Booths hug the top wall
      if (type === "booth") {
        const booth = {
          id: Date.now() + Math.random(),
          x: clamp(region.x + 8, region.x, region.x + region.w - d.width),
          y: region.y + 6,
          width: d.width,
          height: d.height,
          seats: d.seats,
          shape: d.shape,
          rotation: 0,
          state: "free",
          label: "Booth",
        };
        // place only if it fits and doesn’t overlap
        const a = getAABB(booth);
        const okInside = booth.x + booth.width <= region.x + region.w && booth.y + booth.height <= region.y + region.h;
        const okOverlap = placed.every((t) => !overlaps(a, getAABB(t), MIN_GAP));
        if (okInside && okOverlap) placed.push(booth);
        continue;
      }

      const w = d.width;
      const h = d.height;

      // new row if needed
      if (x + w > region.x + region.w) {
        x = region.x;
        y = y + rowH + MIN_GAP + 6;
        rowH = 0;
      }

      // out of vertical space
      if (y + h > region.y + region.h) {
        remainingSpecs.push(type);
        continue;
      }

      const candidate = {
        id: Date.now() + Math.random(),
        x: x + Math.floor(Math.random() * jitter),
        y: y + Math.floor(Math.random() * jitter),
        width: w,
        height: h,
        seats: d.seats,
        shape: d.shape,
        rotation: d.shape === "rectangle" ? 0 : 0,
        state: "free",
        label: "", // fill later
      };

      // overlap check
      const a = getAABB(candidate);
      const okOverlap = placed.every((t) => !overlaps(a, getAABB(t), MIN_GAP));
      if (!okOverlap) {
        // try shifting a bit
        candidate.x += MIN_GAP + 8;
      }

      const a2 = getAABB(candidate);
      const okOverlap2 = placed.every((t) => !overlaps(a2, getAABB(t), MIN_GAP));
      const okInside =
        candidate.x + candidate.width <= region.x + region.w &&
        candidate.y + candidate.height <= region.y + region.h;

      if (okOverlap2 && okInside) {
        placed.push(candidate);
        x = candidate.x + w + MIN_GAP;
        rowH = Math.max(rowH, h);
      } else {
        remainingSpecs.push(type);
      }
    }

    return remainingSpecs;
  }

  // place left then right
  let rest = tryPlaceInRegion(left, specs);
  rest = tryPlaceInRegion(right, rest);

  // label unique
  placed.forEach((t) => {
    if (t.label === "Booth") return;
    t.label = nextLabel(placed.filter((x) => x.id !== t.id));
  });

  const seats = placed.reduce((s, t) => s + (t.seats || 0), 0);

  if (rest.length > 0) warnings.push(`Could not place ${rest.length} tables (outline too small for your settings).`);
  if (seats < Number(targetSeats || 0) * 0.75) warnings.push("Seat target may be too high for this outline. Try ‘Max Seats’ or reduce aisle width.");

  return { tables: placed, warnings };
}

// One-click “Tidy”: aligns into clean rows (keeps inside outline)
function tidyLayout(tables, outline) {
  if (!outline || tables.length === 0) return tables;

  const usable = {
    x: outline.x + PAD,
    y: outline.y + PAD,
    w: outline.width - PAD * 2,
    h: outline.height - PAD * 2,
  };

  const sorted = [...tables].sort((a, b) => (a.y - b.y) || (a.x - b.x));

  let x = usable.x;
  let y = usable.y;
  let rowH = 0;

  const out = [];
  for (const t of sorted) {
    const w = t.width;
    const h = t.height;

    if (x + w > usable.x + usable.w) {
      x = usable.x;
      y = y + rowH + MIN_GAP + 6;
      rowH = 0;
    }
    if (y + h > usable.y + usable.h) break;

    const nt = { ...t, x, y };
    out.push(nt);

    x = x + w + MIN_GAP;
    rowH = Math.max(rowH, h);
  }

  // keep any leftovers at original positions
  if (out.length < tables.length) {
    out.push(...tables.slice(out.length));
  }

  return out.map((t) => ({
    ...t,
    x: clamp(t.x, usable.x, usable.x + usable.w - t.width),
    y: clamp(t.y, usable.y, usable.y + usable.h - t.height),
  }));
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const canvasRef = useRef(null);

  const [outline, setOutline] = useState(null);
  const [areas, setAreas] = useState([]); // optional later
  const [tables, setTables] = useState([]);

  const [mode, setMode] = useState("select"); // select | add-table | draw-outline
  const [selectedId, setSelectedId] = useState(null);

  // View
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(null); // {startX,startY,panX,panY}

  // Draft outline
  const [outlineDraft, setOutlineDraft] = useState(null);

  // Drag
  const [drag, setDrag] = useState(null); // {id,offsetX,offsetY,lastValid:{x,y}}
  const [ghost, setGhost] = useState(null); // {table, valid, reason}

  // Clean UI toggles
  const [showGrid, setShowGrid] = useState(false);
  const [showSeatDots, setShowSeatDots] = useState(false);
  const [snapOn, setSnapOn] = useState(true);

  // Right panel
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState("ai"); // ai | props

  // AI layout config
  const [aiVibe, setAiVibe] = useState("balanced"); // cozy | balanced | max
  const [aiTargetSeats, setAiTargetSeats] = useState(48);
  const [aiAisle, setAiAisle] = useState(80);
  const [aiBooths, setAiBooths] = useState(true);
  const [aiUseMix, setAiUseMix] = useState(false);
  const [aiMix, setAiMix] = useState({ t2: 4, t4: 8, t6: 2, t8: 1 });

  // Errors & saving
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const selectedTable = useMemo(() => tables.find((t) => t.id === selectedId) || null, [tables, selectedId]);
  const totalSeats = useMemo(() => tables.reduce((s, t) => s + (t.seats || 0), 0), [tables]);

  const pushHistory = useCallback((state) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, deepCopy(state)];
    });
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx <= 0) return idx;
      const s = history[idx - 1];
      if (s) {
        setOutline(s.outline);
        setAreas(s.areas);
        setTables(s.tables);
        setSelectedId(null);
      }
      return idx - 1;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx >= history.length - 1) return idx;
      const s = history[idx + 1];
      if (s) {
        setOutline(s.outline);
        setAreas(s.areas);
        setTables(s.tables);
        setSelectedId(null);
      }
      return idx + 1;
    });
  }, [history]);

  // Load
  useEffect(() => {
    if (!restaurant) return;
    const fp = restaurant.floor_plan_data;
    const o = fp?.outline || null;
    const a = fp?.areas || [];
    const t = fp?.tables || [];

    setOutline(o);
    setAreas(a);
    setTables(t);

    setHistory([{ outline: o, areas: a, tables: t }]);
    setHistoryIndex(0);
    setSelectedId(null);
  }, [restaurant]);

  // Coordinate transform (screen -> world)
  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  }, [pan.x, pan.y, zoom]);

  const applySnapping = useCallback((candidate) => {
    if (!snapOn) return candidate;

    let x = candidate.x;
    let y = candidate.y;

    if (outline) {
      const L = outline.x + PAD;
      const T = outline.y + PAD;
      const R = outline.x + outline.width - PAD;
      const B = outline.y + outline.height - PAD;

      // edges
      if (Math.abs(x - L) < SNAP_T) x = L;
      if (Math.abs(x + candidate.width - R) < SNAP_T) x = R - candidate.width;
      if (Math.abs(y - T) < SNAP_T) y = T;
      if (Math.abs(y + candidate.height - B) < SNAP_T) y = B - candidate.height;

      // center
      const cx = outline.x + outline.width / 2;
      const cy = outline.y + outline.height / 2;
      const tcx = x + candidate.width / 2;
      const tcy = y + candidate.height / 2;

      if (Math.abs(tcx - cx) < SNAP_T) x = cx - candidate.width / 2;
      if (Math.abs(tcy - cy) < SNAP_T) y = cy - candidate.height / 2;
    }

    // other tables snapping (edges)
    tables.forEach((t) => {
      if (t.id === candidate.id) return;
      if (Math.abs(x - t.x) < SNAP_T) x = t.x;
      if (Math.abs(x - (t.x + t.width)) < SNAP_T) x = t.x + t.width;
      if (Math.abs((x + candidate.width) - t.x) < SNAP_T) x = t.x - candidate.width;

      if (Math.abs(y - t.y) < SNAP_T) y = t.y;
      if (Math.abs(y - (t.y + t.height)) < SNAP_T) y = t.y + t.height;
      if (Math.abs((y + candidate.height) - t.y) < SNAP_T) y = t.y - candidate.height;
    });

    return { ...candidate, x, y };
  }, [snapOn, outline, tables]);

  const getInvalidReason = useCallback((candidate) => {
    if (outline && !insideOutlineBox(candidate, outline)) return "Outside boundary";
    const a = getAABB(candidate);
    for (const t of tables) {
      if (t.id === candidate.id) continue;
      const b = getAABB(t);
      if (overlaps(a, b, MIN_GAP)) return `Overlaps ${t.label}`;
    }
    return null;
  }, [outline, tables]);

  const validate = useCallback(() => {
    const errs = [];
    if (!outline) errs.push({ type: "critical", message: "Outline is required (Draw Outline)." });
    if (tables.length === 0) errs.push({ type: "critical", message: "Add at least 1 table." });

    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (outline && !insideOutlineBox(t, outline)) {
        errs.push({ type: "error", message: `Table ${t.label} is outside the boundary.` });
      }
      const a = getAABB(t);
      for (let j = i + 1; j < tables.length; j++) {
        const b = getAABB(tables[j]);
        if (overlaps(a, b, MIN_GAP)) errs.push({ type: "error", message: `${t.label} overlaps ${tables[j].label}.` });
      }
    }
    setErrors(errs);
    return errs.length === 0;
  }, [outline, tables]);

  useEffect(() => {
    validate();
  }, [outline, tables, validate]);

  // Canvas events
  const onPointerDown = (e) => {
    // Pan: Alt + drag or middle mouse
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    if (mode === "add-table") {
      const d = tableDimsForType("t4");
      const t = {
        id: Date.now() + Math.random(),
        x: world.x - d.width / 2,
        y: world.y - d.height / 2,
        width: d.width,
        height: d.height,
        seats: 4,
        shape: "round",
        rotation: 0,
        state: "free",
        label: nextLabel(tables),
      };

      const cand = applySnapping(t);
      const reason = getInvalidReason(cand);
      if (reason) {
        toast.error(`Can't place: ${reason}`);
        return;
      }

      const next = [...tables, cand];
      setTables(next);
      pushHistory({ outline, areas, tables: next });
      setSelectedId(cand.id);
      setMode("select");
      return;
    }

    if (mode === "draw-outline") {
      setOutlineDraft({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    // clicking empty -> deselect
    setSelectedId(null);
  };

  const onPointerMove = (e) => {
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setPan({ x: panning.panX + dx, y: panning.panY + dy });
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    // outline draft
    if (outlineDraft && mode === "draw-outline") {
      const w = world.x - outlineDraft.x;
      const h = world.y - outlineDraft.y;
      const nx = w < 0 ? world.x : outlineDraft.x;
      const ny = h < 0 ? world.y : outlineDraft.y;
      setOutlineDraft({ x: nx, y: ny, width: Math.abs(w), height: Math.abs(h) });
      return;
    }

    // drag table
    if (drag) {
      const t = tables.find((x) => x.id === drag.id);
      if (!t) return;

      let cand = { ...t, x: world.x - drag.offsetX, y: world.y - drag.offsetY };
      cand = applySnapping(cand);

      // clamp into outline if possible
      if (outline) {
        const ux = outline.x + PAD;
        const uy = outline.y + PAD;
        const uw = outline.width - PAD * 2;
        const uh = outline.height - PAD * 2;
        cand.x = clamp(cand.x, ux, ux + uw - cand.width);
        cand.y = clamp(cand.y, uy, uy + uh - cand.height);
      }

      const reason = getInvalidReason(cand);
      const valid = !reason;
      setGhost({ table: cand, valid, reason });

      if (valid) {
        setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, x: cand.x, y: cand.y } : x)));
        setDrag((d) => (d ? { ...d, lastValid: { x: cand.x, y: cand.y } } : d));
      }
    }
  };

  const onPointerUp = () => {
    setPanning(null);

    if (outlineDraft && mode === "draw-outline") {
      if (outlineDraft.width < 60 || outlineDraft.height < 60) {
        toast.error("Outline too small — drag bigger.");
        setOutlineDraft(null);
        return;
      }
      const o = { x: outlineDraft.x, y: outlineDraft.y, width: outlineDraft.width, height: outlineDraft.height };
      setOutline(o);
      setOutlineDraft(null);
      pushHistory({ outline: o, areas, tables });
      return;
    }

    if (drag) {
      // if invalid end, snap back
      if (ghost && !ghost.valid) {
        setTables((prev) =>
          prev.map((x) => (x.id === drag.id ? { ...x, x: drag.lastValid.x, y: drag.lastValid.y } : x))
        );
        toast.error(ghost.reason || "Invalid placement");
      }
      pushHistory({ outline, areas, tables });
      setDrag(null);
      setGhost(null);
    }
  };

  const onTableDown = (e, t) => {
    e.stopPropagation();
    setSelectedId(t.id);

    if (mode !== "select") return;

    const world = screenToWorld(e.clientX, e.clientY);
    setDrag({
      id: t.id,
      offsetX: world.x - t.x,
      offsetY: world.y - t.y,
      lastValid: { x: t.x, y: t.y },
    });
  };

  // Actions
  const rotateSelected = (deg) => {
    if (!selectedTable) return;
    const next = tables.map((t) => (t.id === selectedTable.id ? { ...t, rotation: ((t.rotation || 0) + deg) % 360 } : t));
    setTables(next);
    pushHistory({ outline, areas, tables: next });
  };

  const duplicateSelected = () => {
    if (!selectedTable) return;

    const copy = {
      ...selectedTable,
      id: Date.now() + Math.random(),
      x: selectedTable.x + 18,
      y: selectedTable.y + 18,
      label: `${selectedTable.label}-copy`,
    };

    const reason = getInvalidReason(copy);
    if (reason) {
      toast.error(`Can't duplicate: ${reason}`);
      return;
    }

    const next = [...tables, copy];
    setTables(next);
    pushHistory({ outline, areas, tables: next });
    setSelectedId(copy.id);
  };

  const deleteSelected = () => {
    if (!selectedTable) return;
    const next = tables.filter((t) => t.id !== selectedTable.id);
    setTables(next);
    pushHistory({ outline, areas, tables: next });
    setSelectedId(null);
  };

  const runAI = () => {
    if (!outline) {
      toast.error("Draw the outline first.");
      return;
    }

    const tableMix = aiUseMix
      ? { ...aiMix }
      : null;

    const { tables: gen, warnings } = generateSmartLayout({
      outline,
      vibe: aiVibe === "max" ? "max" : aiVibe === "cozy" ? "cozy" : "balanced",
      targetSeats: aiTargetSeats,
      aisle: aiAisle,
      includeBooths: aiBooths,
      tableMix,
    });

    if (!gen.length) {
      toast.error("Could not generate layout. Try a bigger outline.");
      return;
    }

    setTables(gen);
    pushHistory({ outline, areas, tables: gen });
    setSelectedId(null);

    warnings.forEach((w) => toast.message(w));
    toast.success("AI layout generated!");
  };

  const tidy = () => {
    if (!outline || tables.length === 0) return;
    const next = tidyLayout(tables, outline);
    setTables(next);
    pushHistory({ outline, areas, tables: next });
    toast.success("Tidied layout.");
  };

  const handlePublish = async () => {
    const ok = validate();
    if (!ok) {
      toast.error("Fix issues before publishing.");
      return;
    }

    setIsSaving(true);
    try {
      const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
      const floorPlanData = { outline, areas, tables, publishedAt: new Date().toISOString() };

      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: floorPlanData,
        total_seats: totalSeats,
        available_seats: totalSeats,
      });

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
      toast.error("Publish failed.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Top controls (minimal + premium) */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={mode === "select" ? "default" : "outline"} onClick={() => setMode("select")}>
              <MousePointer2 className="w-4 h-4 mr-1" /> Select
            </Button>
            <Button size="sm" variant={mode === "add-table" ? "default" : "outline"} onClick={() => setMode("add-table")}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
            <Button size="sm" variant={mode === "draw-outline" ? "default" : "outline"} onClick={() => setMode("draw-outline")}>
              <PencilRuler className="w-4 h-4 mr-1" /> Outline
            </Button>

            <Button size="sm" variant="outline" onClick={() => { setPanelOpen(true); setPanelTab("ai"); }}>
              <Sparkles className="w-4 h-4 mr-1" /> AI Layout
            </Button>

            <Button size="sm" variant="outline" onClick={tidy} disabled={!outline || tables.length === 0}>
              Tidy
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>

            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.1).toFixed(2)))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.1).toFixed(2)))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Button size="sm" variant="outline" onClick={() => setPanelOpen((v) => !v)}>
              {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-5 text-xs text-slate-500 flex-wrap">
          <span><b>Alt + drag</b> to pan • <b>Add</b> places one table • <b>AI Layout</b> generates a clean plan</span>
          <label className="flex items-center gap-2">
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            Grid
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={showSeatDots} onCheckedChange={setShowSeatDots} />
            Seat dots
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={snapOn} onCheckedChange={setSnapOn} />
            Snap
          </label>
        </div>
      </Card>

      {/* Main layout */}
      <div className={`grid gap-4 ${panelOpen ? "grid-cols-1 lg:grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
        {/* Canvas */}
        <Card className="relative overflow-hidden" style={{ height: "680px" }}>
          <div
            ref={canvasRef}
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 500px at 20% 10%, rgba(59,130,246,0.08), transparent 60%), radial-gradient(900px 500px at 90% 90%, rgba(16,185,129,0.08), transparent 60%), #ffffff",
              touchAction: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <svg
              width="100%"
              height="100%"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* optional grid */}
              {showGrid && (
                <>
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
                    </pattern>
                  </defs>
                  <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
                </>
              )}

              {/* subtle canvas bounds */}
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="transparent" stroke="#f1f5f9" strokeWidth="2" rx="18" />

              {/* outline */}
              {outline && (
                <rect
                  x={outline.x}
                  y={outline.y}
                  width={outline.width}
                  height={outline.height}
                  rx="18"
                  fill="rgba(16,185,129,0.06)"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="8,8"
                />
              )}

              {/* draft outline */}
              {outlineDraft && (
                <rect
                  x={outlineDraft.x}
                  y={outlineDraft.y}
                  width={outlineDraft.width}
                  height={outlineDraft.height}
                  rx="18"
                  fill="rgba(59,130,246,0.06)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
              )}

              {/* tables */}
              {tables.map((t) => {
                const isSel = selectedId === t.id;
                const style = TABLE_STYLES[t.state || "free"] || TABLE_STYLES.free;

                // premium shadow is a separate shape under it
                const cx = t.x + t.width / 2;
                const cy = t.y + t.height / 2;

                return (
                  <g
                    key={t.id}
                    onPointerDown={(e) => onTableDown(e, t)}
                    style={{ cursor: mode === "select" ? "grab" : "pointer" }}
                    transform={`rotate(${t.rotation || 0}, ${cx}, ${cy})`}
                  >
                    {/* shadow */}
                    <ellipse
                      cx={cx}
                      cy={t.y + t.height + 8}
                      rx={t.width / 2}
                      ry={6}
                      fill="rgba(2,6,23,0.10)"
                    />

                    {/* shape */}
                    {t.shape === "round" ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={t.width / 2}
                        fill={style.fill}
                        stroke={isSel ? style.ring : style.stroke}
                        strokeWidth={isSel ? 3 : 2}
                      />
                    ) : (
                      <rect
                        x={t.x}
                        y={t.y}
                        width={t.width}
                        height={t.height}
                        rx={t.shape === "booth" ? 18 : 14}
                        fill={style.fill}
                        stroke={isSel ? style.ring : style.stroke}
                        strokeWidth={isSel ? 3 : 2}
                      />
                    )}

                    {/* label (only if zoom or selected => less clutter) */}
                    {(zoom > 0.85 || isSel) && (
                      <>
                        <rect
                          x={cx - 30}
                          y={cy - 12}
                          width={60}
                          height={24}
                          rx={12}
                          fill="rgba(255,255,255,0.88)"
                          stroke="#e2e8f0"
                        />
                        <text
                          x={cx}
                          y={cy + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ fontSize: 12, fontWeight: 800 }}
                          fill="#0f172a"
                        >
                          {t.label}
                        </text>
                      </>
                    )}

                    {/* seat dots only when enabled OR selected */}
                    {(showSeatDots || isSel) &&
                      Array.from({ length: Math.min(12, t.seats || 0) }).map((_, i) => {
                        const seats = Math.max(1, t.seats || 1);
                        const ang = (i / seats) * Math.PI * 2;
                        const rr = t.width / 2 + 14;
                        const dx = Math.cos(ang) * rr;
                        const dy = Math.sin(ang) * rr;
                        return <circle key={i} cx={cx + dx} cy={cy + dy} r={3.4} fill="#94a3b8" />;
                      })}
                  </g>
                );
              })}

              {/* ghost preview */}
              {ghost?.table && (
                <g opacity={0.55}>
                  {ghost.table.shape === "round" ? (
                    <circle
                      cx={ghost.table.x + ghost.table.width / 2}
                      cy={ghost.table.y + ghost.table.height / 2}
                      r={ghost.table.width / 2}
                      fill={ghost.valid ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}
                      stroke={ghost.valid ? "#10b981" : "#ef4444"}
                      strokeWidth="3"
                      strokeDasharray="7,7"
                    />
                  ) : (
                    <rect
                      x={ghost.table.x}
                      y={ghost.table.y}
                      width={ghost.table.width}
                      height={ghost.table.height}
                      rx="14"
                      fill={ghost.valid ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}
                      stroke={ghost.valid ? "#10b981" : "#ef4444"}
                      strokeWidth="3"
                      strokeDasharray="7,7"
                    />
                  )}
                </g>
              )}
            </svg>

            {/* small status chip */}
            <div className="absolute left-4 bottom-4">
              <div className="px-3 py-2 rounded-xl text-xs bg-white/80 border border-slate-200 shadow-sm text-slate-600">
                Seats: <b className="text-slate-900">{totalSeats}</b> • Tables: <b className="text-slate-900">{tables.length}</b>
                {ghost && drag && (
                  <>
                    {" • "}
                    <span className={ghost.valid ? "text-emerald-600" : "text-red-600"}>
                      {ghost.valid ? "Placement OK" : ghost.reason}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Right panel (premium & not crowded) */}
        {panelOpen && (
          <Card className="p-4 h-[680px] overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Builder Panel</div>
              <div className="flex gap-2">
                <Button size="sm" variant={panelTab === "ai" ? "default" : "outline"} onClick={() => setPanelTab("ai")}>
                  AI
                </Button>
                <Button size="sm" variant={panelTab === "props" ? "default" : "outline"} onClick={() => setPanelTab("props")}>
                  Properties
                </Button>
              </div>
            </div>

            {/* AI TAB */}
            {panelTab === "ai" && (
              <div className="mt-4 space-y-4">
                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Layout Assistant
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Generates a clean, realistic plan (aisles + balanced table mix). One click — no manual pain.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Vibe</label>
                  <Select value={aiVibe} onValueChange={setAiVibe}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cozy">Cozy (more 2/4-tops)</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="max">Max Seats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Target Seats</label>
                    <Input
                      type="number"
                      min="10"
                      value={aiTargetSeats}
                      onChange={(e) => setAiTargetSeats(Number(e.target.value || 40))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Aisle Width</label>
                    <Input
                      type="number"
                      min="40"
                      max="160"
                      value={aiAisle}
                      onChange={(e) => setAiAisle(Number(e.target.value || 80))}
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Include booths</div>
                    <div className="text-xs text-slate-600">Adds wall seating for realism</div>
                  </div>
                  <Switch checked={aiBooths} onCheckedChange={setAiBooths} />
                </label>

                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Use custom table mix</div>
                    <div className="text-xs text-slate-600">Instead of auto-calculating from seats</div>
                  </div>
                  <Switch checked={aiUseMix} onCheckedChange={setAiUseMix} />
                </label>

                {aiUseMix && (
                  <div className="grid grid-cols-2 gap-3">
                    {["t2", "t4", "t6", "t8"].map((k) => (
                      <div key={k} className="space-y-2">
                        <label className="text-xs font-medium text-slate-700">{k.toUpperCase()} count</label>
                        <Input
                          type="number"
                          min="0"
                          value={aiMix[k]}
                          onChange={(e) => setAiMix((m) => ({ ...m, [k]: Number(e.target.value || 0) }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={runAI} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Layout
                </Button>

                <div className="text-[11px] text-slate-500">
                  Pro tip: If it can’t fit all tables, reduce aisle width or increase outline size.
                </div>
              </div>
            )}

            {/* PROPERTIES TAB */}
            {panelTab === "props" && (
              <div className="mt-4 space-y-4">
                {!selectedTable ? (
                  <div className="p-4 rounded-xl border bg-slate-50 text-sm text-slate-700">
                    Select a table to edit details.
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-xl border bg-white">
                      <div className="text-sm font-semibold text-slate-900">Selected: {selectedTable.label}</div>
                      <div className="text-xs text-slate-600">Make quick changes without clutter.</div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Label</label>
                      <Input
                        value={selectedTable.label}
                        onChange={(e) => {
                          const next = tables.map((t) => (t.id === selectedTable.id ? { ...t, label: e.target.value } : t));
                          setTables(next);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700">Seats</label>
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={selectedTable.seats}
                          onChange={(e) => {
                            const v = Number(e.target.value || 1);
                            const next = tables.map((t) => (t.id === selectedTable.id ? { ...t, seats: v } : t));
                            setTables(next);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700">Shape</label>
                        <Select
                          value={selectedTable.shape}
                          onValueChange={(v) => {
                            const next = tables.map((t) => (t.id === selectedTable.id ? { ...t, shape: v } : t));
                            setTables(next);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SHAPES).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => rotateSelected(15)}>
                        <RotateCw className="w-4 h-4 mr-1" /> Rotate
                      </Button>
                      <Button size="sm" variant="outline" onClick={duplicateSelected}>
                        <Copy className="w-4 h-4 mr-1" /> Duplicate
                      </Button>
                      <Button size="sm" variant="destructive" onClick={deleteSelected}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </>
                )}

                <div className="pt-2 border-t">
                  {errors.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {errors.slice(0, 4).map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                          <AlertCircle className="w-4 h-4 mt-0.5" /> {e.message}
                        </div>
                      ))}
                      {errors.length > 4 && <div className="text-xs text-red-600">+ {errors.length - 4} more…</div>}
                    </div>
                  )}

                  <Button
                    onClick={handlePublish}
                    disabled={isSaving || errors.length > 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Publish Floor Plan
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

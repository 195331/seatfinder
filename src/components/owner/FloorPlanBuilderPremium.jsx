import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Circle, Line, Text, Transformer } from "react-konva";
import Konva from "konva";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MousePointer2,
  Hand,
  Square,
  Pencil,
  Home,
  Type,
  Sparkles,
  BringToFront,
  SendToBack,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Save,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Move
} from "lucide-react";

const CANVAS_W = 2400;
const CANVAS_H = 1700;

// Dark canvas + light toolbar style like your screenshot
const UI = {
  toolbarBg: "rgba(255,255,255,0.92)",
  toolbarBorder: "rgba(15,23,42,0.08)",
  toolbarText: "rgba(15,23,42,0.85)",
  toolbarSubtext: "rgba(15,23,42,0.55)",
  pillOnBg: "rgba(15,23,42,0.9)",
  pillOnText: "white",
  pillOffBg: "rgba(15,23,42,0.05)",
  pillOffText: "rgba(15,23,42,0.8)",
  pillBorder: "rgba(15,23,42,0.12)"
};

const COLORS = {
  canvasBg: "#0b1220",
  vignette: "rgba(0,0,0,0.55)",
  gridMajor: "rgba(255,255,255,0.06)",
  gridMinor: "rgba(255,255,255,0.03)",
  text: "rgba(255,255,255,0.92)",
  subtext: "rgba(255,255,255,0.60)",
  accent: "#22c55e",
  tableFill: "rgba(255,255,255,0.08)",
  tableStroke: "rgba(255,255,255,0.18)",
  wall: "rgba(255,255,255,0.42)",
  roomFill: "rgba(34,197,94,0.10)",
  roomStroke: "rgba(34,197,94,0.38)",
  noteFill: "rgba(59,130,246,0.10)",
  noteStroke: "rgba(59,130,246,0.35)",
  danger: "#ef4444"
};

const ROOM_TABS = [
  { id: "MAIN", label: "MAIN" },
  { id: "ROOF", label: "ROOF" },
  { id: "LOUNGE", label: "LOUNGE" }
];

// Restored seat options including 1 seat
const TABLE_PRESETS = [
  { seats: 1, w: 56, h: 56, shape: "round" },
  { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 86, h: 86, shape: "round" },
  { seats: 6, w: 112, h: 76, shape: "rect" },
  { seats: 8, w: 132, h: 84, shape: "rect" },
  { seats: 10, w: 154, h: 92, shape: "rect" }
];

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

// --- helpers ---
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function toFlat(points) {
  const out = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}
function fromFlat(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 2) out.push({ x: arr[i], y: arr[i + 1] });
  return out;
}
function simplifyPoints(points, minStep = 10) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    if (dist(prev, cur) >= minStep) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}
function snapAngle(p0, p1) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: p0.x + Math.cos(snapped) * len, y: p0.y + Math.sin(snapped) * len };
}

async function callFloorplanAI({ restaurantId, roomId, selection, allItems, prompt }) {
  try {
    if (base44?.functions?.invoke) {
      const res = await base44.functions.invoke("floorplan_ai", {
        restaurantId,
        roomId,
        selection,
        allItems,
        prompt
      });
      return res?.data ?? res;
    }
    if (base44?.ai?.chat) {
      const res = await base44.ai.chat({
        messages: [
          { role: "system", content: "You are a restaurant floor plan designer. Output JSON actions only." },
          { role: "user", content: prompt }
        ]
      });
      return res;
    }
    return { ok: true, actions: [], message: "AI not connected yet." };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);

  const [roomId, setRoomId] = useState("MAIN");

  // Camera
  const [cam, setCam] = useState({ x: -260, y: -140, scale: 1.18 });

  // Tools
  const [tool, setTool] = useState("select"); // select | pan | addTable | drawWall | drawRoom | drawRoomRect | addText
  const [presetIndex, setPresetIndex] = useState(2); // default 4-seat

  // Toggles
  const [showGrid, setShowGrid] = useState(true);
  const [collisionGuard, setCollisionGuard] = useState(true);
  const [snapAnglesEnabled, setSnapAnglesEnabled] = useState(true);

  // Data
  const [rooms, setRooms] = useState(() =>
    ROOM_TABS.reduce((acc, r) => {
      acc[r.id] = { roomId: r.id, roomBoundary: [], walls: [], items: [] };
      return acc;
    }, {})
  );

  // selection
  const [selectedIds, setSelectedIds] = useState([]);

  // context menu (custom)
  const [contextMenu, setContextMenu] = useState(null); // {x,y, targetId}
  const [actionsAnchor, setActionsAnchor] = useState(null); // for iPad / no-right-click fallback

  // drawing state
  const [draftPoints, setDraftPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // rect room tool
  const [rectDraft, setRectDraft] = useState(null); // {x0,y0,x1,y1}

  // note edit
  const [noteEdit, setNoteEdit] = useState({ id: null, text: "" });

  const [isSaving, setIsSaving] = useState(false);

  const current = rooms[roomId];

  // Load from restaurant.floor_plan_data
  useEffect(() => {
    if (!restaurant?.floor_plan_data?.rooms) return;
    try {
      const fp = restaurant.floor_plan_data;
      setRooms((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (fp.rooms[k]) next[k] = { ...next[k], ...fp.rooms[k] };
        }
        return next;
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  // transformer sync
  useEffect(() => {
    const tr = transformerRef.current;
    const st = stageRef.current;
    if (!tr || !st) return;
    const nodes = selectedIds.map((id) => st.findOne(`#${id}`)).filter(Boolean);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, roomId, rooms]);

  const allSelectable = useMemo(() => {
    const items = current?.items ?? [];
    const walls = current?.walls ?? [];
    return [
      ...walls.map((w) => ({ ...w, type: "wall" })),
      ...items
    ].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  }, [current]);

  const selected = useMemo(() => {
    const map = new Map(allSelectable.map((x) => [x.id, x]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [selectedIds, allSelectable]);

  // grid
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const lines = [];
    const stepMinor = 40;
    const stepMajor = 200;
    for (let x = 0; x <= CANVAS_W; x += stepMinor) {
      lines.push({
        points: [x, 0, x, CANVAS_H],
        stroke: x % stepMajor === 0 ? COLORS.gridMajor : COLORS.gridMinor,
        width: x % stepMajor === 0 ? 1.2 : 0.6
      });
    }
    for (let y = 0; y <= CANVAS_H; y += stepMinor) {
      lines.push({
        points: [0, y, CANVAS_W, y],
        stroke: y % stepMajor === 0 ? COLORS.gridMajor : COLORS.gridMinor,
        width: y % stepMajor === 0 ? 1.2 : 0.6
      });
    }
    return lines;
  }, [showGrid]);

  // chair nubs for round tables
  function ChairNubs({ w, h, seats }) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h) / 2 + 12;
    const count = Math.max(1, Math.min(12, seats || 4));
    const nubs = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      nubs.push(
        <Circle
          key={i}
          x={cx + Math.cos(a) * r}
          y={cy + Math.sin(a) * r}
          radius={5}
          fill={"rgba(255,255,255,0.18)"}
          stroke={"rgba(255,255,255,0.22)"}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    return <>{nubs}</>;
  }

  // update room helper
  function updateRoom(patchFn) {
    setRooms((prev) => {
      const next = { ...prev };
      next[roomId] = patchFn(next[roomId]);
      return next;
    });
  }

  // collision (tables only, approximate rect box)
  function rectsOverlap(a, b, pad = 10) {
    return !(
      a.x + a.w + pad < b.x ||
      a.x > b.x + b.w + pad ||
      a.y + a.h + pad < b.y ||
      a.y > b.y + b.h + pad
    );
  }
  function wouldCollide(movingId, nextRect) {
    if (!collisionGuard) return false;
    for (const it of current.items || []) {
      if (it.type !== "table") continue;
      if (it.id === movingId) continue;
      const r2 = { x: it.x, y: it.y, w: it.w, h: it.h };
      if (rectsOverlap(nextRect, r2, 12)) return true;
    }
    return false;
  }

  // world coordinates
  function getWorldPos() {
    const st = stageRef.current;
    if (!st) return { x: 0, y: 0 };
    const p = st.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    const scale = st.scaleX();
    return { x: (p.x - st.x()) / scale, y: (p.y - st.y()) / scale };
  }

  // z index ops
  function bumpZ(ids, delta) {
    updateRoom((r) => {
      const items = (r.items || []).map((it) =>
        ids.includes(it.id) ? { ...it, z: (it.z ?? 0) + delta } : it
      );
      const walls = (r.walls || []).map((w) =>
        ids.includes(w.id) ? { ...w, z: (w.z ?? 0) + delta } : w
      );
      return { ...r, items, walls };
    });
  }
  function setLocked(ids, locked) {
    updateRoom((r) => {
      const items = (r.items || []).map((it) => (ids.includes(it.id) ? { ...it, locked } : it));
      const walls = (r.walls || []).map((w) => (ids.includes(w.id) ? { ...w, locked } : w));
      return { ...r, items, walls };
    });
  }
  function deleteIds(ids) {
    updateRoom((r) => {
      const items = (r.items || []).filter((it) => !ids.includes(it.id));
      const walls = (r.walls || []).filter((w) => !ids.includes(w.id));
      return { ...r, items, walls };
    });
    setSelectedIds([]);
  }

  // add table / note
  function addTableAt(world) {
    const preset = TABLE_PRESETS[presetIndex] || TABLE_PRESETS[2];
    const id = uid();
    const baseZ =
      Math.max(
        0,
        ...(current.items || []).map((i) => i.z ?? 0),
        ...(current.walls || []).map((w) => w.z ?? 0)
      ) + 1;

    const table = {
      id,
      type: "table",
      x: world.x - preset.w / 2,
      y: world.y - preset.h / 2,
      w: preset.w,
      h: preset.h,
      shape: preset.shape,
      seats: preset.seats,
      label: `${preset.seats}`,
      rotation: 0,
      fill: COLORS.tableFill,
      stroke: COLORS.tableStroke,
      locked: false,
      z: baseZ
    };

    updateRoom((r) => ({ ...r, items: [...(r.items || []), table] }));
    setSelectedIds([id]);
  }

  function addNoteAt(world) {
    const id = uid();
    const baseZ =
      Math.max(
        0,
        ...(current.items || []).map((i) => i.z ?? 0),
        ...(current.walls || []).map((w) => w.z ?? 0)
      ) + 1;

    const note = {
      id,
      type: "note",
      x: world.x - 120,
      y: world.y - 28,
      w: 240,
      h: 56,
      text: "Note",
      rotation: 0,
      fill: COLORS.noteFill,
      stroke: COLORS.noteStroke,
      locked: false,
      z: baseZ,
      reservable: false // important: diners can never reserve notes/background
    };

    updateRoom((r) => ({ ...r, items: [...(r.items || []), note] }));
    setSelectedIds([id]);
    setNoteEdit({ id, text: note.text });
  }

  function updateItem(id, patch) {
    updateRoom((r) => ({ ...r, items: (r.items || []).map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function updateWall(id, patch) {
    updateRoom((r) => ({ ...r, walls: (r.walls || []).map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  }

  function finalizeWall(points) {
    const id = uid();
    const baseZ =
      Math.max(
        0,
        ...(current.items || []).map((i) => i.z ?? 0),
        ...(current.walls || []).map((w) => w.z ?? 0)
      ) + 1;

    updateRoom((r) => ({
      ...r,
      walls: [...(r.walls || []), { id, points, thickness: 10, locked: false, z: baseZ }]
    }));
    setSelectedIds([id]);
  }

  function finalizeRoomBoundary(points) {
    updateRoom((r) => ({ ...r, roomBoundary: points }));
  }

  // --- Context menu: disable browser menu reliably ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    // prevent browser context menu within this component
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  function openContextMenuAt(stagePos, targetId = null) {
    setContextMenu({ x: stagePos.x, y: stagePos.y, targetId });
  }
  function closeContextMenu() {
    setContextMenu(null);
  }

  function openContextMenuFromEvent(e, targetId = null) {
    e?.evt?.preventDefault?.();
    const st = stageRef.current;
    const pos = st?.getPointerPosition();
    if (!pos) return;
    if (!targetId) setSelectedIds([]);
    openContextMenuAt(pos, targetId);
  }

  // fallback Actions button (no right-click needed)
  function openActionsMenu() {
    const st = stageRef.current;
    if (!st) return;
    // open near top-right inside stage container
    openContextMenuAt({ x: st.width() - 270, y: 14 }, selectedIds[0] || null);
  }

  // --- Ask AI ---
  async function handleAskAI(targetId) {
    closeContextMenu();
    const target =
      allSelectable.find((x) => x.id === targetId) ||
      (selected.length ? selected[0] : null);

    const prompt =
      target?.type === "table"
        ? `Improve placement for this table: seats=${target.seats}, pos=(${Math.round(target.x)},${Math.round(
            target.y
          )}). Suggest layout improvements for convenience. Output JSON actions.`
        : `Improve overall restaurant floor plan layout for convenience and clarity. Output JSON actions.`;

    toast.message("Asking AI…");

    const res = await callFloorplanAI({
      restaurantId: restaurant?.id,
      roomId,
      selection: target,
      allItems: {
        roomBoundary: current.roomBoundary || [],
        walls: current.walls || [],
        items: current.items || []
      },
      prompt
    });

    if (!res?.ok && res?.error) {
      toast.error(`AI error: ${res.error}`);
      return;
    }

    const actions = res?.actions || res?.data?.actions || [];
    if (!Array.isArray(actions) || actions.length === 0) {
      toast.success("AI responded (no changes applied).");
      return;
    }

    updateRoom((r) => {
      let items = [...(r.items || [])];
      let walls = [...(r.walls || [])];

      for (const a of actions) {
        if (!a || typeof a !== "object") continue;

        if (a.type === "move") {
          items = items.map((it) => (it.id === a.id ? { ...it, x: a.x ?? it.x, y: a.y ?? it.y } : it));
          walls = walls.map((w) => (w.id === a.id ? { ...w, points: a.points ?? w.points } : w));
        }

        if (a.type === "rotate") {
          items = items.map((it) => (it.id === a.id ? { ...it, rotation: a.rotation ?? it.rotation } : it));
        }

        if (a.type === "addTable") {
          const preset = TABLE_PRESETS.find((p) => p.seats === a.seats) || TABLE_PRESETS[2];
          items.push({
            id: uid(),
            type: "table",
            x: (a.x ?? 200) - preset.w / 2,
            y: (a.y ?? 200) - preset.h / 2,
            w: preset.w,
            h: preset.h,
            shape: a.shape || preset.shape,
            seats: a.seats || preset.seats,
            label: `${a.seats || preset.seats}`,
            rotation: a.rotation || 0,
            fill: COLORS.tableFill,
            stroke: COLORS.tableStroke,
            locked: false,
            z: Math.max(1, ...items.map((i) => i.z ?? 0)) + 1
          });
        }

        if (a.type === "setRoomBoundary" && Array.isArray(a.points)) {
          const pts = typeof a.points[0] === "number" ? fromFlat(a.points) : a.points;
          r.roomBoundary = pts;
        }
      }

      return { ...r, items, walls };
    });

    toast.success("AI applied improvements.");
  }

  // --- Publish (same robust method as before) ---
  async function handlePublish() {
    if (!restaurant?.id) {
      toast.error("Missing restaurant");
      return;
    }
    setIsSaving(true);
    try {
      const floorPlanData = {
        rooms,
        publishedAt: new Date().toISOString(),
        version: 3
      };

      const allTables = Object.values(rooms)
        .flatMap((r) => r.items || [])
        .filter((i) => i.type === "table");

      const totalSeats = allTables.reduce((sum, t) => sum + (t.seats || 0), 0);

      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: floorPlanData,
        total_seats: totalSeats,
        available_seats: totalSeats
      });

      // Upsert tables so Live Floor Plan never blanks
      const existing = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const existingByFpId = new Map(
        (existing || [])
          .filter((t) => t.floorplan_item_id)
          .map((t) => [t.floorplan_item_id, t])
      );

      const keep = new Set();
      for (const t of allTables) {
        const fpId = t.id;
        const found = existingByFpId.get(fpId);

        const payload = {
          restaurant_id: restaurant.id,
          floorplan_item_id: fpId,
          label: t.label ? `T${t.label}` : `T${t.seats}`,
          capacity: t.seats,
          status: "free",
          position_x: t.x,
          position_y: t.y,
          shape: t.shape,
          rotation: t.rotation || 0,
          room_id: roomId,
          z_index: t.z ?? 0
        };

        if (found?.id) {
          await base44.entities.Table.update(found.id, payload);
          keep.add(found.id);
        } else {
          const created = await base44.entities.Table.create(payload);
          keep.add(created?.id);
        }
      }

      for (const old of existing || []) {
        if (!keep.has(old.id) && old.floorplan_item_id) {
          await base44.entities.Table.delete(old.id);
        }
      }

      toast.success("Published! Live floor plan updated.");
      onPublish?.(floorPlanData);
    } catch (e) {
      toast.error(`Publish failed: ${String(e?.message || e)}`);
    } finally {
      setIsSaving(false);
    }
  }

  // --- Zoom helpers ---
  function clampScale(s) {
    return Math.max(0.35, Math.min(2.4, s));
  }

  function zoomAt(pointer, factor) {
    const st = stageRef.current;
    if (!st) return;

    const oldScale = st.scaleX();
    const newScale = clampScale(oldScale * factor);

    const mousePointTo = {
      x: (pointer.x - st.x()) / oldScale,
      y: (pointer.y - st.y()) / oldScale
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    setCam({ x: newPos.x, y: newPos.y, scale: newScale });
  }

  function fitToBoundary() {
    const boundary = current?.roomBoundary;
    if (!boundary || boundary.length < 3) {
      toast.message("Draw a room boundary first to Fit.");
      return;
    }
    const xs = boundary.map((p) => p.x);
    const ys = boundary.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const pad = 80;
    const boxW = (maxX - minX) + pad * 2;
    const boxH = (maxY - minY) + pad * 2;

    const st = stageRef.current;
    if (!st) return;
    const viewW = st.width();
    const viewH = st.height();

    const scale = clampScale(Math.min(viewW / boxW, viewH / boxH));
    const x = -(minX - pad) * scale + 20;
    const y = -(minY - pad) * scale + 20;
    setCam({ x, y, scale });
  }

  // Stage events
  function onStageMouseDown(e) {
    closeContextMenu();

    // Right click handled by onContextMenu; do nothing here
    if (e.evt?.button === 2) return;

    const clickedEmpty = e.target === e.target.getStage();
    const world = getWorldPos();

    if (tool === "addTable") {
      addTableAt(world);
      return;
    }

    if (tool === "addText") {
      addNoteAt(world);
      return;
    }

    if (tool === "drawRoomRect") {
      setRectDraft({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
      setIsDrawing(true);
      return;
    }

    if (tool === "drawWall" || tool === "drawRoom") {
      setIsDrawing(true);
      setDraftPoints((prev) => {
        const next = prev.length ? prev : [world];
        if (tool === "drawRoom" && next.length >= 3) {
          const start = next[0];
          if (dist(start, world) < 18) {
            finalizeRoomBoundary(simplifyPoints(next));
            setIsDrawing(false);
            setDraftPoints([]);
            return [];
          }
        }
        return [...next, world];
      });
      return;
    }

    if (tool === "select") {
      if (clickedEmpty) setSelectedIds([]);
    }
  }

  function onStageMouseMove() {
    if (!isDrawing) return;
    const world = getWorldPos();

    if (tool === "drawRoomRect" && rectDraft) {
      setRectDraft((r) => ({ ...r, x1: world.x, y1: world.y }));
      return;
    }

    if (tool === "drawWall" || tool === "drawRoom") {
      setDraftPoints((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const nextPoint = snapAnglesEnabled ? snapAngle(last, world) : world;
        return [...prev.slice(0, -1), nextPoint];
      });
    }
  }

  function onStageMouseUp() {
    if (!isDrawing) return;

    if (tool === "drawRoomRect" && rectDraft) {
      const { x0, y0, x1, y1 } = rectDraft;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);

      // Ignore tiny drags
      if (maxX - minX > 40 && maxY - minY > 40) {
        finalizeRoomBoundary([
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY }
        ]);
      }
      setRectDraft(null);
      setIsDrawing(false);
      return;
    }

    if (tool === "drawWall") {
      const pts = simplifyPoints(draftPoints);
      if (pts.length >= 2) finalizeWall(pts);
      setDraftPoints([]);
      setIsDrawing(false);
    }

    // drawRoom continues until close point clicked
  }

  // wheel zoom (works even when not panning)
  function onWheel(e) {
    e.evt.preventDefault();
    const st = stageRef.current;
    if (!st) return;
    const pointer = st.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.08 : 0.92;
    zoomAt(pointer, factor);
  }

  // Note edit panel sync
  useEffect(() => {
    if (selected.length === 1 && selected[0]?.type === "note") {
      setNoteEdit({ id: selected[0].id, text: selected[0].text || "" });
    }
  }, [selected]);

  // Context menu options
  function contextIds(targetId) {
    if (targetId) return [targetId];
    return selectedIds.length ? selectedIds : [];
  }

  // ---- Render ----
  return (
    <div ref={containerRef} className="space-y-4 select-none">
      {/* Toolbar */}
      <Card
        className="p-4 border-0"
        style={{ background: UI.toolbarBg, border: `1px solid ${UI.toolbarBorder}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tool buttons */}
            {[
              { id: "select", label: "Select", Icon: MousePointer2 },
              { id: "pan", label: "Pan", Icon: Hand },
              { id: "addTable", label: "Add Table", Icon: Square },
              { id: "drawWall", label: "Draw Wall", Icon: Pencil },
              { id: "drawRoomRect", label: "Room Rect", Icon: Home },
              { id: "drawRoom", label: "Room Free", Icon: Move },
              { id: "addText", label: "Note", Icon: Type }
            ].map(({ id, label, Icon }) => {
              const active = tool === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTool(id);
                    setDraftPoints([]);
                    setIsDrawing(false);
                    setRectDraft(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition"
                  style={{
                    background: active ? UI.pillOnBg : UI.pillOffBg,
                    color: active ? UI.pillOnText : UI.pillOffText,
                    borderColor: UI.pillBorder
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}

            {/* Seat presets (RESTORED) */}
            <div className="flex items-center gap-1 ml-2">
              {TABLE_PRESETS.map((p, idx) => {
                const active = presetIndex === idx;
                return (
                  <button
                    key={p.seats}
                    onClick={() => {
                      setPresetIndex(idx);
                      setTool("addTable");
                    }}
                    className="px-3 py-2 rounded-full border text-sm font-bold transition"
                    style={{
                      background: active ? "rgba(15,23,42,0.9)" : "rgba(15,23,42,0.04)",
                      color: active ? "white" : "rgba(15,23,42,0.75)",
                      borderColor: "rgba(15,23,42,0.12)"
                    }}
                    title={`${p.seats}-seat table`}
                  >
                    {p.seats}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Visibility fixes: these were too faint before */}
            <div className="flex items-center gap-2 text-sm" style={{ color: UI.toolbarText }}>
              <span className="font-semibold">Grid</span>
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            </div>

            <div className="flex items-center gap-2 text-sm" style={{ color: UI.toolbarText }}>
              <span className="font-semibold">No-overlap</span>
              <Switch checked={collisionGuard} onCheckedChange={setCollisionGuard} />
            </div>

            <div className="flex items-center gap-2 text-sm" style={{ color: UI.toolbarText }}>
              <span className="font-semibold">Auto-straighten</span>
              <Switch checked={snapAnglesEnabled} onCheckedChange={setSnapAnglesEnabled} />
            </div>

            {/* Zoom controls (RESTORED) */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setCam((c) => ({ ...c, scale: clampScale(c.scale * 1.12) }))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setCam((c) => ({ ...c, scale: clampScale(c.scale * 0.88) }))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="rounded-full" onClick={fitToBoundary}>
                <LocateFixed className="w-4 h-4 mr-2" /> Fit
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setCam({ x: -260, y: -140, scale: 1.18 })}
              >
                Reset
              </Button>
            </div>

            {/* Actions menu fallback */}
            <Button variant="outline" className="rounded-full" onClick={openActionsMenu}>
              ⋯ Actions
            </Button>

            {/* Publish */}
            <Button
              onClick={handlePublish}
              disabled={isSaving}
              className="rounded-full bg-black text-white hover:bg-black/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs" style={{ color: UI.toolbarSubtext }}>
          Right-click any item for AI/Z-order/Lock/Duplicate/Delete. Double-click a note to edit. Mousewheel zoom works too.
        </div>
      </Card>

      {/* Canvas */}
      <Card className="border-0 overflow-hidden" style={{ background: COLORS.canvasBg }}>
        <div className="relative" style={{ height: 690 }}>
          {/* subtle vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 600px at 50% 35%, rgba(34,197,94,0.08), rgba(0,0,0,0.55) 70%)"
            }}
          />

          <Stage
            ref={stageRef}
            width={window.innerWidth ? Math.min(window.innerWidth - 64, 1180) : 1180}
            height={690}
            x={cam.x}
            y={cam.y}
            scaleX={cam.scale}
            scaleY={cam.scale}
            draggable={tool === "pan"}
            onDragEnd={(e) => {
              if (tool !== "pan") return;
              setCam((c) => ({ ...c, x: e.target.x(), y: e.target.y() }));
            }}
            onWheel={onWheel}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            // IMPORTANT: this is what makes your menu work instead of browser menu
            onContextMenu={(e) => openContextMenuFromEvent(e, null)}
          >
            <Layer>
              {/* Grid */}
              {gridLines.map((g, i) => (
                <Line key={i} points={g.points} stroke={g.stroke} strokeWidth={g.width} listening={false} />
              ))}

              {/* Room boundary */}
              {current?.roomBoundary?.length >= 3 && (
                <>
                  <Line
                    points={toFlat([...current.roomBoundary, current.roomBoundary[0]])}
                    closed
                    fill={COLORS.roomFill}
                    stroke={COLORS.roomStroke}
                    strokeWidth={2}
                    listening={false}
                  />
                  <Text
                    x={current.roomBoundary[0].x + 10}
                    y={current.roomBoundary[0].y + 10}
                    text={roomId}
                    fill={COLORS.subtext}
                    fontSize={14}
                    listening={false}
                  />
                </>
              )}

              {/* Rect boundary draft preview */}
              {rectDraft && (
                <Rect
                  x={Math.min(rectDraft.x0, rectDraft.x1)}
                  y={Math.min(rectDraft.y0, rectDraft.y1)}
                  width={Math.abs(rectDraft.x1 - rectDraft.x0)}
                  height={Math.abs(rectDraft.y1 - rectDraft.y0)}
                  stroke={COLORS.roomStroke}
                  strokeWidth={2}
                  dash={[10, 8]}
                  listening={false}
                />
              )}

              {/* Walls */}
              {(current?.walls || [])
                .slice()
                .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
                .map((w) => {
                  const isSelected = selectedIds.includes(w.id);
                  return (
                    <Line
                      key={w.id}
                      id={w.id}
                      points={toFlat(w.points || [])}
                      stroke={COLORS.wall}
                      strokeWidth={w.thickness || 10}
                      lineCap="round"
                      lineJoin="round"
                      opacity={isSelected ? 0.92 : 0.66}
                      shadowBlur={isSelected ? 10 : 0}
                      shadowColor={COLORS.accent}
                      draggable={!w.locked && tool === "select"}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        if (e.evt?.button === 2) {
                          openContextMenuFromEvent(e, w.id);
                          return;
                        }
                        if (e.evt?.shiftKey) {
                          setSelectedIds((prev) => (prev.includes(w.id) ? prev : [...prev, w.id]));
                        } else {
                          setSelectedIds([w.id]);
                        }
                      }}
                      onContextMenu={(e) => openContextMenuFromEvent(e, w.id)}
                      onDragMove={(e) => {
                        const node = e.target;
                        const dx = node.x();
                        const dy = node.y();
                        const next = (w.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy }));
                        node.x(0);
                        node.y(0);
                        updateWall(w.id, { points: next });
                      }}
                    />
                  );
                })}

              {/* Items */}
              {(current?.items || [])
                .slice()
                .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
                .map((it) => {
                  const isSelected = selectedIds.includes(it.id);
                  const locked = !!it.locked;

                  if (it.type === "note") {
                    return (
                      <Group
                        key={it.id}
                        id={it.id}
                        x={it.x}
                        y={it.y}
                        rotation={it.rotation || 0}
                        draggable={!locked && tool === "select"}
                        onMouseDown={(e) => {
                          e.cancelBubble = true;
                          if (e.evt?.button === 2) {
                            openContextMenuFromEvent(e, it.id);
                            return;
                          }
                          if (e.evt?.shiftKey) {
                            setSelectedIds((prev) => (prev.includes(it.id) ? prev : [...prev, it.id]));
                          } else {
                            setSelectedIds([it.id]);
                          }
                        }}
                        onDblClick={() => {
                          setSelectedIds([it.id]);
                          setNoteEdit({ id: it.id, text: it.text || "" });
                        }}
                        onContextMenu={(e) => openContextMenuFromEvent(e, it.id)}
                      >
                        <Rect
                          width={it.w}
                          height={it.h}
                          fill={it.fill || COLORS.noteFill}
                          stroke={isSelected ? COLORS.accent : it.stroke || COLORS.noteStroke}
                          strokeWidth={isSelected ? 2.5 : 1.6}
                          cornerRadius={14}
                          shadowBlur={isSelected ? 14 : 0}
                          shadowColor={COLORS.accent}
                        />
                        <Text
                          x={16}
                          y={16}
                          text={it.text || "Note"}
                          fill={COLORS.text}
                          fontSize={16}
                          fontStyle="600"
                        />
                      </Group>
                    );
                  }

                  // table
                  const nextRect = { x: it.x, y: it.y, w: it.w, h: it.h };
                  const colliding = it.type === "table" && collisionGuard && wouldCollide(it.id, nextRect);
                  const label = it.label || `${it.seats}`;

                  return (
                    <Group
                      key={it.id}
                      id={it.id}
                      x={it.x}
                      y={it.y}
                      rotation={it.rotation || 0}
                      draggable={!locked && tool === "select"}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        if (e.evt?.button === 2) {
                          openContextMenuFromEvent(e, it.id);
                          return;
                        }
                        if (e.evt?.shiftKey) {
                          setSelectedIds((prev) => (prev.includes(it.id) ? prev : [...prev, it.id]));
                        } else {
                          setSelectedIds([it.id]);
                        }
                      }}
                      onContextMenu={(e) => openContextMenuFromEvent(e, it.id)}
                      onDragMove={(e) => {
                        const node = e.target;
                        const nx = node.x();
                        const ny = node.y();
                        const testRect = { x: nx, y: ny, w: it.w, h: it.h };
                        if (collisionGuard && wouldCollide(it.id, testRect)) return;
                        updateItem(it.id, { x: nx, y: ny });
                      }}
                      onDragEnd={(e) => updateItem(it.id, { x: e.target.x(), y: e.target.y() })}
                    >
                      {it.shape === "round" && <ChairNubs w={it.w} h={it.h} seats={it.seats} />}

                      {it.shape === "round" ? (
                        <Circle
                          x={it.w / 2}
                          y={it.h / 2}
                          radius={it.w / 2}
                          fill={it.fill || COLORS.tableFill}
                          stroke={
                            colliding ? COLORS.danger : isSelected ? COLORS.accent : it.stroke || COLORS.tableStroke
                          }
                          strokeWidth={isSelected ? 3 : 2}
                          shadowBlur={isSelected ? 14 : 0}
                          shadowColor={COLORS.accent}
                        />
                      ) : (
                        <Rect
                          width={it.w}
                          height={it.h}
                          fill={it.fill || COLORS.tableFill}
                          stroke={
                            colliding ? COLORS.danger : isSelected ? COLORS.accent : it.stroke || COLORS.tableStroke
                          }
                          strokeWidth={isSelected ? 3 : 2}
                          cornerRadius={14}
                          shadowBlur={isSelected ? 14 : 0}
                          shadowColor={COLORS.accent}
                        />
                      )}

                      <Text
                        x={0}
                        y={0}
                        width={it.w}
                        height={it.h}
                        align="center"
                        verticalAlign="middle"
                        text={label}
                        fill={COLORS.text}
                        fontSize={18}
                        fontStyle="700"
                        listening={false}
                      />

                      {locked && (
                        <Text
                          x={it.w - 18}
                          y={6}
                          text="🔒"
                          fontSize={14}
                          opacity={0.85}
                          listening={false}
                        />
                      )}
                    </Group>
                  );
                })}

              {/* Draft poly drawing preview */}
              {(tool === "drawWall" || tool === "drawRoom") && draftPoints.length >= 2 && (
                <Line
                  points={toFlat(draftPoints)}
                  stroke={tool === "drawRoom" ? COLORS.roomStroke : COLORS.wall}
                  strokeWidth={tool === "drawRoom" ? 2 : 10}
                  lineCap="round"
                  lineJoin="round"
                  dash={tool === "drawRoom" ? [10, 8] : undefined}
                  opacity={0.9}
                  listening={false}
                />
              )}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                enabledAnchors={[]}
                boundBoxFunc={(oldBox, newBox) => newBox}
              />
            </Layer>
          </Stage>

          {/* Bottom-right room tabs */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/8 border border-white/10 rounded-2xl p-2 backdrop-blur">
            {ROOM_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setRoomId(t.id);
                  setSelectedIds([]);
                  closeContextMenu();
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  roomId === t.id ? "bg-white/16 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Custom context menu */}
          {contextMenu && (
            <div className="absolute z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className="w-64 rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 text-white/80 text-xs border-b border-white/10 flex items-center gap-2">
                  Actions
                </div>

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => handleAskAI(contextMenu.targetId)}
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  Ask AI (improve layout)
                </button>

                <div className="border-t border-white/10" />

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    bumpZ(ids, +1);
                    closeContextMenu();
                  }}
                >
                  <BringToFront className="w-4 h-4" />
                  Bring Forward
                </button>

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    bumpZ(ids, -1);
                    closeContextMenu();
                  }}
                >
                  <SendToBack className="w-4 h-4" />
                  Send Backward
                </button>

                <div className="border-t border-white/10" />

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    const anyLocked = ids.some((id) => !!allSelectable.find((x) => x.id === id)?.locked);
                    setLocked(ids, !anyLocked);
                    closeContextMenu();
                  }}
                >
                  {(() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    const anyLocked = ids.some((id) => !!allSelectable.find((x) => x.id === id)?.locked);
                    return anyLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />;
                  })()}
                  Lock / Unlock
                </button>

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const id = contextMenu.targetId;
                    if (!id) return closeContextMenu();
                    const t = allSelectable.find((x) => x.id === id);
                    if (!t) return closeContextMenu();

                    if (t.type === "wall") {
                      updateRoom((r) => ({
                        ...r,
                        walls: [
                          ...(r.walls || []),
                          { ...t, id: uid(), points: (t.points || []).map((p) => ({ x: p.x + 16, y: p.y + 16 })) }
                        ]
                      }));
                    } else {
                      updateRoom((r) => ({
                        ...r,
                        items: [
                          ...(r.items || []),
                          { ...t, id: uid(), x: (t.x ?? 0) + 18, y: (t.y ?? 0) + 18 }
                        ]
                      }));
                    }
                    closeContextMenu();
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>

                <button
                  className="w-full px-4 py-3 text-left text-red-300 hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    deleteIds(ids);
                    closeContextMenu();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>

                <div className="border-t border-white/10" />
                <button
                  className="w-full px-4 py-2 text-xs text-white/60 hover:bg-white/5"
                  onClick={closeContextMenu}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Note editor (RESTORED + always works) */}
      {selected.length === 1 && selected[0]?.type === "note" && (
        <Card className="p-4 border border-slate-200">
          <div className="font-semibold mb-2">Edit Note</div>
          <Input
            value={noteEdit.text}
            onChange={(e) => setNoteEdit((n) => ({ ...n, text: e.target.value }))}
            placeholder="Explain something in the background (not reservable)"
          />
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => {
                updateItem(noteEdit.id, { text: noteEdit.text });
                toast.success("Note updated.");
              }}
            >
              Save Note
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNoteEdit({ id: selected[0].id, text: selected[0].text || "" });
              }}
            >
              Reset
            </Button>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Notes are owner-only; diners can reserve <b>tables only</b>.
          </div>
        </Card>
      )}
    </div>
  );

  // ---- clampScale is used above ----
  function clampScale(s) {
    return Math.max(0.35, Math.min(2.4, s));
  }
}

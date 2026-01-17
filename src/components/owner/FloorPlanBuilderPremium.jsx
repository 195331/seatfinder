import React, { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Group, Rect, Circle, Line, Text, Transformer } from "react-konva";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MousePointer2,
  Hand,
  Square,
  Circle as CircleIcon,
  Pencil,
  Home,
  Layers,
  Type,
  Sparkles,
  BringToFront,
  SendToBack,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Wand2,
  Save
} from "lucide-react";

const CANVAS_W = 2200;
const CANVAS_H = 1600;

// Visual defaults
const COLORS = {
  bg: "#0b1220",
  gridMajor: "rgba(255,255,255,0.06)",
  gridMinor: "rgba(255,255,255,0.03)",
  panel: "rgba(255,255,255,0.06)",
  panelBorder: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.92)",
  subtext: "rgba(255,255,255,0.60)",
  accent: "#22c55e",
  warn: "#f59e0b",
  danger: "#ef4444",
  tableFill: "rgba(255,255,255,0.08)",
  tableStroke: "rgba(255,255,255,0.18)",
  wall: "rgba(255,255,255,0.40)",
  roomFill: "rgba(34,197,94,0.08)",
  roomStroke: "rgba(34,197,94,0.35)",
  noteFill: "rgba(59,130,246,0.10)",
  noteStroke: "rgba(59,130,246,0.30)"
};

const ROOM_TABS = [
  { id: "MAIN", label: "MAIN" },
  { id: "ROOF", label: "ROOF" },
  { id: "LOUNGE", label: "LOUNGE" }
];

const TABLE_PRESETS = [
  { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 82, h: 82, shape: "round" },
  { seats: 6, w: 110, h: 76, shape: "rect" },
  { seats: 8, w: 128, h: 84, shape: "rect" },
  { seats: 10, w: 150, h: 90, shape: "rect" }
];

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

// --- Geometry helpers ---
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function snapAngle(p0, p1) {
  // Snap to 0/45/90/135/180...
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const ang = Math.atan2(dy, dx); // radians
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: p0.x + Math.cos(snapped) * len,
    y: p0.y + Math.sin(snapped) * len
  };
}

function simplifyPoints(points, minStep = 10) {
  // Drop points that are too close (keeps lines smoother)
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

// --- AI wiring (safe adapter) ---
async function callFloorplanAI({ restaurantId, roomId, selection, allItems, prompt }) {
  /**
   * ✅ THIS IS THE REAL “wire point”.
   * Replace this with your Base44 method.
   *
   * Common patterns in builders:
   * - base44.functions.invoke("floorplan_ai", payload)
   * - base44.ai.chat({ messages })
   * - base44.entities.AIRequest.create(...)
   */
  try {
    // 1) If Base44 has serverless/functions:
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

    // 2) If Base44 exposes ai.chat (some stacks do):
    if (base44?.ai?.chat) {
      const res = await base44.ai.chat({
        messages: [
          { role: "system", content: "You are a floor plan designer for restaurants. Output JSON only." },
          { role: "user", content: prompt }
        ]
      });
      return res;
    }

    // 3) Fallback (so it never crashes)
    return {
      ok: true,
      message:
        "AI endpoint not connected yet. Create a Base44 function named floorplan_ai and return JSON actions (add/move/rotate).",
      actions: []
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);

  const [roomId, setRoomId] = useState("MAIN");

  // World camera (NO auto shifting during add/move)
  const [cam, setCam] = useState({ x: -220, y: -120, scale: 1.15 });

  // Mode
  const [tool, setTool] = useState("select"); // select | pan | addTable | drawWall | drawRoom | addText
  const [presetIndex, setPresetIndex] = useState(1); // default 4-top

  // Toggles
  const [showGrid, setShowGrid] = useState(true);
  const [collisionGuard, setCollisionGuard] = useState(true);
  const [snapAngles, setSnapAngles] = useState(true);

  // Data
  const [rooms, setRooms] = useState(() =>
    ROOM_TABS.reduce((acc, r) => {
      acc[r.id] = {
        roomId: r.id,
        // roomBoundary is polygon points array [{x,y}...], closed polygon implied
        roomBoundary: [],
        walls: [], // {id, points:[{x,y}..], thickness, locked, z}
        items: [] // tables + notes: {id,type:'table'|'note',x,y,w,h,shape,seats,label,rotation,fill,stroke,locked,z, entityTableId?}
      };
      return acc;
    }, {})
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // {x,y, targetId, targetType}

  // Drawing temp
  const [draftPoints, setDraftPoints] = useState([]); // drawing line/room
  const [isDrawing, setIsDrawing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const current = rooms[roomId];

  // Load from base44 restaurant.floor_plan_data
  useEffect(() => {
    if (!restaurant?.floor_plan_data) return;
    try {
      const fp = restaurant.floor_plan_data;
      // Expect structure: { rooms: { MAIN:{...}, ROOF:{...}, LOUNGE:{...} }, publishedAt }
      if (fp?.rooms) {
        setRooms((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (fp.rooms[k]) {
              next[k] = {
                ...next[k],
                ...fp.rooms[k]
              };
            }
          }
          return next;
        });
      }
      // Fit once if boundary exists
      setTimeout(() => {
        const st = stageRef.current;
        if (!st) return;
        const anyBoundary =
          fp?.rooms?.[roomId]?.roomBoundary?.length ||
          fp?.rooms?.MAIN?.roomBoundary?.length ||
          fp?.rooms?.ROOF?.roomBoundary?.length ||
          fp?.rooms?.LOUNGE?.roomBoundary?.length;

        if (anyBoundary) {
          // Optional: do a gentle fit only on initial load
          // (We DO NOT do this on every add/move)
          // Keeping your camera stable is the whole point.
        }
      }, 0);
    } catch (e) {
      // Never crash
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  // Keep transformer synced
  useEffect(() => {
    const tr = transformerRef.current;
    const st = stageRef.current;
    if (!tr || !st) return;

    const nodes = selectedIds
      .map((id) => st.findOne(`#${id}`))
      .filter(Boolean);

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, roomId, rooms]);

  const allSelectableItems = useMemo(() => {
    const items = current?.items ?? [];
    const walls = current?.walls ?? [];
    return [
      ...walls.map((w) => ({ ...w, type: "wall" })),
      ...items
    ].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  }, [current]);

  const selected = useMemo(() => {
    const map = new Map(allSelectableItems.map((x) => [x.id, x]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [selectedIds, allSelectableItems]);

  // --- Safety: collision detection (tables only) ---
  function rectsOverlap(a, b, padding = 10) {
    return !(
      a.x + a.w + padding < b.x ||
      a.x > b.x + b.w + padding ||
      a.y + a.h + padding < b.y ||
      a.y > b.y + b.h + padding
    );
  }

  function wouldCollide(movingId, nextRect) {
    if (!collisionGuard) return false;
    const items = current.items || [];
    for (const it of items) {
      if (it.type !== "table") continue;
      if (it.id === movingId) continue;
      const r2 = { x: it.x, y: it.y, w: it.w, h: it.h };
      if (rectsOverlap(nextRect, r2, 12)) return true;
    }
    return false;
  }

  // --- Helpers: update room state ---
  function updateRoom(patchFn) {
    setRooms((prev) => {
      const next = { ...prev };
      next[roomId] = patchFn(next[roomId]);
      return next;
    });
  }

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
      const items = (r.items || []).map((it) =>
        ids.includes(it.id) ? { ...it, locked } : it
      );
      const walls = (r.walls || []).map((w) =>
        ids.includes(w.id) ? { ...w, locked } : w
      );
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

  // --- Mouse -> world coords ---
  function getWorldPos() {
    const st = stageRef.current;
    if (!st) return { x: 0, y: 0 };
    const p = st.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    const scale = st.scaleX();
    return {
      x: (p.x - st.x()) / scale,
      y: (p.y - st.y()) / scale
    };
  }

  // --- Add table ---
  function addTableAt(world) {
    const preset = TABLE_PRESETS[presetIndex] || TABLE_PRESETS[1];
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

  // --- Add text note (background only) ---
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
      x: world.x - 110,
      y: world.y - 26,
      w: 220,
      h: 52,
      text: "Note",
      rotation: 0,
      fill: COLORS.noteFill,
      stroke: COLORS.noteStroke,
      locked: false,
      z: baseZ,
      // Important rule for diner-side:
      reservable: false
    };

    updateRoom((r) => ({ ...r, items: [...(r.items || []), note] }));
    setSelectedIds([id]);
  }

  // --- Draw wall/room finalize ---
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
      walls: [
        ...(r.walls || []),
        {
          id,
          points,
          thickness: 10,
          locked: false,
          z: baseZ
        }
      ]
    }));
    setSelectedIds([id]);
  }

  function finalizeRoomBoundary(points) {
    updateRoom((r) => ({
      ...r,
      roomBoundary: points
    }));
  }

  // --- Right click menu ---
  function openContextMenu(evt, targetId = null) {
    evt?.evt?.preventDefault?.();
    const st = stageRef.current;
    const pos = st?.getPointerPosition();
    if (!pos) return;

    // If right-click on empty canvas, clear selection
    if (!targetId) setSelectedIds([]);

    setContextMenu({
      x: pos.x,
      y: pos.y,
      targetId
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  // --- Ask AI (contextual) ---
  async function handleAskAI(targetId) {
    closeContextMenu();

    const target =
      allSelectableItems.find((x) => x.id === targetId) ||
      (selected.length ? selected[0] : null);

    const prompt = target?.type === "table"
      ? `Design improvement for this TABLE: seats=${target.seats}, position=(${Math.round(target.x)},${Math.round(target.y)}). Suggest better placement for traffic flow and efficiency. Output JSON actions.`
      : target?.type === "wall"
      ? `Suggest improved WALL placement/shape for flow. Output JSON actions.`
      : `Suggest improvements for the floor plan layout for convenience, owner simplicity, and diner clarity. Output JSON actions.`;

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

    // Apply AI actions (safe, non-crashing)
    // Expected: { actions:[ {type:'move', id, x,y} | {type:'addTable', x,y,seats,shape} | {type:'rotate', id, rotation} ...] }
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
          items = items.map((it) =>
            it.id === a.id ? { ...it, x: a.x ?? it.x, y: a.y ?? it.y } : it
          );
          walls = walls.map((w) =>
            w.id === a.id ? { ...w, points: a.points ?? w.points } : w
          );
        }

        if (a.type === "rotate") {
          items = items.map((it) =>
            it.id === a.id ? { ...it, rotation: a.rotation ?? it.rotation } : it
          );
        }

        if (a.type === "addTable") {
          const preset = TABLE_PRESETS.find((p) => p.seats === a.seats) || TABLE_PRESETS[1];
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
          // a.points can be flat or [{x,y}]
          const pts = typeof a.points[0] === "number" ? fromFlat(a.points) : a.points;
          r.roomBoundary = pts;
        }
      }

      return { ...r, items, walls };
    });

    toast.success("AI applied improvements.");
  }

  // --- Publish ---
  async function handlePublish() {
    if (!restaurant?.id) {
      toast.error("Missing restaurant");
      return;
    }
    setIsSaving(true);
    try {
      // 1) Save floor plan data on Restaurant
      const floorPlanData = {
        rooms,
        publishedAt: new Date().toISOString(),
        version: 2
      };

      // Total seats (all rooms)
      const allTables = Object.values(rooms)
        .flatMap((r) => r.items || [])
        .filter((i) => i.type === "table");

      const totalSeats = allTables.reduce((sum, t) => sum + (t.seats || 0), 0);

      await base44.entities.Restaurant.update(restaurant.id, {
        floor_plan_data: floorPlanData,
        total_seats: totalSeats,
        available_seats: totalSeats
      });

      // 2) Upsert Table entities without “wipe then recreate”
      //    This prevents the Live Floor Plan page from going blank temporarily.
      const existing = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const existingByFpId = new Map(
        (existing || [])
          .filter((t) => t.floorplan_item_id)
          .map((t) => [t.floorplan_item_id, t])
      );

      const keepIds = new Set();

      for (const t of allTables) {
        const fpId = t.id; // stable within floor_plan_data
        const found = existingByFpId.get(fpId);

        const payload = {
          restaurant_id: restaurant.id,
          floorplan_item_id: fpId, // IMPORTANT: add this field in your Base44 Table schema
          label: `T${t.seats}`,      // or use a better label if you add one
          capacity: t.seats,
          status: "free",
          position_x: t.x,
          position_y: t.y,
          shape: t.shape,
          rotation: t.rotation || 0,
          room_id: t.room_id || roomId,
          z_index: t.z ?? 0
        };

        if (found?.id) {
          await base44.entities.Table.update(found.id, payload);
          keepIds.add(found.id);
        } else {
          const created = await base44.entities.Table.create(payload);
          keepIds.add(created?.id);
        }
      }

      // 3) Delete old tables not present anymore
      for (const old of existing || []) {
        if (!keepIds.has(old.id)) {
          // Only delete if it’s managed by floorplanner (has floorplan_item_id)
          if (old.floorplan_item_id) {
            await base44.entities.Table.delete(old.id);
          }
        }
      }

      toast.success("Published! Live floor plan updated.");
      onPublish?.(floorPlanData); // Let parent invalidate queries or refresh
    } catch (e) {
      toast.error(`Publish failed: ${String(e?.message || e)}`);
    } finally {
      setIsSaving(false);
    }
  }

  // --- Stage events ---
  function onStageMouseDown(e) {
    closeContextMenu();

    // Right click handled elsewhere
    if (e.evt?.button === 2) return;

    const clickedOnEmpty = e.target === e.target.getStage();
    const world = getWorldPos();

    if (tool === "addTable") {
      addTableAt(world);
      return;
    }

    if (tool === "addText") {
      addNoteAt(world);
      return;
    }

    if (tool === "drawWall" || tool === "drawRoom") {
      setIsDrawing(true);
      setDraftPoints((prev) => {
        const next = prev.length ? prev : [world];
        // For room tool: allow close by clicking near start point
        if (tool === "drawRoom" && next.length >= 3) {
          const start = next[0];
          if (dist(start, world) < 18) {
            // close immediately
            const cleaned = simplifyPoints(next);
            finalizeRoomBoundary(cleaned);
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
      if (clickedOnEmpty) setSelectedIds([]);
    }
  }

  function onStageMouseMove() {
    if (!isDrawing) return;
    if (!(tool === "drawWall" || tool === "drawRoom")) return;

    const world = getWorldPos();
    setDraftPoints((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      const nextPoint = snapAngles ? snapAngle(last, world) : world;
      const next = [...prev.slice(0, -1), nextPoint];
      return next;
    });
  }

  function onStageMouseUp() {
    if (!(tool === "drawWall" || tool === "drawRoom")) return;

    // For wall: finalize on mouse up if we have 2+ points
    if (tool === "drawWall" && isDrawing) {
      const pts = simplifyPoints(draftPoints);
      if (pts.length >= 2) {
        finalizeWall(pts);
      }
      setIsDrawing(false);
      setDraftPoints([]);
    }

    // For room: keep drawing until user closes near start point
    if (tool === "drawRoom" && isDrawing) {
      // do nothing here; closure happens on click near start point
    }
  }

  // --- Dragging items (NO camera shifting) ---
  function updateItem(id, patch) {
    updateRoom((r) => {
      const items = (r.items || []).map((it) => (it.id === id ? { ...it, ...patch } : it));
      return { ...r, items };
    });
  }

  function updateWall(id, patch) {
    updateRoom((r) => {
      const walls = (r.walls || []).map((w) => (w.id === id ? { ...w, ...patch } : w));
      return { ...r, walls };
    });
  }

  // --- Grid rendering ---
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

  // --- Chair nubs like SevenRooms ---
  function ChairNubs({ x, y, w, h, seats, rotation }) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(w, h) / 2 + 12;
    const count = Math.max(2, Math.min(12, seats || 4));

    const nubs = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const nx = cx + Math.cos(a) * r;
      const ny = cy + Math.sin(a) * r;
      nubs.push(
        <Circle
          key={i}
          x={nx}
          y={ny}
          radius={5}
          fill={"rgba(255,255,255,0.18)"}
          stroke={"rgba(255,255,255,0.24)"}
          strokeWidth={1}
          listening={false}
        />
      );
    }

    return (
      <Group rotation={rotation} offsetX={w / 2} offsetY={h / 2} x={cx} y={cy} listening={false}>
        {nubs}
      </Group>
    );
  }

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* Top controls */}
      <Card className="p-4 border-0" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={tool === "select" ? "default" : "outline"}
              onClick={() => setTool("select")}
              className="rounded-full"
            >
              <MousePointer2 className="w-4 h-4 mr-2" />
              Select
            </Button>

            <Button
              variant={tool === "pan" ? "default" : "outline"}
              onClick={() => setTool("pan")}
              className="rounded-full"
            >
              <Hand className="w-4 h-4 mr-2" />
              Pan
            </Button>

            <Button
              variant={tool === "addTable" ? "default" : "outline"}
              onClick={() => setTool("addTable")}
              className="rounded-full"
            >
              <Square className="w-4 h-4 mr-2" />
              Add Table
            </Button>

            <div className="flex items-center gap-2 ml-2">
              {TABLE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPresetIndex(idx);
                    setTool("addTable");
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition
                    ${presetIndex === idx ? "bg-white/15 border-white/25 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                  title={`${p.seats}-top`}
                >
                  {p.seats}
                </button>
              ))}
            </div>

            <Button
              variant={tool === "drawWall" ? "default" : "outline"}
              onClick={() => {
                setTool("drawWall");
                setDraftPoints([]);
                setIsDrawing(false);
              }}
              className="rounded-full"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Draw Wall
            </Button>

            <Button
              variant={tool === "drawRoom" ? "default" : "outline"}
              onClick={() => {
                setTool("drawRoom");
                setDraftPoints([]);
                setIsDrawing(false);
              }}
              className="rounded-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Room Boundary
            </Button>

            <Button
              variant={tool === "addText" ? "default" : "outline"}
              onClick={() => setTool("addText")}
              className="rounded-full"
            >
              <Type className="w-4 h-4 mr-2" />
              Note
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm text-white/80">
            <label className="flex items-center gap-2">
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              Grid
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={collisionGuard} onCheckedChange={setCollisionGuard} />
              No-overlap guard
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={snapAngles} onCheckedChange={setSnapAngles} />
              Auto-straighten
            </label>

            <Button
              onClick={handlePublish}
              disabled={isSaving}
              className="rounded-full bg-white text-black hover:bg-white/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-white/55">
          Tip: Right-click any table/wall/note → “Ask AI”, Lock, Duplicate, Z-index controls.
          Room Boundary closes when you click near the first point.
        </div>
      </Card>

      {/* Canvas */}
      <Card className="border-0 overflow-hidden" style={{ background: COLORS.bg }}>
        <div className="relative" style={{ height: 680 }}>
          <Stage
            ref={stageRef}
            width={window.innerWidth ? Math.min(window.innerWidth - 64, 1180) : 1180}
            height={680}
            x={cam.x}
            y={cam.y}
            scaleX={cam.scale}
            scaleY={cam.scale}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            onContextMenu={(e) => openContextMenu(e, null)}
            draggable={tool === "pan"}
            onDragEnd={(e) => {
              // Only pan when in pan tool (prevents the annoying shifting)
              if (tool !== "pan") return;
              setCam((c) => ({ ...c, x: e.target.x(), y: e.target.y() }));
            }}
          >
            <Layer>
              {/* Grid */}
              {gridLines.map((g, i) => (
                <Line
                  key={i}
                  points={g.points}
                  stroke={g.stroke}
                  strokeWidth={g.width}
                  listening={false}
                />
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
                    x={current.roomBoundary[0].x + 8}
                    y={current.roomBoundary[0].y + 8}
                    text={roomId}
                    fill={COLORS.subtext}
                    fontSize={14}
                    listening={false}
                  />
                </>
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
                      name="wall"
                      points={toFlat(w.points || [])}
                      stroke={COLORS.wall}
                      strokeWidth={w.thickness || 10}
                      lineCap="round"
                      lineJoin="round"
                      opacity={isSelected ? 0.9 : 0.65}
                      shadowBlur={isSelected ? 10 : 0}
                      shadowColor={COLORS.accent}
                      draggable={!w.locked && tool === "select"}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        if (e.evt?.button === 2) {
                          openContextMenu(e, w.id);
                          return;
                        }
                        if (e.evt?.shiftKey) {
                          setSelectedIds((prev) =>
                            prev.includes(w.id) ? prev : [...prev, w.id]
                          );
                        } else {
                          setSelectedIds([w.id]);
                        }
                      }}
                      onContextMenu={(e) => openContextMenu(e, w.id)}
                      onDragMove={(e) => {
                        // drag entire wall by delta (Konva gives position; easier is to compute offset via drag)
                        const node = e.target;
                        const dx = node.x();
                        const dy = node.y();

                        const next = (w.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy }));
                        // reset node to 0 (we bake delta into points)
                        node.x(0);
                        node.y(0);

                        updateWall(w.id, { points: next });
                      }}
                    />
                  );
                })}

              {/* Items (tables + notes) */}
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
                            openContextMenu(e, it.id);
                            return;
                          }
                          if (e.evt?.shiftKey) {
                            setSelectedIds((prev) => (prev.includes(it.id) ? prev : [...prev, it.id]));
                          } else {
                            setSelectedIds([it.id]);
                          }
                        }}
                        onContextMenu={(e) => openContextMenu(e, it.id)}
                      >
                        <Rect
                          width={it.w}
                          height={it.h}
                          fill={it.fill || COLORS.noteFill}
                          stroke={isSelected ? COLORS.accent : it.stroke || COLORS.noteStroke}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          cornerRadius={12}
                          shadowBlur={isSelected ? 12 : 0}
                          shadowColor={COLORS.accent}
                        />
                        <Text
                          x={14}
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
                  const tableLabel = it.label || `${it.seats || ""}`;

                  const baseRect = { x: it.x, y: it.y, w: it.w, h: it.h };
                  const colliding =
                    it.type === "table" &&
                    collisionGuard &&
                    wouldCollide(it.id, baseRect);

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
                          openContextMenu(e, it.id);
                          return;
                        }
                        if (e.evt?.shiftKey) {
                          setSelectedIds((prev) => (prev.includes(it.id) ? prev : [...prev, it.id]));
                        } else {
                          setSelectedIds([it.id]);
                        }
                      }}
                      onContextMenu={(e) => openContextMenu(e, it.id)}
                      onDragMove={(e) => {
                        const node = e.target;
                        const nx = node.x();
                        const ny = node.y();

                        const nextRect = { x: nx, y: ny, w: it.w, h: it.h };
                        if (collisionGuard && wouldCollide(it.id, nextRect)) {
                          // keep dragging visual, but don’t commit (prevents overlap)
                          return;
                        }
                        updateItem(it.id, { x: nx, y: ny });
                      }}
                      onDragEnd={(e) => {
                        // commit final values; do not shift camera
                        const node = e.target;
                        updateItem(it.id, { x: node.x(), y: node.y() });
                      }}
                    >
                      {/* Chair nubs (round only) */}
                      {it.shape === "round" && (
                        <ChairNubs x={0} y={0} w={it.w} h={it.h} seats={it.seats} rotation={0} />
                      )}

                      {/* Table shape */}
                      {it.shape === "round" ? (
                        <Circle
                          x={it.w / 2}
                          y={it.h / 2}
                          radius={it.w / 2}
                          fill={it.fill || COLORS.tableFill}
                          stroke={
                            colliding
                              ? COLORS.danger
                              : isSelected
                              ? COLORS.accent
                              : it.stroke || COLORS.tableStroke
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
                            colliding
                              ? COLORS.danger
                              : isSelected
                              ? COLORS.accent
                              : it.stroke || COLORS.tableStroke
                          }
                          strokeWidth={isSelected ? 3 : 2}
                          cornerRadius={14}
                          shadowBlur={isSelected ? 14 : 0}
                          shadowColor={COLORS.accent}
                        />
                      )}

                      {/* Seats label (big, like SevenRooms) */}
                      <Text
                        x={0}
                        y={0}
                        width={it.w}
                        height={it.h}
                        align="center"
                        verticalAlign="middle"
                        text={tableLabel}
                        fill={COLORS.text}
                        fontSize={18}
                        fontStyle="700"
                        listening={false}
                      />

                      {/* Small badge (locked) */}
                      {locked && (
                        <Text
                          x={it.w - 18}
                          y={6}
                          text="🔒"
                          fontSize={14}
                          opacity={0.8}
                          listening={false}
                        />
                      )}
                    </Group>
                  );
                })}

              {/* Draft drawing preview */}
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

          {/* Bottom-right Room Tabs */}
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
                  roomId === t.id
                    ? "bg-white/16 text-white"
                    : "text-white/70 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Context menu */}
          {contextMenu && (
            <div
              className="absolute z-50"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onMouseLeave={closeContextMenu}
            >
              <div className="w-60 rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 text-white/80 text-xs border-b border-white/10 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
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
                    const anyLocked = ids.some((id) => {
                      const t = allSelectableItems.find((x) => x.id === id);
                      return !!t?.locked;
                    });
                    setLocked(ids, !anyLocked);
                    closeContextMenu();
                  }}
                >
                  {(() => {
                    const ids = contextMenu.targetId ? [contextMenu.targetId] : selectedIds;
                    const anyLocked = ids.some((id) => {
                      const t = allSelectableItems.find((x) => x.id === id);
                      return !!t?.locked;
                    });
                    return anyLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />;
                  })()}
                  Lock / Unlock
                </button>

                <button
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    const id = contextMenu.targetId;
                    if (!id) return closeContextMenu();

                    const t = allSelectableItems.find((x) => x.id === id);
                    if (!t) return closeContextMenu();

                    // duplicate item/table/note; walls duplicate too
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
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Simple selected edit panel */}
      {selected.length === 1 && selected[0]?.type === "note" && (
        <Card className="p-4 border-0" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
          <div className="flex items-center gap-3 text-white">
            <Wand2 className="w-4 h-4 text-blue-300" />
            <div className="font-semibold">Edit Note</div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              value={selected[0].text || ""}
              onChange={(e) => updateItem(selected[0].id, { text: e.target.value })}
              placeholder="Type your label (background only)"
            />
          </div>
          <div className="mt-2 text-xs text-white/60">
            Notes are for the owner only — diners should only interact with tables.
          </div>
        </Card>
      )}

      <Card className="p-4 border-0" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-white/80 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>
              Tables:{" "}
              {Object.values(rooms)
                .flatMap((r) => r.items || [])
                .filter((x) => x.type === "table").length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/60">Total seats:</span>
            <span className="text-white font-semibold">
              {Object.values(rooms)
                .flatMap((r) => r.items || [])
                .filter((x) => x.type === "table")
                .reduce((s, t) => s + (t.seats || 0), 0)}
            </span>
          </div>

          <div className="text-xs text-white/50">
            If “Publish” fails: add Table schema fields <b>floorplan_item_id</b> (text), <b>z_index</b> (number), <b>room_id</b> (text).
          </div>
        </div>
      </Card>
    </div>
  );
}

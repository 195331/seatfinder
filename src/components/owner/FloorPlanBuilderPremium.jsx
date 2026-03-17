import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MousePointer2, Hand, Square, Pencil, Home, Type,
  BringToFront, SendToBack, Lock, Copy, Trash2,
  Save, ZoomIn, ZoomOut, Move, Map
} from "lucide-react";

const CANVAS_W = 2400, CANVAS_H = 1700;
const GRID = 40;

const COLORS = {
  canvasBg: "#0b1220", gridMajor: "rgba(255,255,255,0.06)", gridMinor: "rgba(255,255,255,0.03)",
  text: "rgba(255,255,255,0.92)", subtext: "rgba(255,255,255,0.60)", accent: "#22c55e",
  tableFill: "rgba(255,255,255,0.08)", tableStroke: "rgba(255,255,255,0.18)",
  wall: "rgba(255,255,255,0.42)", roomFill: "rgba(34,197,94,0.10)", roomStroke: "rgba(34,197,94,0.38)",
  noteFill: "rgba(59,130,246,0.10)", noteStroke: "rgba(59,130,246,0.35)", danger: "#ef4444",
  tableFree: "rgba(16,185,129,0.25)", tableOccupied: "rgba(245,158,11,0.25)",
  tableReserved: "rgba(59,130,246,0.25)", tableStrokeFree: "rgba(16,185,129,0.6)",
  tableStrokeOccupied: "rgba(245,158,11,0.6)", tableStrokeReserved: "rgba(59,130,246,0.6)",
  collisionFill: "rgba(239,68,68,0.35)", collisionStroke: "#ef4444",
  boxSelectFill: "rgba(34,197,94,0.08)", boxSelectStroke: "rgba(34,197,94,0.6)"
};

// Glassmorphic dark toolbar tokens
const UI = {
  bg: "rgba(0,0,0,0.65)",
  border: "rgba(255,255,255,0.1)",
  text: "rgba(255,255,255,0.9)",
  subtext: "rgba(255,255,255,0.45)",
  pillOn: "#22c55e",
  pillOnText: "white",
  pillOff: "rgba(255,255,255,0.07)",
  pillOffText: "rgba(255,255,255,0.65)",
  pillBorder: "rgba(255,255,255,0.12)"
};

const ZONE_TYPES = [
  { id: 'quiet',   label: '🤫 Quiet',   fill: 'rgba(139,92,246,0.12)', stroke: 'rgba(139,92,246,0.45)' },
  { id: 'bar',     label: '🍷 Bar',     fill: 'rgba(239,68,68,0.12)',  stroke: 'rgba(239,68,68,0.45)'  },
  { id: 'family',  label: '👨‍👩‍👧 Family', fill: 'rgba(34,197,94,0.12)', stroke: 'rgba(34,197,94,0.45)'  },
  { id: 'outdoor', label: '🌳 Outdoor', fill: 'rgba(59,130,246,0.12)', stroke: 'rgba(59,130,246,0.45)' },
  { id: 'vip',     label: '⭐ VIP',     fill: 'rgba(234,179,8,0.12)',  stroke: 'rgba(234,179,8,0.45)'  }
];

const TABLE_PRESETS = [
  { seats: 1, w: 56, h: 56, shape: "round" }, { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 86, h: 86, shape: "round" }, { seats: 6, w: 112, h: 76, shape: "rect" },
  { seats: 8, w: 132, h: 84, shape: "rect"  }, { seats: 10, w: 154, h: 92, shape: "rect" }
];

const ROOM_TABS = [{ id: "MAIN" }, { id: "ROOF" }, { id: "LOUNGE" }];
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const snapToGrid = (v) => Math.round(v / GRID) * GRID;
const snapRot = (deg) => Math.round(deg / 45) * 45;

function snapAngle(p0, p1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const ang = Math.atan2(dy, dx), step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: p0.x + Math.cos(snapped) * len, y: p0.y + Math.sin(snapped) * len };
}

function aabbOverlap(a, b) {
  const pad = 4;
  return !(
    a.x + a.w - pad <= b.x + pad || b.x + b.w - pad <= a.x + pad ||
    a.y + a.h - pad <= b.y + pad || b.y + b.h - pad <= a.y + pad
  );
}

function drawScene(ctx, W, H, cam, room, opts) {
  const {
    showGrid, showZones, showTableStatus, tableStatusMap,
    selectedIds, draftPoints, tool, rectDraft, zoneDraft,
    selectedZoneType, roomId, boxSelect, collisionIds
  } = opts;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.scale, cam.scale);

  // Grid
  if (showGrid) {
    for (let x = 0; x <= CANVAS_W; x += 40) {
      ctx.strokeStyle = x % 200 === 0 ? COLORS.gridMajor : COLORS.gridMinor;
      ctx.lineWidth = x % 200 === 0 ? 1.2 : 0.6;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += 40) {
      ctx.strokeStyle = y % 200 === 0 ? COLORS.gridMajor : COLORS.gridMinor;
      ctx.lineWidth = y % 200 === 0 ? 1.2 : 0.6;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }
  }

  // Room boundary
  const boundary = room?.roomBoundary || [];
  if (boundary.length >= 3) {
    ctx.beginPath(); ctx.moveTo(boundary[0].x, boundary[0].y);
    boundary.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = COLORS.roomFill; ctx.fill();
    ctx.strokeStyle = COLORS.roomStroke; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.subtext; ctx.font = '14px sans-serif';
    ctx.fillText(roomId, boundary[0].x + 10, boundary[0].y + 20);
  }

  // Room rect draft
  if (rectDraft) {
    const x = Math.min(rectDraft.x0, rectDraft.x1), y = Math.min(rectDraft.y0, rectDraft.y1);
    const w = Math.abs(rectDraft.x1 - rectDraft.x0), h = Math.abs(rectDraft.y1 - rectDraft.y0);
    ctx.strokeStyle = COLORS.roomStroke; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  // Zone draft preview
  if (zoneDraft) {
    const zt = ZONE_TYPES.find(z => z.id === selectedZoneType) || ZONE_TYPES[0];
    const x = Math.min(zoneDraft.x0, zoneDraft.x1), y = Math.min(zoneDraft.y0, zoneDraft.y1);
    const w = Math.abs(zoneDraft.x1 - zoneDraft.x0), h = Math.abs(zoneDraft.y1 - zoneDraft.y0);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = zt.fill; ctx.strokeStyle = zt.stroke;
    ctx.lineWidth = 2; ctx.setLineDash([12, 8]);
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 16); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.text; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(zt.label || '', x + 12, y + 28);
  }

  // Zones
  if (showZones) {
    (room?.zones || []).forEach(zone => {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = zone.fill;
      ctx.strokeStyle = selectedIds.includes(zone.id) ? COLORS.accent : zone.stroke;
      ctx.lineWidth = selectedIds.includes(zone.id) ? 3 : 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(zone.x, zone.y, zone.w, zone.h, 16);
      else ctx.rect(zone.x, zone.y, zone.w, zone.h);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.text; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(zone.label || '', zone.x + 12, zone.y + 28);
      ctx.restore();
    });
  }

  // Walls
  (room?.walls || []).forEach(w => {
    if (!w.points?.length) return;
    ctx.strokeStyle = COLORS.wall; ctx.lineWidth = w.thickness || 10;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = selectedIds.includes(w.id) ? 0.92 : 0.66;
    if (selectedIds.includes(w.id)) { ctx.shadowBlur = 10; ctx.shadowColor = COLORS.accent; }
    ctx.beginPath(); ctx.moveTo(w.points[0].x, w.points[0].y);
    w.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  });

  // Items (tables + notes)
  (room?.items || []).sort((a, b) => (a.z || 0) - (b.z || 0)).forEach(it => {
    const isSelected = selectedIds.includes(it.id);
    const isColliding = (collisionIds || []).includes(it.id);
    ctx.save();
    ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
    ctx.rotate(((it.rotation || 0) * Math.PI) / 180);
    ctx.translate(-it.w / 2, -it.h / 2);

    if (it.type === 'note') {
      ctx.fillStyle = it.fill || COLORS.noteFill;
      ctx.strokeStyle = isSelected ? COLORS.accent : (it.stroke || COLORS.noteStroke);
      ctx.lineWidth = isSelected ? 2.5 : 1.6;
      if (isSelected) { ctx.shadowBlur = 14; ctx.shadowColor = COLORS.accent; }
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, it.w, it.h, 14); else ctx.rect(0, 0, it.w, it.h);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.text; ctx.font = '600 14px sans-serif';
      ctx.fillText(it.text || 'Note', 14, 22);
    } else if (it.type === 'table') {
      const liveStatus = showTableStatus ? tableStatusMap[it.id] : null;
      const fill = isColliding
        ? COLORS.collisionFill
        : liveStatus === 'occupied' ? COLORS.tableOccupied
        : liveStatus === 'reserved' ? COLORS.tableReserved
        : liveStatus === 'free' ? COLORS.tableFree
        : it.fill || COLORS.tableFill;
      const stroke = isColliding
        ? COLORS.collisionStroke
        : liveStatus === 'occupied' ? COLORS.tableStrokeOccupied
        : liveStatus === 'reserved' ? COLORS.tableStrokeReserved
        : liveStatus === 'free' ? COLORS.tableStrokeFree
        : it.stroke || COLORS.tableStroke;

      ctx.fillStyle = fill;
      ctx.strokeStyle = isSelected ? (isColliding ? COLORS.danger : COLORS.accent) : stroke;
      ctx.lineWidth = isSelected ? 3 : 2;
      if (isSelected) { ctx.shadowBlur = 16; ctx.shadowColor = isColliding ? COLORS.danger : COLORS.accent; }
      ctx.beginPath();
      if (it.shape === 'round') ctx.arc(it.w / 2, it.h / 2, it.w / 2, 0, Math.PI * 2);
      else { if (ctx.roundRect) ctx.roundRect(0, 0, it.w, it.h, 12); else ctx.rect(0, 0, it.w, it.h); }
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.text; ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = it.table_number != null ? `T${it.table_number}` : (it.label || `T${it.seats}`);
      ctx.fillText(label, it.w / 2, it.h / 2 - 7);
      ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${it.seats || 4} seats`, it.w / 2, it.h / 2 + 8);
      if (it.locked) { ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('🔒', it.w - 6, 14); }
    }
    ctx.restore();
  });

  // Wall draft
  if ((tool === 'drawWall' || tool === 'drawRoom') && draftPoints.length >= 2) {
    ctx.strokeStyle = tool === 'drawRoom' ? COLORS.roomStroke : COLORS.wall;
    ctx.lineWidth = tool === 'drawRoom' ? 2 : 10;
    ctx.lineCap = 'round'; ctx.setLineDash(tool === 'drawRoom' ? [10, 8] : []);
    ctx.beginPath(); ctx.moveTo(draftPoints[0].x, draftPoints[0].y);
    draftPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Box selection overlay
  if (boxSelect) {
    const x = Math.min(boxSelect.x0, boxSelect.x1), y = Math.min(boxSelect.y0, boxSelect.y1);
    const w = Math.abs(boxSelect.x1 - boxSelect.x0), h = Math.abs(boxSelect.y1 - boxSelect.y0);
    ctx.fillStyle = COLORS.boxSelectFill;
    ctx.strokeStyle = COLORS.boxSelectStroke;
    ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export default function FloorPlanBuilderPremium({ restaurant, onPublish }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [roomId, setRoomId] = useState("MAIN");
  const [cam, setCam] = useState({ x: -260, y: -140, scale: 1.18 });
  const [tool, setTool] = useState("select");
  const [presetIndex, setPresetIndex] = useState(2);
  const [selectedZoneType, setSelectedZoneType] = useState('quiet');
  const [showGrid, setShowGrid] = useState(true);
  const [collisionGuard, setCollisionGuard] = useState(true);
  const [snapGrid, setSnapGrid] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showTableStatus, setShowTableStatus] = useState(true);
  const [rooms, setRooms] = useState(() =>
    ROOM_TABS.reduce((acc, r) => {
      acc[r.id] = { roomId: r.id, roomBoundary: [], walls: [], items: [], zones: [] };
      return acc;
    }, {})
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectDraft, setRectDraft] = useState(null);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [boxSelect, setBoxSelect] = useState(null);
  const [collisionIds, setCollisionIds] = useState([]);
  const [noteEdit, setNoteEdit] = useState({ id: null, text: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1180, h: 690 });

  // Refs for pan & drag (no re-render needed)
  const spaceDown = useRef(false);
  const panState = useRef(null);   // { startX, startY, origCam }
  const dragState = useRef(null);  // { id, startX, startY, originals: {id: {x,y}} }
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const { data: liveTables = [] } = useQuery({
    queryKey: ['liveTables', restaurant?.id],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurant.id }),
    enabled: !!restaurant?.id && showTableStatus,
    refetchInterval: 15000
  });

  const tableStatusMap = useMemo(() => {
    const map = {};
    for (const t of (Array.isArray(liveTables) ? liveTables : [])) {
      if (t?.floorplan_item_id) map[t.floorplan_item_id] = t.status;
    }
    return map;
  }, [liveTables]);

  const current = rooms[roomId];

  // Load saved floor plan
  useEffect(() => {
    if (!restaurant?.floor_plan_data?.rooms) return;
    const fp = restaurant.floor_plan_data;
    setRooms(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (fp.rooms[k]) next[k] = { ...next[k], ...fp.rooms[k] };
      }
      return next;
    });
  }, [restaurant?.id]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: Math.min(el.offsetWidth - 4, 1180), h: 690 });
    });
    ro.observe(el);
    setCanvasSize({ w: Math.min(el.offsetWidth - 4, 1180), h: 690 });
    return () => ro.disconnect();
  }, []);

  // Keyboard: spacebar pan + Delete
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.matches('input,textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); spaceDown.current = true; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.length > 0) {
        setRooms(prev => {
          const next = { ...prev };
          const rid = roomIdRef.current;
          const ids = selectedIdsRef.current;
          next[rid] = {
            ...next[rid],
            items: (next[rid].items || []).filter(it => !ids.includes(it.id)),
            walls: (next[rid].walls || []).filter(w => !ids.includes(w.id)),
            zones: (next[rid].zones || []).filter(z => !ids.includes(z.id))
          };
          return next;
        });
        setSelectedIds([]);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    canvas.style.width = canvasSize.w + 'px';
    canvas.style.height = canvasSize.h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawScene(ctx, canvasSize.w, canvasSize.h, cam, current, {
      showGrid, showZones, showTableStatus, tableStatusMap, selectedIds,
      draftPoints, tool, rectDraft, zoneDraft, selectedZoneType,
      roomId, boxSelect, collisionIds
    });
  }, [cam, current, showGrid, showZones, showTableStatus, tableStatusMap,
      selectedIds, draftPoints, tool, rectDraft, zoneDraft, selectedZoneType,
      roomId, boxSelect, collisionIds, canvasSize]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function updateRoom(patchFn) {
    setRooms(prev => {
      const next = { ...prev };
      next[roomId] = patchFn(next[roomId]);
      return next;
    });
  }
  function getWorldPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left - cam.x) / cam.scale, y: (e.clientY - rect.top - cam.y) / cam.scale };
  }
  function clampScale(s) { return Math.max(0.35, Math.min(2.4, s)); }

  function hitTestItem(world) {
    const items = current?.items || [];
    return [...items].reverse().find(it =>
      (it.type === 'table' || it.type === 'note') &&
      world.x >= it.x && world.x <= it.x + it.w &&
      world.y >= it.y && world.y <= it.y + it.h
    );
  }

  function addTableAt(world) {
    const preset = TABLE_PRESETS[presetIndex] || TABLE_PRESETS[2];
    const id = uid();
    const x = snapGrid ? snapToGrid(world.x - preset.w / 2) : world.x - preset.w / 2;
    const y = snapGrid ? snapToGrid(world.y - preset.h / 2) : world.y - preset.h / 2;
    const table = { id, type: "table", x, y, w: preset.w, h: preset.h, shape: preset.shape, seats: preset.seats, label: `${preset.seats}`, rotation: 0, fill: COLORS.tableFill, stroke: COLORS.tableStroke, locked: false, z: 0 };
    updateRoom(r => ({ ...r, items: [...(r.items || []), table] }));
    setSelectedIds([id]);
  }

  function addNoteAt(world) {
    const id = uid();
    const note = { id, type: "note", x: world.x - 120, y: world.y - 28, w: 240, h: 56, text: "Note", rotation: 0, fill: COLORS.noteFill, stroke: COLORS.noteStroke, locked: false, z: 0 };
    updateRoom(r => ({ ...r, items: [...(r.items || []), note] }));
    setSelectedIds([id]); setNoteEdit({ id, text: note.text });
  }

  function updateItem(id, patch) {
    updateRoom(r => ({ ...r, items: (r.items || []).map(it => it.id === id ? { ...it, ...patch } : it) }));
  }

  function deleteIds(ids) {
    updateRoom(r => ({
      ...r,
      items: (r.items || []).filter(it => !ids.includes(it.id)),
      walls: (r.walls || []).filter(w => !ids.includes(w.id)),
      zones: (r.zones || []).filter(z => !ids.includes(z.id))
    }));
    setSelectedIds([]);
  }

  function bumpZ(ids, delta) {
    updateRoom(r => ({ ...r, items: (r.items || []).map(it => ids.includes(it.id) ? { ...it, z: (it.z || 0) + delta } : it) }));
  }

  function setLocked(ids, locked) {
    updateRoom(r => ({ ...r, items: (r.items || []).map(it => ids.includes(it.id) ? { ...it, locked } : it) }));
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  function onMouseDown(e) {
    setContextMenu(null);

    // Middle-click OR spacebar+left = pan
    if (e.button === 1 || (e.button === 0 && spaceDown.current) || tool === 'pan') {
      e.preventDefault();
      panState.current = { startX: e.clientX, startY: e.clientY, origCam: { ...cam } };
      return;
    }
    if (e.button !== 0) return;

    const world = getWorldPos(e);

    if (tool === 'addTable') { addTableAt(world); return; }
    if (tool === 'addText')  { addNoteAt(world); return; }

    if (tool === 'addZone') {
      setZoneDraft({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
      setIsDrawing(true);
      return;
    }
    if (tool === 'drawRoomRect') {
      setRectDraft({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
      setIsDrawing(true);
      return;
    }
    if (tool === 'drawWall' || tool === 'drawRoom') {
      setIsDrawing(true);
      setDraftPoints(prev => {
        const next = prev.length ? prev : [world];
        if (tool === 'drawRoom' && next.length >= 3 && dist(next[0], world) < 18) {
          updateRoom(r => ({ ...r, roomBoundary: next }));
          setIsDrawing(false); return [];
        }
        return [...next, world];
      });
      return;
    }

    if (tool === 'select') {
      const hit = hitTestItem(world);
      if (hit) {
        let newSelected;
        if (e.shiftKey) {
          newSelected = selectedIds.includes(hit.id)
            ? selectedIds.filter(id => id !== hit.id)
            : [...selectedIds, hit.id];
        } else if (selectedIds.includes(hit.id)) {
          newSelected = selectedIds; // keep multi-select, drag all
        } else {
          newSelected = [hit.id];
        }
        setSelectedIds(newSelected);

        // Capture original positions for all items being dragged
        const idsForDrag = newSelected.includes(hit.id) ? newSelected : [hit.id];
        const originals = {};
        for (const id of idsForDrag) {
          const it = (current?.items || []).find(i => i.id === id);
          if (it) originals[id] = { x: it.x, y: it.y };
        }
        dragState.current = { id: hit.id, startX: world.x, startY: world.y, originals };
      } else {
        // Start box-select on empty canvas
        setSelectedIds([]);
        setBoxSelect({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
      }
    }
  }

  function onMouseMove(e) {
    // Pan
    if (panState.current) {
      const { startX, startY, origCam } = panState.current;
      setCam({ ...origCam, x: origCam.x + (e.clientX - startX), y: origCam.y + (e.clientY - startY) });
      return;
    }

    const world = getWorldPos(e);

    // Drawing tools
    if (isDrawing) {
      if (tool === 'drawRoomRect') { setRectDraft(r => r ? { ...r, x1: world.x, y1: world.y } : r); return; }
      if (tool === 'addZone')      { setZoneDraft(r => r ? { ...r, x1: world.x, y1: world.y } : r); return; }
      if (tool === 'drawWall' || tool === 'drawRoom') {
        setDraftPoints(prev => {
          if (!prev.length) return prev;
          const p = snapAngle(prev[prev.length - 1], world);
          return [...prev.slice(0, -1), p];
        });
        return;
      }
    }

    // Box select
    if (boxSelect && e.buttons === 1) {
      setBoxSelect(bs => bs ? { ...bs, x1: world.x, y1: world.y } : bs);
      return;
    }

    // Item drag (multi-move)
    if (dragState.current && tool === 'select' && e.buttons === 1) {
      const { startX, startY, originals } = dragState.current;
      const dx = world.x - startX;
      const dy = world.y - startY;
      const idsToMove = Object.keys(originals);

      setRooms(prev => {
        const next = { ...prev };
        const room = { ...next[roomId] };
        room.items = (room.items || []).map(it => {
          if (!idsToMove.includes(it.id) || it.locked) return it;
          const orig = originals[it.id];
          return { ...it, x: orig.x + dx, y: orig.y + dy };
        });
        next[roomId] = room;
        return next;
      });

      // Live collision highlight (uses originals + delta vs. static items)
      if (collisionGuard && dragState.current) {
        const { id } = dragState.current;
        const movedItem = (current?.items || []).find(i => i.id === id);
        if (movedItem) {
          const newPos = { x: (originals[id]?.x ?? movedItem.x) + dx, y: (originals[id]?.y ?? movedItem.y) + dy, w: movedItem.w, h: movedItem.h };
          const others = (current?.items || []).filter(i => !idsToMove.includes(i.id) && i.type === 'table');
          const clash = others.some(it => aabbOverlap(newPos, it));
          setCollisionIds(clash ? [id] : []);
        }
      }
    }
  }

  function onMouseUp(e) {
    panState.current = null;

    // Box-select finish
    if (boxSelect) {
      const minX = Math.min(boxSelect.x0, boxSelect.x1), maxX = Math.max(boxSelect.x0, boxSelect.x1);
      const minY = Math.min(boxSelect.y0, boxSelect.y1), maxY = Math.max(boxSelect.y0, boxSelect.y1);
      if (maxX - minX > 5 && maxY - minY > 5) {
        const inBox = (current?.items || [])
          .filter(it => it.x >= minX && it.x + it.w <= maxX && it.y >= minY && it.y + it.h <= maxY)
          .map(it => it.id);
        if (inBox.length) setSelectedIds(inBox);
      }
      setBoxSelect(null);
      return;
    }

    // Zone draw finish
    if (isDrawing && tool === 'addZone' && zoneDraft) {
      const { x0, y0, x1, y1 } = zoneDraft;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      if (maxX - minX > 30 && maxY - minY > 30) {
        const zt = ZONE_TYPES.find(z => z.id === selectedZoneType) || ZONE_TYPES[0];
        const id = uid();
        updateRoom(r => ({
          ...r,
          zones: [...(r.zones || []), {
            id, type: "zone", zoneType: zt.id,
            x: minX, y: minY, w: maxX - minX, h: maxY - minY,
            label: zt.label, fill: zt.fill, stroke: zt.stroke, locked: false, z: -1
          }]
        }));
        setSelectedIds([id]);
      }
      setZoneDraft(null); setIsDrawing(false);
      return;
    }

    // Drag end: snap to grid + collision snap-back
    if (dragState.current) {
      const { originals } = dragState.current;
      const idsToMove = Object.keys(originals);

      setRooms(prev => {
        const next = { ...prev };
        const room = { ...next[roomId] };
        let snapped = (room.items || []).map(it => {
          if (!idsToMove.includes(it.id) || it.locked) return it;
          return snapGrid
            ? { ...it, x: snapToGrid(it.x), y: snapToGrid(it.y) }
            : it;
        });

        // Collision snap-back
        if (collisionGuard) {
          const collides = idsToMove.some(mid => {
            const m = snapped.find(i => i.id === mid);
            if (!m) return false;
            return snapped.filter(i => i.id !== mid && i.type === 'table').some(other => aabbOverlap(m, other));
          });
          if (collides) {
            snapped = (room.items || []).map(it => {
              if (!idsToMove.includes(it.id)) return it;
              const orig = originals[it.id];
              return orig ? { ...it, x: orig.x, y: orig.y } : it;
            });
            toast.error("Can't place here — overlaps another table.");
          }
        }

        room.items = snapped;
        next[roomId] = room;
        return next;
      });

      setCollisionIds([]);
      dragState.current = null;
      return;
    }

    if (!isDrawing) return;

    if (tool === 'drawRoomRect' && rectDraft) {
      const { x0, y0, x1, y1 } = rectDraft;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      if (maxX - minX > 40 && maxY - minY > 40) {
        updateRoom(r => ({ ...r, roomBoundary: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }] }));
      }
      setRectDraft(null); setIsDrawing(false);
      return;
    }
    if (tool === 'drawWall') {
      if (draftPoints.length >= 2) {
        updateRoom(r => ({ ...r, walls: [...(r.walls || []), { id: uid(), points: draftPoints, thickness: 10, locked: false, z: 0 }] }));
      }
      setDraftPoints([]); setIsDrawing(false);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const oldScale = cam.scale, newScale = clampScale(oldScale * factor);
    setCam({
      x: pointer.x - (pointer.x - cam.x) / oldScale * newScale,
      y: pointer.y - (pointer.y - cam.y) / oldScale * newScale,
      scale: newScale
    });
  }

  function onContextMenu(e) {
    e.preventDefault();
    const world = getWorldPos(e);
    const hit = hitTestItem(world);
    const rect = canvasRef.current.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, targetId: hit?.id || null });
    if (hit) setSelectedIds([hit.id]);
  }

  async function handlePublish() {
    if (!restaurant?.id) { toast.error("Missing restaurant"); return; }
    setIsSaving(true);
    try {
      const floorPlanData = { rooms, publishedAt: new Date().toISOString(), version: 3 };
      const allTables = Object.values(rooms).flatMap(r => r.items || []).filter(i => i.type === 'table');
      const totalSeats = allTables.reduce((sum, t) => sum + (t.seats || 0), 0);
      await base44.entities.Restaurant.update(restaurant.id, { floor_plan_data: floorPlanData, total_seats: totalSeats, available_seats: totalSeats });
      const existing = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const existingByFpId = new Map((existing || []).filter(t => t.floorplan_item_id).map(t => [t.floorplan_item_id, t]));
      const keep = new Set();
      for (const t of allTables) {
        const found = existingByFpId.get(t.id);
        const roomKey = Object.entries(rooms).find(([, room]) => room.items.some(i => i.id === t.id))?.[0] || 'MAIN';
        const payload = { restaurant_id: restaurant.id, floorplan_item_id: t.id, label: `T${t.label || t.seats}`, capacity: t.seats, status: found?.status || 'free', position_x: t.x, position_y: t.y, shape: t.shape, rotation: t.rotation || 0, room_id: roomKey, z_index: t.z || 0 };
        if (found?.id) { await base44.entities.Table.update(found.id, payload); keep.add(found.id); }
        else { const c = await base44.entities.Table.create(payload); keep.add(c?.id); }
      }
      for (const old of existing || []) {
        if (!keep.has(old.id) && old.floorplan_item_id) await base44.entities.Table.delete(old.id);
      }
      try { localStorage.setItem(`floorplan_${restaurant.id}`, JSON.stringify({ ...floorPlanData, cachedAt: new Date().toISOString() })); } catch {}
      toast.success("Published! Live floor plan updated.");
      onPublish?.(floorPlanData);
    } catch (err) { toast.error(`Publish failed: ${err?.message || err}`); }
    finally { setIsSaving(false); }
  }

  const allItems = useMemo(() => [...(current?.items || []), ...(current?.zones || [])], [current]);
  const contextIds = contextMenu?.targetId ? [contextMenu.targetId] : selectedIds;

  // Dynamic cursor
  const canvasCursor = (() => {
    if (tool === 'pan') return 'grab';
    if (['addTable', 'addText', 'addZone', 'drawWall', 'drawRoom', 'drawRoomRect'].includes(tool)) return 'crosshair';
    return 'default';
  })();

  // Toggle button helper
  const Toggle = ({ label, value, onChange, color = '#22c55e' }) => (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
      style={{
        background: value ? `${color}20` : UI.pillOff,
        color: value ? color : UI.subtext,
        borderColor: value ? color : UI.pillBorder,
        boxShadow: value ? `0 0 8px ${color}40` : 'none'
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full transition-colors" style={{ background: value ? color : UI.subtext }} />
      {label}
    </button>
  );

  return (
    <div ref={containerRef} className="space-y-3 select-none">

      {/* ── Glassmorphic Toolbar ── */}
      <div
        className="rounded-2xl p-3 border"
        style={{ background: UI.bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: UI.border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">

          {/* Tool buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "select",      Icon: MousePointer2, label: "Select"    },
              { id: "pan",         Icon: Hand,          label: "Pan"       },
              { id: "addTable",    Icon: Square,        label: "Table"     },
              { id: "drawWall",    Icon: Pencil,        label: "Wall"      },
              { id: "drawRoomRect",Icon: Home,          label: "Room"      },
              { id: "drawRoom",    Icon: Move,          label: "Free"      },
              { id: "addText",     Icon: Type,          label: "Note"      },
              { id: "addZone",     Icon: Map,           label: "Zone"      }
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => { setTool(id); setDraftPoints([]); setIsDrawing(false); setRectDraft(null); setZoneDraft(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all"
                style={{
                  background: tool === id ? UI.pillOn : UI.pillOff,
                  color: tool === id ? UI.pillOnText : UI.pillOffText,
                  borderColor: tool === id ? UI.pillOn : UI.pillBorder,
                  boxShadow: tool === id ? `0 0 10px ${UI.pillOn}44` : 'none'
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}

            {/* Seat presets */}
            <div className="flex items-center gap-1 ml-1 pl-2 border-l" style={{ borderColor: UI.pillBorder }}>
              {TABLE_PRESETS.map((p, idx) => (
                <button
                  key={p.seats}
                  onClick={() => { setPresetIndex(idx); setTool("addTable"); }}
                  className="w-8 h-8 rounded-xl border text-xs font-bold transition-all"
                  style={{
                    background: presetIndex === idx && tool === 'addTable' ? UI.pillOn : UI.pillOff,
                    color: presetIndex === idx && tool === 'addTable' ? 'white' : UI.pillOffText,
                    borderColor: presetIndex === idx && tool === 'addTable' ? UI.pillOn : UI.pillBorder
                  }}
                >
                  {p.seats}
                </button>
              ))}
            </div>
          </div>

          {/* Right: toggles + zoom + publish */}
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Grid"       value={showGrid}         onChange={setShowGrid}         color="#22c55e" />
            <Toggle label="No-overlap" value={collisionGuard}   onChange={setCollisionGuard}   color="#3b82f6" />
            <Toggle label="Snap"       value={snapGrid}         onChange={setSnapGrid}         color="#3b82f6" />
            <Toggle label="Zones"      value={showZones}        onChange={setShowZones}        color="#22c55e" />
            <Toggle label="Live"       value={showTableStatus}  onChange={setShowTableStatus}  color="#22c55e" />

            <div className="flex items-center gap-1 pl-2 border-l" style={{ borderColor: UI.pillBorder }}>
              {[
                { Icon: ZoomIn,  fn: () => setCam(c => ({ ...c, scale: clampScale(c.scale * 1.12) })) },
                { Icon: ZoomOut, fn: () => setCam(c => ({ ...c, scale: clampScale(c.scale * 0.88) })) }
              ].map(({ Icon, fn }, i) => (
                <button key={i} onClick={fn}
                  className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all hover:bg-white/10"
                  style={{ borderColor: UI.pillBorder, color: UI.text }}>
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <button onClick={() => setCam({ x: -260, y: -140, scale: 1.18 })}
                className="px-2 h-8 rounded-xl border text-xs transition-all hover:bg-white/10"
                style={{ borderColor: UI.pillBorder, color: UI.subtext }}>
                Reset
              </button>
            </div>

            <button
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', boxShadow: '0 0 14px rgba(34,197,94,0.35)' }}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving…" : "Publish"}
            </button>
          </div>
        </div>

        {/* Zone type picker */}
        {tool === 'addZone' && (
          <div className="mt-2 flex items-center gap-2 pt-2 border-t flex-wrap" style={{ borderColor: UI.pillBorder }}>
            <span className="text-xs font-semibold" style={{ color: UI.subtext }}>Zone:</span>
            {ZONE_TYPES.map(zone => (
              <button key={zone.id} onClick={() => setSelectedZoneType(zone.id)}
                className="px-3 py-1 rounded-xl border text-xs font-medium transition-all"
                style={{
                  background: selectedZoneType === zone.id ? zone.fill : UI.pillOff,
                  borderColor: selectedZoneType === zone.id ? zone.stroke : UI.pillBorder,
                  color: UI.text,
                  boxShadow: selectedZoneType === zone.id ? `0 0 8px ${zone.stroke}` : 'none'
                }}>
                {zone.label}
              </button>
            ))}
            <span className="text-xs ml-1" style={{ color: UI.subtext }}>Drag to draw</span>
          </div>
        )}

        {/* Hint */}
        <p className="mt-1.5 text-xs" style={{ color: UI.subtext }}>
          Scroll to zoom · Middle-click or Space+drag to pan · Drag empty space to box-select · Delete key to remove
        </p>
      </div>

      {/* ── Canvas ── */}
      <Card className="border-0 overflow-hidden relative" style={{ background: COLORS.canvasBg }}>
        <div className="relative" style={{ height: 690 }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: canvasCursor }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
            onContextMenu={onContextMenu}
          />

          {/* Room tabs */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/50 border border-white/10 rounded-2xl p-1.5 backdrop-blur">
            {ROOM_TABS.map(t => (
              <button key={t.id}
                onClick={() => { setRoomId(t.id); setSelectedIds([]); setContextMenu(null); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: roomId === t.id ? 'rgba(34,197,94,0.2)' : 'transparent',
                  color: roomId === t.id ? '#22c55e' : 'rgba(255,255,255,0.6)',
                  border: roomId === t.id ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent'
                }}>
                {t.id}
              </button>
            ))}
          </div>

          {/* Selection info */}
          {selectedIds.length > 1 && (
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
              {selectedIds.length} items selected
            </div>
          )}

          {/* Context menu */}
          {contextMenu && (
            <div className="absolute z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className="w-52 rounded-2xl bg-[#0f172a]/95 border border-white/10 shadow-2xl overflow-hidden backdrop-blur">
                <div className="px-4 py-2 text-white/50 text-xs border-b border-white/10">Actions</div>
                {[
                  { Icon: BringToFront, label: "Bring Forward",  fn: () => { bumpZ(contextIds, +1); setContextMenu(null); } },
                  { Icon: SendToBack,   label: "Send Backward",  fn: () => { bumpZ(contextIds, -1); setContextMenu(null); } },
                  { Icon: Lock,         label: "Lock / Unlock",  fn: () => { const anyL = contextIds.some(id => allItems.find(x => x.id === id)?.locked); setLocked(contextIds, !anyL); setContextMenu(null); } },
                  { Icon: Copy,         label: "Duplicate",      fn: () => {
                    const id = contextMenu.targetId;
                    if (!id) { setContextMenu(null); return; }
                    const t = allItems.find(x => x.id === id);
                    if (!t) { setContextMenu(null); return; }
                    updateRoom(r => ({ ...r, items: [...(r.items || []), { ...t, id: uid(), x: (t.x || 0) + 20, y: (t.y || 0) + 20 }] }));
                    setContextMenu(null);
                  }},
                  { Icon: Trash2, label: "Delete", fn: () => { deleteIds(contextIds); setContextMenu(null); }, danger: true }
                ].map(({ Icon, label, fn, danger }) => (
                  <button key={label} onClick={fn}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center gap-2 text-sm"
                    style={{ color: danger ? '#fca5a5' : 'white' }}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
                <div className="border-t border-white/10" />
                <button onClick={() => setContextMenu(null)} className="w-full px-4 py-2 text-xs text-white/40 hover:bg-white/5">Close</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Note editor */}
      {selectedIds.length === 1 && (current?.items || []).find(i => i.id === selectedIds[0])?.type === 'note' && (
        <div className="rounded-2xl p-4 border" style={{ background: UI.bg, backdropFilter: 'blur(12px)', borderColor: UI.border }}>
          <div className="font-semibold mb-2 text-sm" style={{ color: UI.text }}>Edit Note</div>
          <Input
            value={noteEdit.text}
            onChange={e => setNoteEdit(n => ({ ...n, text: e.target.value }))}
            placeholder="Note text"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
          />
          <button
            className="mt-3 px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: UI.pillOn, color: 'white' }}
            onClick={() => { updateItem(noteEdit.id, { text: noteEdit.text }); toast.success("Note updated."); }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
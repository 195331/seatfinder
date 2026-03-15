import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MousePointer2, Hand, Square, Pencil, Home, Type, Sparkles,
  BringToFront, SendToBack, Lock, Unlock, Copy, Trash2,
  Save, ZoomIn, ZoomOut, LocateFixed, Move
} from "lucide-react";

const CANVAS_W = 2400, CANVAS_H = 1700;
const COLORS = {
  canvasBg: "#0b1220", gridMajor: "rgba(255,255,255,0.06)", gridMinor: "rgba(255,255,255,0.03)",
  text: "rgba(255,255,255,0.92)", subtext: "rgba(255,255,255,0.60)", accent: "#22c55e",
  tableFill: "rgba(255,255,255,0.08)", tableStroke: "rgba(255,255,255,0.18)",
  wall: "rgba(255,255,255,0.42)", roomFill: "rgba(34,197,94,0.10)", roomStroke: "rgba(34,197,94,0.38)",
  noteFill: "rgba(59,130,246,0.10)", noteStroke: "rgba(59,130,246,0.35)", danger: "#ef4444",
  tableFree: "rgba(16,185,129,0.25)", tableOccupied: "rgba(245,158,11,0.25)",
  tableReserved: "rgba(59,130,246,0.25)", tableStrokeFree: "rgba(16,185,129,0.6)",
  tableStrokeOccupied: "rgba(245,158,11,0.6)", tableStrokeReserved: "rgba(59,130,246,0.6)"
};
const UI = {
  toolbarBg: "rgba(255,255,255,0.92)", toolbarBorder: "rgba(15,23,42,0.08)",
  toolbarText: "rgba(15,23,42,0.85)", toolbarSubtext: "rgba(15,23,42,0.55)",
  pillOnBg: "rgba(15,23,42,0.9)", pillOnText: "white",
  pillOffBg: "rgba(15,23,42,0.05)", pillOffText: "rgba(15,23,42,0.8)",
  pillBorder: "rgba(15,23,42,0.12)"
};
const ZONE_TYPES = [
  { id: 'quiet', label: '🤫 Quiet', fill: 'rgba(139,92,246,0.12)', stroke: 'rgba(139,92,246,0.35)' },
  { id: 'bar', label: '🍷 Bar', fill: 'rgba(239,68,68,0.12)', stroke: 'rgba(239,68,68,0.35)' },
  { id: 'family', label: '👨‍👩‍👧 Family', fill: 'rgba(34,197,94,0.12)', stroke: 'rgba(34,197,94,0.35)' },
  { id: 'outdoor', label: '🌳 Outdoor', fill: 'rgba(59,130,246,0.12)', stroke: 'rgba(59,130,246,0.35)' },
  { id: 'vip', label: '⭐ VIP', fill: 'rgba(234,179,8,0.12)', stroke: 'rgba(234,179,8,0.35)' }
];
const TABLE_PRESETS = [
  { seats: 1, w: 56, h: 56, shape: "round" }, { seats: 2, w: 64, h: 64, shape: "round" },
  { seats: 4, w: 86, h: 86, shape: "round" }, { seats: 6, w: 112, h: 76, shape: "rect" },
  { seats: 8, w: 132, h: 84, shape: "rect" }, { seats: 10, w: 154, h: 92, shape: "rect" }
];
const ROOM_TABS = [{ id: "MAIN" }, { id: "ROOF" }, { id: "LOUNGE" }];
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const dist = (a, b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);

function toFlat(pts) { const o = []; for (const p of pts) o.push(p.x, p.y); return o; }

function snapAngle(p0, p1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const ang = Math.atan2(dy, dx), step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = Math.sqrt(dx*dx + dy*dy);
  return { x: p0.x + Math.cos(snapped)*len, y: p0.y + Math.sin(snapped)*len };
}

function drawScene(ctx, W, H, cam, room, opts) {
  const { showGrid, showZones, showTableStatus, tableStatusMap, selectedIds, draftPoints, tool, rectDraft, roomId } = opts;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.scale, cam.scale);

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

  const boundary = room?.roomBoundary || [];
  if (boundary.length >= 3) {
    ctx.beginPath(); ctx.moveTo(boundary[0].x, boundary[0].y);
    boundary.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = COLORS.roomFill; ctx.fill();
    ctx.strokeStyle = COLORS.roomStroke; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.subtext; ctx.font = '14px sans-serif'; ctx.fillText(roomId, boundary[0].x + 10, boundary[0].y + 20);
  }

  if (rectDraft) {
    const x = Math.min(rectDraft.x0, rectDraft.x1), y = Math.min(rectDraft.y0, rectDraft.y1);
    const w = Math.abs(rectDraft.x1-rectDraft.x0), h = Math.abs(rectDraft.y1-rectDraft.y0);
    ctx.strokeStyle = COLORS.roomStroke; ctx.lineWidth = 2; ctx.setLineDash([10,8]);
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  if (showZones) {
    (room?.zones || []).forEach(zone => {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = zone.fill; ctx.strokeStyle = selectedIds.includes(zone.id) ? COLORS.accent : zone.stroke;
      ctx.lineWidth = selectedIds.includes(zone.id) ? 3 : 2; ctx.setLineDash([12,8]);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(zone.x, zone.y, zone.w, zone.h, 16);
      else ctx.rect(zone.x, zone.y, zone.w, zone.h);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.text; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(zone.label || '', zone.x + 12, zone.y + 24);
      ctx.restore();
    });
  }

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

  (room?.items || []).sort((a,b) => (a.z||0)-(b.z||0)).forEach(it => {
    const isSelected = selectedIds.includes(it.id);
    ctx.save();
    ctx.translate(it.x + it.w/2, it.y + it.h/2);
    ctx.rotate(((it.rotation||0)*Math.PI)/180);
    ctx.translate(-it.w/2, -it.h/2);

    if (it.type === 'note') {
      ctx.fillStyle = it.fill || COLORS.noteFill;
      ctx.strokeStyle = isSelected ? COLORS.accent : (it.stroke || COLORS.noteStroke);
      ctx.lineWidth = isSelected ? 2.5 : 1.6;
      if (isSelected) { ctx.shadowBlur = 14; ctx.shadowColor = COLORS.accent; }
      if (ctx.roundRect) ctx.roundRect(0, 0, it.w, it.h, 14); else ctx.rect(0, 0, it.w, it.h);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, it.w, it.h, 14); else ctx.rect(0, 0, it.w, it.h);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.text; ctx.font = '600 14px sans-serif';
      ctx.fillText(it.text || 'Note', 14, 22);
    } else if (it.type === 'table') {
      const liveStatus = showTableStatus ? tableStatusMap[it.id] : null;
      const fill = liveStatus === 'occupied' ? COLORS.tableOccupied : liveStatus === 'reserved' ? COLORS.tableReserved : liveStatus === 'free' ? COLORS.tableFree : it.fill || COLORS.tableFill;
      const stroke = liveStatus === 'occupied' ? COLORS.tableStrokeOccupied : liveStatus === 'reserved' ? COLORS.tableStrokeReserved : liveStatus === 'free' ? COLORS.tableStrokeFree : it.stroke || COLORS.tableStroke;
      ctx.fillStyle = fill;
      ctx.strokeStyle = isSelected ? COLORS.accent : stroke;
      ctx.lineWidth = isSelected ? 3 : 2;
      if (isSelected) { ctx.shadowBlur = 14; ctx.shadowColor = COLORS.accent; }
      ctx.beginPath();
      if (it.shape === 'round') ctx.arc(it.w/2, it.h/2, it.w/2, 0, Math.PI*2);
      else { if (ctx.roundRect) ctx.roundRect(0, 0, it.w, it.h, 12); else ctx.rect(0, 0, it.w, it.h); }
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.text; ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = it.table_number != null ? `T${it.table_number}` : (it.label || `T${it.seats}`);
      ctx.fillText(label, it.w/2, it.h/2 - 7);
      ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${it.seats||4} seats`, it.w/2, it.h/2 + 8);
      if (it.locked) { ctx.font = '12px sans-serif'; ctx.fillText('🔒', it.w - 10, 12); }
    }
    ctx.restore();
  });

  if ((tool === 'drawWall' || tool === 'drawRoom') && draftPoints.length >= 2) {
    ctx.strokeStyle = tool === 'drawRoom' ? COLORS.roomStroke : COLORS.wall;
    ctx.lineWidth = tool === 'drawRoom' ? 2 : 10;
    ctx.lineCap = 'round'; ctx.setLineDash(tool === 'drawRoom' ? [10,8] : []);
    ctx.beginPath(); ctx.moveTo(draftPoints[0].x, draftPoints[0].y);
    draftPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
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
  const [snapAnglesEnabled, setSnapAnglesEnabled] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showTableStatus, setShowTableStatus] = useState(true);
  const [rooms, setRooms] = useState(() =>
    ROOM_TABS.reduce((acc, r) => { acc[r.id] = { roomId: r.id, roomBoundary: [], walls: [], items: [], zones: [] }; return acc; }, {})
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectDraft, setRectDraft] = useState(null);
  const [noteEdit, setNoteEdit] = useState({ id: null, text: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1180, h: 690 });

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

  useEffect(() => {
    if (!restaurant?.floor_plan_data?.rooms) return;
    const fp = restaurant.floor_plan_data;
    setRooms(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) { if (fp.rooms[k]) next[k] = { ...next[k], ...fp.rooms[k] }; }
      return next;
    });
  }, [restaurant?.id]);

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
      showGrid, showZones, showTableStatus, tableStatusMap, selectedIds, draftPoints, tool, rectDraft, roomId
    });
  }, [cam, current, showGrid, showZones, showTableStatus, tableStatusMap, selectedIds, draftPoints, tool, rectDraft, roomId, canvasSize]);

  function updateRoom(patchFn) {
    setRooms(prev => { const next = { ...prev }; next[roomId] = patchFn(next[roomId]); return next; });
  }
  function getWorldPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left - cam.x) / cam.scale, y: (e.clientY - rect.top - cam.y) / cam.scale };
  }
  function clampScale(s) { return Math.max(0.35, Math.min(2.4, s)); }

  function hitTestTable(world) {
    const items = current?.items || [];
    return [...items].reverse().find(it => {
      if (it.type !== 'table' && it.type !== 'note') return false;
      return world.x >= it.x && world.x <= it.x + it.w && world.y >= it.y && world.y <= it.y + it.h;
    });
  }

  function addTableAt(world) {
    const preset = TABLE_PRESETS[presetIndex] || TABLE_PRESETS[2];
    const id = uid();
    const table = { id, type: "table", x: world.x - preset.w/2, y: world.y - preset.h/2, w: preset.w, h: preset.h, shape: preset.shape, seats: preset.seats, label: `${preset.seats}`, rotation: 0, fill: COLORS.tableFill, stroke: COLORS.tableStroke, locked: false, z: 0 };
    updateRoom(r => ({ ...r, items: [...(r.items||[]), table] }));
    setSelectedIds([id]);
  }
  function addNoteAt(world) {
    const id = uid();
    const note = { id, type: "note", x: world.x - 120, y: world.y - 28, w: 240, h: 56, text: "Note", rotation: 0, fill: COLORS.noteFill, stroke: COLORS.noteStroke, locked: false, z: 0 };
    updateRoom(r => ({ ...r, items: [...(r.items||[]), note] }));
    setSelectedIds([id]); setNoteEdit({ id, text: note.text });
  }
  function addZoneAt(world) {
    const zt = ZONE_TYPES.find(z => z.id === selectedZoneType) || ZONE_TYPES[0];
    const id = uid();
    const zone = { id, type: "zone", zoneType: zt.id, x: world.x - 150, y: world.y - 100, w: 300, h: 200, label: zt.label, fill: zt.fill, stroke: zt.stroke, locked: false, z: -1 };
    updateRoom(r => ({ ...r, zones: [...(r.zones||[]), zone] }));
    setSelectedIds([id]);
  }
  function updateItem(id, patch) {
    updateRoom(r => ({ ...r, items: (r.items||[]).map(it => it.id === id ? { ...it, ...patch } : it) }));
  }
  function deleteIds(ids) {
    updateRoom(r => ({
      ...r, items: (r.items||[]).filter(it => !ids.includes(it.id)),
      walls: (r.walls||[]).filter(w => !ids.includes(w.id)),
      zones: (r.zones||[]).filter(z => !ids.includes(z.id))
    }));
    setSelectedIds([]);
  }
  function bumpZ(ids, delta) {
    updateRoom(r => ({ ...r, items: (r.items||[]).map(it => ids.includes(it.id) ? { ...it, z: (it.z||0)+delta } : it) }));
  }
  function setLocked(ids, locked) {
    updateRoom(r => ({ ...r, items: (r.items||[]).map(it => ids.includes(it.id) ? { ...it, locked } : it) }));
  }

  const dragState = useRef(null);

  function onMouseDown(e) {
    setContextMenu(null);
    if (e.button === 2) return;
    const world = getWorldPos(e);
    if (tool === 'addTable') { addTableAt(world); return; }
    if (tool === 'addText') { addNoteAt(world); return; }
    if (tool === 'addZone') { addZoneAt(world); return; }
    if (tool === 'drawRoomRect') { setRectDraft({ x0: world.x, y0: world.y, x1: world.x, y1: world.y }); setIsDrawing(true); return; }
    if (tool === 'drawWall' || tool === 'drawRoom') {
      setIsDrawing(true);
      setDraftPoints(prev => {
        const next = prev.length ? prev : [world];
        if (tool === 'drawRoom' && next.length >= 3 && dist(next[0], world) < 18) {
          updateRoom(r => ({ ...r, roomBoundary: next })); setIsDrawing(false); return [];
        }
        return [...next, world];
      });
      return;
    }
    if (tool === 'select') {
      const hit = hitTestTable(world);
      if (hit) {
        setSelectedIds(e.shiftKey ? prev => prev.includes(hit.id) ? prev : [...prev, hit.id] : [hit.id]);
        dragState.current = { id: hit.id, startX: world.x, startY: world.y, origX: hit.x, origY: hit.y };
      } else {
        setSelectedIds([]);
      }
    }
  }

  function onMouseMove(e) {
    const world = getWorldPos(e);
    if (isDrawing) {
      if (tool === 'drawRoomRect') { setRectDraft(r => r ? { ...r, x1: world.x, y1: world.y } : r); return; }
      if (tool === 'drawWall' || tool === 'drawRoom') {
        setDraftPoints(prev => {
          if (!prev.length) return prev;
          const p = snapAnglesEnabled ? snapAngle(prev[prev.length-1], world) : world;
          return [...prev.slice(0,-1), p];
        });
      }
    }
    if (dragState.current && tool === 'select' && e.buttons === 1) {
      const { id, startX, startY, origX, origY } = dragState.current;
      const it = (current?.items||[]).find(i => i.id === id);
      if (it && !it.locked) {
        updateItem(id, { x: origX + world.x - startX, y: origY + world.y - startY });
      }
    }
  }

  function onMouseUp(e) {
    dragState.current = null;
    if (!isDrawing) return;
    if (tool === 'drawRoomRect' && rectDraft) {
      const { x0,y0,x1,y1 } = rectDraft;
      const minX=Math.min(x0,x1), maxX=Math.max(x0,x1), minY=Math.min(y0,y1), maxY=Math.max(y0,y1);
      if (maxX-minX > 40 && maxY-minY > 40) {
        updateRoom(r => ({ ...r, roomBoundary: [{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}] }));
      }
      setRectDraft(null); setIsDrawing(false); return;
    }
    if (tool === 'drawWall') {
      if (draftPoints.length >= 2) updateRoom(r => ({ ...r, walls: [...(r.walls||[]), { id: uid(), points: draftPoints, thickness: 10, locked: false, z: 0 }] }));
      setDraftPoints([]); setIsDrawing(false);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const oldScale = cam.scale, newScale = clampScale(oldScale * factor);
    setCam({ x: pointer.x - (pointer.x - cam.x)/oldScale*newScale, y: pointer.y - (pointer.y - cam.y)/oldScale*newScale, scale: newScale });
  }

  function onContextMenu(e) {
    e.preventDefault();
    const world = getWorldPos(e);
    const hit = hitTestTable(world);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, targetId: hit?.id || null });
    if (hit) setSelectedIds([hit.id]);
  }

  async function handlePublish() {
    if (!restaurant?.id) { toast.error("Missing restaurant"); return; }
    setIsSaving(true);
    try {
      const floorPlanData = { rooms, publishedAt: new Date().toISOString(), version: 3 };
      const allTables = Object.values(rooms).flatMap(r => r.items||[]).filter(i => i.type==='table');
      const totalSeats = allTables.reduce((sum,t) => sum+(t.seats||0), 0);
      await base44.entities.Restaurant.update(restaurant.id, { floor_plan_data: floorPlanData, total_seats: totalSeats, available_seats: totalSeats });
      const existing = await base44.entities.Table.filter({ restaurant_id: restaurant.id });
      const existingByFpId = new Map((existing||[]).filter(t=>t.floorplan_item_id).map(t=>[t.floorplan_item_id,t]));
      const keep = new Set();
      for (const t of allTables) {
        const found = existingByFpId.get(t.id);
        const roomKey = Object.entries(rooms).find(([,room]) => room.items.some(i=>i.id===t.id))?.[0] || 'MAIN';
        const payload = { restaurant_id: restaurant.id, floorplan_item_id: t.id, label: `T${t.label||t.seats}`, capacity: t.seats, status: found?.status||'free', position_x: t.x, position_y: t.y, shape: t.shape, rotation: t.rotation||0, room_id: roomKey, z_index: t.z||0 };
        if (found?.id) { await base44.entities.Table.update(found.id, payload); keep.add(found.id); }
        else { const c = await base44.entities.Table.create(payload); keep.add(c?.id); }
      }
      for (const old of existing||[]) { if (!keep.has(old.id) && old.floorplan_item_id) await base44.entities.Table.delete(old.id); }
      try { localStorage.setItem(`floorplan_${restaurant.id}`, JSON.stringify({ ...floorPlanData, cachedAt: new Date().toISOString() })); } catch {}
      toast.success("Published! Live floor plan updated.");
      onPublish?.(floorPlanData);
    } catch (e) { toast.error(`Publish failed: ${e?.message||e}`); }
    finally { setIsSaving(false); }
  }

  const allItems = useMemo(() => [...(current?.items||[]), ...(current?.zones||[])], [current]);

  const contextIds = contextMenu?.targetId ? [contextMenu.targetId] : selectedIds;

  return (
    <div ref={containerRef} className="space-y-4 select-none">
      {/* Toolbar */}
      <Card className="p-4 border-0" style={{ background: UI.toolbarBg, border: `1px solid ${UI.toolbarBorder}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id:"select",Icon:MousePointer2,label:"Select" }, { id:"pan",Icon:Hand,label:"Pan" },
              { id:"addTable",Icon:Square,label:"Add Table" }, { id:"drawWall",Icon:Pencil,label:"Draw Wall" },
              { id:"drawRoomRect",Icon:Home,label:"Room Rect" }, { id:"drawRoom",Icon:Move,label:"Room Free" },
              { id:"addText",Icon:Type,label:"Note" }, { id:"addZone",Icon:BringToFront,label:"Add Zone" }
            ].map(({ id, Icon, label }) => (
              <button key={id} onClick={() => { setTool(id); setDraftPoints([]); setIsDrawing(false); setRectDraft(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition"
                style={{ background: tool===id ? UI.pillOnBg : UI.pillOffBg, color: tool===id ? UI.pillOnText : UI.pillOffText, borderColor: UI.pillBorder }}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-2">
              {TABLE_PRESETS.map((p,idx) => (
                <button key={p.seats} onClick={() => { setPresetIndex(idx); setTool("addTable"); }}
                  className="px-3 py-2 rounded-full border text-sm font-bold transition"
                  style={{ background: presetIndex===idx ? "rgba(15,23,42,0.9)" : "rgba(15,23,42,0.04)", color: presetIndex===idx ? "white" : "rgba(15,23,42,0.75)", borderColor: "rgba(15,23,42,0.12)" }}>
                  {p.seats}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[["Grid",showGrid,setShowGrid],["No-overlap",collisionGuard,setCollisionGuard],["Auto-straighten",snapAnglesEnabled,setSnapAnglesEnabled],["Zones",showZones,setShowZones],["Live Status",showTableStatus,setShowTableStatus]].map(([label,val,setter]) => (
              <div key={label} className="flex items-center gap-2 text-sm" style={{ color: UI.toolbarText }}>
                <span className="font-semibold">{label}</span><Switch checked={val} onCheckedChange={setter} />
              </div>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <Button variant="outline" className="rounded-full" onClick={() => setCam(c => ({ ...c, scale: clampScale(c.scale*1.12) }))}><ZoomIn className="w-4 h-4" /></Button>
              <Button variant="outline" className="rounded-full" onClick={() => setCam(c => ({ ...c, scale: clampScale(c.scale*0.88) }))}><ZoomOut className="w-4 h-4" /></Button>
              <Button variant="outline" className="rounded-full" onClick={() => setCam({ x:-260,y:-140,scale:1.18 })}>Reset</Button>
            </div>
            <Button onClick={handlePublish} disabled={isSaving} className="rounded-full bg-black text-white hover:bg-black/90">
              <Save className="w-4 h-4 mr-2" />{isSaving ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
        {tool === 'addZone' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: UI.toolbarText }}>Zone Type:</span>
            {ZONE_TYPES.map(zone => (
              <button key={zone.id} onClick={() => setSelectedZoneType(zone.id)}
                className="px-3 py-1.5 rounded-full border text-xs font-medium transition"
                style={{ background: selectedZoneType===zone.id ? zone.fill : UI.pillOffBg, borderColor: selectedZoneType===zone.id ? zone.stroke : UI.pillBorder, color: UI.toolbarText }}>
                {zone.label}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Canvas */}
      <Card className="border-0 overflow-hidden relative" style={{ background: COLORS.canvasBg }}>
        <div className="relative" style={{ height: 690 }}>
          <canvas
            ref={canvasRef}
            style={{ display:'block', cursor: tool==='pan' ? 'grab' : tool==='addTable'||tool==='addText'||tool==='addZone' ? 'crosshair' : 'default' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
            onContextMenu={onContextMenu}
          />
          {/* Room tabs */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/10 border border-white/10 rounded-2xl p-2 backdrop-blur">
            {ROOM_TABS.map(t => (
              <button key={t.id} onClick={() => { setRoomId(t.id); setSelectedIds([]); setContextMenu(null); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${roomId===t.id ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10"}`}>
                {t.id}
              </button>
            ))}
          </div>
          {/* Context menu */}
          {contextMenu && (
            <div className="absolute z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className="w-52 rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden">
                <div className="px-4 py-2 text-white/60 text-xs border-b border-white/10">Actions</div>
                {[
                  { Icon: BringToFront, label:"Bring Forward", fn: () => { bumpZ(contextIds,+1); setContextMenu(null); } },
                  { Icon: SendToBack, label:"Send Backward", fn: () => { bumpZ(contextIds,-1); setContextMenu(null); } },
                  { Icon: Lock, label:"Lock/Unlock", fn: () => { const anyL = contextIds.some(id => allItems.find(x=>x.id===id)?.locked); setLocked(contextIds,!anyL); setContextMenu(null); } },
                  { Icon: Copy, label:"Duplicate", fn: () => {
                    const id = contextMenu.targetId;
                    if (!id) { setContextMenu(null); return; }
                    const t = allItems.find(x=>x.id===id);
                    if (!t) { setContextMenu(null); return; }
                    updateRoom(r => ({ ...r, items: [...(r.items||[]), { ...t, id: uid(), x: (t.x||0)+18, y: (t.y||0)+18 }] }));
                    setContextMenu(null);
                  }},
                  { Icon: Trash2, label:"Delete", fn: () => { deleteIds(contextIds); setContextMenu(null); }, danger: true }
                ].map(({ Icon, label, fn, danger }) => (
                  <button key={label} onClick={fn} className={`w-full px-4 py-3 text-left hover:bg-white/5 flex items-center gap-2 text-sm ${danger ? 'text-red-300' : 'text-white'}`}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
                <div className="border-t border-white/10"/>
                <button onClick={() => setContextMenu(null)} className="w-full px-4 py-2 text-xs text-white/50 hover:bg-white/5">Close</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Note editor */}
      {selectedIds.length === 1 && (current?.items||[]).find(i=>i.id===selectedIds[0])?.type === 'note' && (
        <Card className="p-4 border border-slate-200">
          <div className="font-semibold mb-2">Edit Note</div>
          <Input value={noteEdit.text} onChange={e => setNoteEdit(n => ({ ...n, text: e.target.value }))} placeholder="Note text" />
          <Button className="mt-3" onClick={() => { updateItem(noteEdit.id, { text: noteEdit.text }); toast.success("Note updated."); }}>Save Note</Button>
        </Card>
      )}
    </div>
  );
}
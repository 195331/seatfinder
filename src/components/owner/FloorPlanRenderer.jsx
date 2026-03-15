import React, { useRef, useEffect } from 'react';

import React, { useRef, useEffect } from 'react';

const STATUS_STROKE = {
  combined:     '#7C3AED',
  arrived_early:'#F59E0B',
  occupied:     '#EF4444',
  checked_in:   '#EF4444',
  reserved:     '#3B82F6',
  free:         '#10B981',
};

function drawTable(ctx, obj, status, selected) {
  const stroke = STATUS_STROKE[status] || '#94a3b8';
  const fill = status === 'combined' ? '#ede9fe' : '#ffffff';
  ctx.save();
  ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
  ctx.rotate(((obj.rotation || 0) * Math.PI) / 180);
  ctx.translate(-obj.w / 2, -obj.h / 2);

  ctx.lineWidth = selected ? 3.5 : 2.5;
  ctx.strokeStyle = selected ? '#22c55e' : stroke;
  ctx.fillStyle = fill;

  if (obj.shape === 'round') {
    const r = obj.w / 2;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const rad = 8;
    ctx.beginPath();
    ctx.moveTo(rad, 0);
    ctx.lineTo(obj.w - rad, 0);
    ctx.arcTo(obj.w, 0, obj.w, rad, rad);
    ctx.lineTo(obj.w, obj.h - rad);
    ctx.arcTo(obj.w, obj.h, obj.w - rad, obj.h, rad);
    ctx.lineTo(rad, obj.h);
    ctx.arcTo(0, obj.h, 0, obj.h - rad, rad);
    ctx.lineTo(0, rad);
    ctx.arcTo(0, 0, rad, 0, rad);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // label
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 13px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = obj.table_number != null ? `T${obj.table_number}` : (obj.label || '');
  ctx.fillText(label, obj.w / 2, obj.h / 2 - 6);
  ctx.font = `11px sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText(`${obj.seats || 4} seats`, obj.w / 2, obj.h / 2 + 8);
  ctx.restore();
}

export default function FloorPlanRenderer({
  width = 1180,
  height = 690,
  camera = { x: -260, y: -140, scale: 1.18 },
  roomData,
  showGrid = true,
  showZones = true,
  showTableStatus = false,
  tableStatusMap = {},
  selectedIds = [],
  onTableClick,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    // Grid
    if (showGrid) {
      const step = 40, major = 200;
      for (let x = 0; x <= 2400; x += step) {
        ctx.strokeStyle = x % major === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = x % major === 0 ? 1.2 : 0.6;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1700); ctx.stroke();
      }
      for (let y = 0; y <= 1700; y += step) {
        ctx.strokeStyle = y % major === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = y % major === 0 ? 1.2 : 0.6;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2400, y); ctx.stroke();
      }
    }

    const items = roomData?.items || [];
    const zones = roomData?.zones || [];
    const walls = roomData?.walls || [];
    const boundary = roomData?.roomBoundary || [];

    // Room boundary
    if (boundary.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(boundary[0].x, boundary[0].y);
      boundary.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(34,197,94,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,197,94,0.38)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Zones
    if (showZones) {
      zones.forEach(zone => {
        ctx.fillStyle = zone.fill || 'rgba(139,92,246,0.12)';
        ctx.strokeStyle = zone.stroke || 'rgba(139,92,246,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect?.(zone.x, zone.y, zone.w, zone.h, 16) || ctx.rect(zone.x, zone.y, zone.w, zone.h);
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.setLineDash([12, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(zone.label || '', zone.x + 12, zone.y + 24);
      });
    }

    // Walls
    walls.forEach(w => {
      if (!w.points?.length) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = w.thickness || 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(w.points[0].x, w.points[0].y);
      w.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    // Tables
    items.filter(i => i.type === 'table').forEach(obj => {
      const status = showTableStatus ? tableStatusMap[obj.id] : null;
      const selected = selectedIds.includes(obj.id);
      drawTable(ctx, obj, status, selected);
    });

    ctx.restore();
  }, [width, height, camera, roomData, showGrid, showZones, showTableStatus, tableStatusMap, selectedIds]);

  const handleClick = (e) => {
    if (!onTableClick) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - camera.x) / camera.scale;
    const my = (e.clientY - rect.top - camera.y) / camera.scale;
    const items = roomData?.items || [];
    const hit = items.filter(i => i.type === 'table').find(obj => {
      return mx >= obj.x && mx <= obj.x + obj.w && my >= obj.y && my <= obj.y + obj.h;
    });
    if (hit) onTableClick(hit);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ display: 'block', cursor: onTableClick ? 'pointer' : 'default' }}
    />
  );
}
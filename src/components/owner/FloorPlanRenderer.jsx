import React, { useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  free: '#10B981',
  arrived_early: '#F59E0B',
  occupied: '#EF4444',
  reserved: '#3B82F6',
  combined: '#a855f7'
};

export default function FloorPlanRenderer({
  stageRef = null,
  width = 800,
  height = 500,
  camera = { x: 0, y: 0, scale: 1 },
  roomData = null,
  showGrid = true,
  showZones = true,
  showTableStatus = true,
  tableStatusMap = {},
  selectedIds = [],
  highlightedIds = [],
  onTableClick = null,
  draggable = false,
  onDragEnd = null,
  onWheel = null,
  readOnly = false
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roomData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize * camera.scale) {
        ctx.beginPath();
        ctx.moveTo(x + camera.x % gridSize, 0);
        ctx.lineTo(x + camera.x % gridSize, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize * camera.scale) {
        ctx.beginPath();
        ctx.moveTo(0, y + camera.y % gridSize);
        ctx.lineTo(width, y + camera.y % gridSize);
        ctx.stroke();
      }
    }

    // Draw room boundary
    if (roomData?.roomBoundary && showZones) {
      ctx.fillStyle = 'rgba(71, 85, 105, 0.15)';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      const boundary = roomData.roomBoundary;
      ctx.beginPath();
      const p0 = worldToScreen(boundary[0].x, boundary[0].y, camera);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < boundary.length; i++) {
        const p = worldToScreen(boundary[i].x, boundary[i].y, camera);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw zones (if any)
    if (roomData?.zones && showZones) {
      for (const zone of roomData.zones) {
        ctx.fillStyle = zone.color ? `${zone.color}30` : 'rgba(99, 102, 241, 0.1)';
        ctx.strokeStyle = zone.color || '#6366f1';
        ctx.lineWidth = 1.5;
        const p1 = worldToScreen(zone.x, zone.y, camera);
        const p2 = worldToScreen(zone.x + zone.w, zone.y + zone.h, camera);
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
    }

    // Draw tables
    const items = roomData?.items || [];
    const tables = items.filter((i) => i?.type === 'table');

    for (const table of tables) {
      const status = tableStatusMap[table.id] || 'free';
      const isSelected = selectedIds.includes(table.id);
      const isHighlighted = highlightedIds.includes(table.id);

      const p1 = worldToScreen(table.x, table.y, camera);
      const p2 = worldToScreen(table.x + table.w, table.y + table.h, camera);
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;

      // Table body
      ctx.fillStyle = STATUS_COLORS[status] || '#64748b';
      ctx.globalAlpha = isHighlighted ? 0.9 : 0.7;
      ctx.fillRect(p1.x, p1.y, w, h);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = isSelected ? '#fbbf24' : '#334155';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeRect(p1.x, p1.y, w, h);

      // Table label
      if (w > 20 && h > 20) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.min(14, Math.min(w, h) / 2))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(table.label || `T${table.id}`, p1.x + w / 2, p1.y + h / 2);
      }
    }
  }, [width, height, camera, roomData, tableStatusMap, selectedIds, highlightedIds, showGrid, showZones]);

  const handleCanvasClick = (e) => {
    if (!onTableClick || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const wx = (px - camera.x) / camera.scale;
    const wy = (py - camera.y) / camera.scale;

    const items = roomData?.items || [];
    const tables = items.filter((i) => i?.type === 'table');

    for (const table of tables) {
      const pad = 26;
      const inside =
        wx >= table.x - pad &&
        wx <= table.x + table.w + pad &&
        wy >= table.y - pad &&
        wy <= table.y + table.h + pad;

      if (inside) {
        onTableClick(table);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onWheel={onWheel}
      className={cn("rounded-lg", !readOnly && draggable && "cursor-grab active:cursor-grabbing")}
      style={{
        display: 'block',
        background: '#1e293b',
      }}
    />
  );
}

function worldToScreen(wx, wy, camera) {
  return {
    x: wx * camera.scale + camera.x,
    y: wy * camera.scale + camera.y
  };
}
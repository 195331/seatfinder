import React from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Text } from 'react-konva';

const COLORS = {
  canvasBg: "#0b1220",
  gridMajor: "rgba(255,255,255,0.06)",
  gridMinor: "rgba(255,255,255,0.03)",
  text: "#1e293b",
  subtext: "rgba(255,255,255,0.60)",
  accent: "#22c55e",
  tableFill: "#ffffff",
  tableStroke: "rgba(255,255,255,0.18)",
  wall: "rgba(255,255,255,0.42)",
  roomFill: "rgba(34,197,94,0.10)",
  roomStroke: "rgba(34,197,94,0.38)",
  noteFill: "rgba(59,130,246,0.10)",
  noteStroke: "rgba(59,130,246,0.35)",
  danger: "#ef4444",
  tableFree: "#ffffff",
  tableOccupied: "#ffffff",
  tableReserved: "#ffffff",
  tableStrokeFree: "#10b981",
  tableStrokeOccupied: "#ef4444",
  tableStrokeReserved: "#f97316",
  tableStrokeArrivedEarly: "#3b82f6",
  chairDot: "rgba(148,163,184,0.8)"
};

function toFlat(points) {
  const out = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}

// Chair dots for tables
function ChairDots({ w, h, seats, shape }) {
  const count = Math.max(1, Math.min(12, seats || 4));
  const dots = [];
  
  if (shape === "round") {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h) / 2 + 14;
    
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dots.push(
        <Circle
          key={i}
          x={cx + Math.cos(a) * r}
          y={cy + Math.sin(a) * r}
          radius={6}
          fill={COLORS.chairDot}
          stroke="none"
          listening={false}
        />
      );
    }
  } else {
    // Rectangular tables - distribute chairs around perimeter
    const perimeter = 2 * (w + h);
    const spacing = perimeter / count;
    
    for (let i = 0; i < count; i++) {
      const dist = i * spacing;
      let x, y;
      
      if (dist < w) {
        // Top edge
        x = dist;
        y = -12;
      } else if (dist < w + h) {
        // Right edge
        x = w + 12;
        y = dist - w;
      } else if (dist < 2 * w + h) {
        // Bottom edge
        x = w - (dist - w - h);
        y = h + 12;
      } else {
        // Left edge
        x = -12;
        y = h - (dist - 2 * w - h);
      }
      
      dots.push(
        <Circle
          key={i}
          x={x}
          y={y}
          radius={6}
          fill={COLORS.chairDot}
          stroke="none"
          listening={false}
        />
      );
    }
  }
  
  return <>{dots}</>;
}

export default function FloorPlanRenderer({
  stageRef,
  width = 1180,
  height = 690,
  camera = { x: -260, y: -140, scale: 1.18 },
  roomData,
  showGrid = true,
  showZones = true,
  showTableStatus = false,
  tableStatusMap = {},
  selectedIds = [],
  highlightedIds = [],
  onTableClick,
  onItemClick,
  onContextMenu,
  onWheel,
  draggable = false,
  onDragEnd,
  interactive = false,
  readOnly = false,
  children
}) {
  const gridLines = [];
  if (showGrid) {
    const stepMinor = 40;
    const stepMajor = 200;
    for (let x = 0; x <= 2400; x += stepMinor) {
      gridLines.push({
        points: [x, 0, x, 1700],
        stroke: x % stepMajor === 0 ? COLORS.gridMajor : COLORS.gridMinor,
        width: x % stepMajor === 0 ? 1.2 : 0.6
      });
    }
    for (let y = 0; y <= 1700; y += stepMinor) {
      gridLines.push({
        points: [0, y, 2400, y],
        stroke: y % stepMajor === 0 ? COLORS.gridMajor : COLORS.gridMinor,
        width: y % stepMajor === 0 ? 1.2 : 0.6
      });
    }
  }

  const items = roomData?.items || [];
  const walls = roomData?.walls || [];
  const zones = roomData?.zones || [];
  const roomBoundary = roomData?.roomBoundary || [];

  // Sort all objects by z-index
  const allObjects = [
    ...zones.map(z => ({ ...z, type: 'zone', renderOrder: z.z ?? -10 })),
    ...walls.map(w => ({ ...w, type: 'wall', renderOrder: w.z ?? 0 })),
    ...items.map(i => ({ ...i, renderOrder: i.z ?? 0 }))
  ].sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0));

  return (
  <Stage
  ref={stageRef}
  width={width}
  height={height}
  x={camera.x}
  y={camera.y}
  scaleX={camera.scale}
  scaleY={camera.scale}
  draggable={draggable}
  onDragEnd={onDragEnd}
  onWheel={onWheel}
  onContextMenu={(e) => {
    e.evt?.preventDefault?.(); // IMPORTANT: stops browser right-click menu
    console.log("STAGE CONTEXT ✅", e.target?.id?.(), e.target?.className);
    onContextMenu?.(e);
  }}
  onMouseDown={(e) => {
    console.log("STAGE CLICK ✅", e.target?.id?.(), e.target?.className);
  }}
  onTap={(e) => {
    console.log("STAGE TAP ✅", e.target?.id?.(), e.target?.className);
  }}
>

      {/* Background Layer - NOT listening */}
      <Layer listening={false}>
        {/* Grid */}
        {gridLines.map((g, i) => (
          <Line key={i} points={g.points} stroke={g.stroke} strokeWidth={g.width} listening={false} />
        ))}

        {/* Room boundary */}
        {roomBoundary.length >= 3 && (
          <>
            <Line
              points={toFlat([...roomBoundary, roomBoundary[0]])}
              closed
              fill={COLORS.roomFill}
              stroke={COLORS.roomStroke}
              strokeWidth={2}
              listening={false}
            />
            <Text
              x={roomBoundary[0].x + 10}
              y={roomBoundary[0].y + 10}
              text={roomData?.roomId || 'ROOM'}
              fill={COLORS.subtext}
              fontSize={14}
              listening={false}
            />
          </>
        )}

        {/* Render all objects in z-order */}
        {allObjects.map((obj) => {
          const isSelected = selectedIds.includes(obj.id);
          const isHighlighted = highlightedIds.includes(obj.id);

          if (obj.type === 'zone' && showZones) {
            return (
              <Group key={obj.id} x={obj.x} y={obj.y}>
                <Rect
                  width={obj.w}
                  height={obj.h}
                  fill={obj.fill}
                  stroke={isSelected ? COLORS.accent : obj.stroke}
                  strokeWidth={isSelected ? 3 : 2}
                  dash={[12, 8]}
                  cornerRadius={16}
                  opacity={0.5}
                  shadowBlur={isSelected ? 10 : 0}
                  shadowColor={COLORS.accent}
                  listening={false}
                />
                <Text
                  x={12}
                  y={12}
                  text={obj.label}
                  fill={COLORS.text}
                  fontSize={16}
                  fontStyle="700"
                  listening={false}
                />
              </Group>
            );
          }

          if (obj.type === 'wall') {
            return (
              <Line
                key={obj.id}
                id={obj.id}
                points={toFlat(obj.points || [])}
                stroke={COLORS.wall}
                strokeWidth={obj.thickness || 10}
                lineCap="round"
                lineJoin="round"
                opacity={isSelected ? 0.92 : 0.66}
                shadowBlur={isSelected ? 10 : 0}
                shadowColor={COLORS.accent}
                listening={false}
              />
            );
          }

          if (obj.type === 'note') {
            return (
              <Group key={obj.id} id={obj.id} x={obj.x} y={obj.y} rotation={obj.rotation || 0}>
                <Rect
                  width={obj.w}
                  height={obj.h}
                  fill={obj.fill || COLORS.noteFill}
                  stroke={isSelected ? COLORS.accent : obj.stroke || COLORS.noteStroke}
                  strokeWidth={isSelected ? 2.5 : 1.6}
                  cornerRadius={14}
                  shadowBlur={isSelected ? 14 : 0}
                  shadowColor={COLORS.accent}
                  listening={false}
                />
                <Text
                  x={16}
                  y={16}
                  text={obj.text || "Note"}
                  fill={COLORS.text}
                  fontSize={16}
                  fontStyle="600"
                  listening={false}
                />
              </Group>
            );
          }

          return null;
        })}

        {children}
      </Layer>

      {/* Tables Layer - LISTENING for clicks */}
      <Layer listening={true}>
        {items.filter(obj => obj.type === 'table').map((obj) => {
          const isSelected = selectedIds.includes(obj.id);
          const isHighlighted = highlightedIds.includes(obj.id);
          const liveStatus = showTableStatus ? tableStatusMap[obj.id] : null;
          const statusFill = liveStatus === 'occupied' ? COLORS.tableOccupied :
                            liveStatus === 'reserved' ? COLORS.tableReserved :
                            liveStatus === 'free' ? COLORS.tableFree : obj.fill || COLORS.tableFill;
          const statusStroke = liveStatus === 'occupied' ? COLORS.tableStrokeOccupied :
                              liveStatus === 'reserved' ? COLORS.tableStrokeReserved :
                              liveStatus === 'free' ? COLORS.tableStrokeFree : obj.stroke || COLORS.tableStroke;
          
          // Generate table label: T{table_number}
          const tableNumber = obj.table_number || obj.seats || 1;
          const tableLabel = `T${tableNumber}`;
          
          return (
            <Group
  key={obj.id}
  id={obj.id}
  x={obj.x}
  y={obj.y}
  rotation={obj.rotation || 0}
  listening={true}
  onMouseDown={(e) => {
    e.cancelBubble = true;
    onTableClick?.(obj);
  }}
  onTap={(e) => {
    e.cancelBubble = true;
    onTableClick?.(obj);
  }}
>
  {/* BIG invisible hit box — makes clicking easy */}
  <Rect
    x={-14}
    y={-14}
    width={obj.w + 28}
    height={obj.h + 28}
    fill="transparent"
    listening={true}
  />

  {/* Chair dots */}
  <ChairDots 
    w={obj.w} 
    h={obj.h} 
    seats={obj.seats || 4}
    shape={obj.shape}
  />

  {/* Table shape */}
  {obj.shape === "round" ? (
    <Circle
      x={obj.w / 2}
      y={obj.h / 2}
      radius={obj.w / 2}
      fill={statusFill}
      stroke={statusStroke}
      strokeWidth={3}
      listening={false}
    />
  ) : (
    <Rect
      width={obj.w}
      height={obj.h}
      cornerRadius={8}
      fill={statusFill}
      stroke={statusStroke}
      strokeWidth={3}
      listening={false}
    />
  )}

  {/* Table label */}
  <Text
    x={0}
    y={obj.h / 2 - 16}
    width={obj.w}
    align="center"
    text={`T${obj.table_number ?? obj.label ?? ""}`}
    fill={COLORS.text}
    fontSize={15}
    fontStyle="700"
    listening={false}
  />
  
  {/* Seats label */}
  <Text
    x={0}
    y={obj.h / 2 + 2}
    width={obj.w}
    align="center"
    text={`${obj.seats || 4} seats`}
    fill="#64748b"
    fontSize={11}
    listening={false}
  />
</Group>

          );
        })}
      </Layer>
    </Stage>
  );
}
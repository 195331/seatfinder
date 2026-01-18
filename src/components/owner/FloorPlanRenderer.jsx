import React from 'react';
import { Stage, Layer, Group, Rect, Circle, Line, Text } from 'react-konva';

const COLORS = {
  canvasBg: "#0b1220",
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
  danger: "#ef4444",
  tableFree: "rgba(16,185,129,0.25)",
  tableOccupied: "rgba(245,158,11,0.25)",
  tableReserved: "rgba(59,130,246,0.25)",
  tableStrokeFree: "rgba(16,185,129,0.6)",
  tableStrokeOccupied: "rgba(245,158,11,0.6)",
  tableStrokeReserved: "rgba(59,130,246,0.6)"
};

function toFlat(points) {
  const out = [];
  for (const p of points) out.push(p.x, p.y);
  return out;
}

// Chair nubs for round tables
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
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  return <>{nubs}</>;
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
            <Group
  key={obj.id}
  id={obj.id}
  x={obj.x}
  y={obj.y}
  rotation={obj.rotation || 0}
  onMouseDown={(e) => {
    e.cancelBubble = true;
    console.log("TABLE CLICK ✅", obj.id, obj.table_number, obj.seats);
    onTableClick?.(obj);
  }}
  onTap={(e) => {
    e.cancelBubble = true;
    console.log("TABLE TAP ✅", obj.id, obj.table_number, obj.seats);
    onTableClick?.(obj);
  }}
>

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
              onMouseDown={(e) => {
                e.cancelBubble = true;
                onTableClick?.(obj);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onTableClick?.(obj);
              }}
            >
              {/* Invisible hit area for easier clicking */}
              {obj.shape === 'round' ? (
                <Circle
                  x={obj.w / 2}
                  y={obj.h / 2}
                  radius={obj.w / 2 + 10}
                  fill="transparent"
                  listening={true}
                />
              ) : (
                <Rect
                  x={-10}
                  y={-10}
                  width={obj.w + 20}
                  height={obj.h + 20}
                  fill="transparent"
                  listening={true}
                />
              )}
              {obj.shape === 'round' && <ChairNubs w={obj.w} h={obj.h} seats={obj.seats} />}

              {obj.shape === 'round' ? (
                <Circle
                  x={obj.w / 2}
                  y={obj.h / 2}
                  radius={obj.w / 2}
                  fill={statusFill}
                  stroke={isSelected ? COLORS.accent : isHighlighted ? '#3B82F6' : statusStroke}
                  strokeWidth={isSelected || isHighlighted ? 3 : 2}
                  shadowBlur={isSelected || isHighlighted ? 14 : 0}
                  shadowColor={isSelected ? COLORS.accent : '#3B82F6'}
                  listening={false}
                />
              ) : (
                <Rect
                  width={obj.w}
                  height={obj.h}
                  fill={statusFill}
                  stroke={isSelected ? COLORS.accent : isHighlighted ? '#3B82F6' : statusStroke}
                  strokeWidth={isSelected || isHighlighted ? 3 : 2}
                  cornerRadius={14}
                  shadowBlur={isSelected || isHighlighted ? 14 : 0}
                  shadowColor={isSelected ? COLORS.accent : '#3B82F6'}
                  listening={false}
                />
              )}

              {/* Table Label */}
              <Text
                x={0}
                y={-4}
                width={obj.w}
                height={obj.h / 2}
                align="center"
                verticalAlign="middle"
                text={tableLabel}
                fill={COLORS.text}
                fontSize={16}
                fontStyle="700"
                listening={false}
              />

              {/* Seat Count */}
              <Text
                x={0}
                y={obj.h / 2 + 4}
                width={obj.w}
                height={obj.h / 2}
                align="center"
                verticalAlign="middle"
                text={`${obj.seats} seats`}
                fill={COLORS.subtext}
                fontSize={12}
                listening={false}
              />

              {obj.locked && (
                <Text
                  x={obj.w - 18}
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
      </Layer>
    </Stage>
  );
}
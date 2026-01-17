import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, ZoomIn, ZoomOut, Maximize2, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import moment from 'moment';

const STATUS_COLORS = {
  free: { bg: '#10B981', text: 'Free', emoji: '🟢' },
  occupied: { bg: '#F59E0B', text: 'Seated', emoji: '🟡' },
  reserved: { bg: '#3B82F6', text: 'Reserved', emoji: '🔵' }
};

export default function LiveSeatingFloor({ 
  floorPlan, 
  tables = [], 
  reservations = [],
  selectedTable, 
  onTableClick,
  highlightedTables = []
}) {
  const stageRef = useRef(null);
  const [zoom, setZoom] = useState(0.5);
  const [stagePos, setStagePos] = useState({ x: 20, y: 20 });
  const [activeLayer, setActiveLayer] = useState('main');

  const fitToContent = () => {
    if (!floorPlan?.objects?.length) return;
    
    const tableObjs = floorPlan.objects.filter(o => o.type === 'table');
    if (tableObjs.length === 0) return;

    const xs = tableObjs.map(t => t.x);
    const ys = tableObjs.map(t => t.y);
    const minX = Math.min(...xs) - 100;
    const minY = Math.min(...ys) - 100;
    const maxX = Math.max(...xs.map((x, i) => x + (tableObjs[i].width || 80))) + 100;
    const maxY = Math.max(...ys.map((y, i) => y + (tableObjs[i].height || 80))) + 100;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const containerW = 1000;
    const containerH = 600;

    const scaleX = containerW / contentW;
    const scaleY = containerH / contentH;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.85;

    setZoom(newZoom);
    setStagePos({
      x: (containerW - contentW * newZoom) / 2 - minX * newZoom,
      y: (containerH - contentH * newZoom) / 2 - minY * newZoom
    });
  };

  useEffect(() => {
    if (floorPlan?.objects?.length) {
      fitToContent();
    }
  }, [floorPlan?.objects?.length]);

  const getTableStatus = (tableObj) => {
    const liveTable = tables.find(t => t.label === tableObj.label);
    if (!liveTable) return 'free';
    
    // Check if table is reserved
    const now = new Date();
    const hasActiveReservation = reservations.some(res => {
      if (!res.table_id || res.status !== 'approved') return false;
      const resTable = tables.find(t => t.id === res.table_id);
      if (!resTable || resTable.label !== tableObj.label) return false;
      
      const resDate = new Date(res.reservation_date);
      const [hours, minutes] = (res.reservation_time || '00:00').split(':');
      resDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const timeDiff = Math.abs(now - resDate) / (1000 * 60);
      return timeDiff < 120;
    });

    if (hasActiveReservation) return 'reserved';
    return liveTable.status || 'free';
  };

  const getSeatedDuration = (tableObj) => {
    const liveTable = tables.find(t => t.label === tableObj.label);
    if (!liveTable?.seated_at) return null;
    return moment().diff(moment(liveTable.seated_at), 'minutes');
  };

  // Handle new floor plan structure with rooms
  const currentRoom = floorPlan?.rooms?.[activeLayer];
  const visibleObjects = currentRoom?.items || floorPlan?.objects?.filter(o => o.layer === activeLayer) || [];
  const visibleZones = currentRoom?.zones || [];
  const visibleWalls = currentRoom?.walls || [];
  const roomBoundary = currentRoom?.roomBoundary || [];
  
  const layers = floorPlan?.rooms 
    ? Object.keys(floorPlan.rooms) 
    : [...new Set(floorPlan?.objects?.map(o => o.layer) || ['main'])];

  return (
    <Card className="border-0 shadow-lg h-full">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-500" />
            Live Floor Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            {layers.length > 1 && (
              <div className="flex gap-1 mr-2">
                {layers.map(layer => (
                  <Button
                    key={layer}
                    size="sm"
                    variant={activeLayer === layer ? 'default' : 'outline'}
                    onClick={() => setActiveLayer(layer)}
                  >
                    {layer}
                  </Button>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Badge variant="outline" className="px-3">{Math.round(zoom * 100)}%</Badge>
            <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={fitToContent}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {Object.entries(STATUS_COLORS).map(([status, info]) => (
            <Badge key={status} variant="outline" className="text-xs gap-1">
              <span>{info.emoji}</span>
              {info.text}
            </Badge>
          ))}
        </div>

        {/* Canvas */}
        <div className="bg-slate-50 rounded-xl overflow-hidden mx-auto" style={{ width: 'fit-content' }}>
          <Stage
            ref={stageRef}
            width={1000}
            height={600}
            scaleX={zoom}
            scaleY={zoom}
            x={stagePos.x}
            y={stagePos.y}
            draggable
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          >
            <Layer>
              {/* Background */}
              <Rect width={2400} height={1700} fill="#0b1220" />

              {/* Room Boundary */}
              {roomBoundary.length >= 3 && (
                <Line
                  points={roomBoundary.flatMap(p => [p.x, p.y]).concat([roomBoundary[0].x, roomBoundary[0].y])}
                  closed
                  fill="rgba(34,197,94,0.10)"
                  stroke="rgba(34,197,94,0.38)"
                  strokeWidth={2}
                  listening={false}
                />
              )}

              {/* Zones */}
              {visibleZones.map(zone => (
                <Group key={zone.id} x={zone.x} y={zone.y}>
                  <Rect
                    width={zone.w}
                    height={zone.h}
                    fill={zone.fill}
                    stroke={zone.stroke}
                    strokeWidth={2}
                    dash={[12, 8]}
                    cornerRadius={16}
                    opacity={0.5}
                    listening={false}
                  />
                  <Text
                    x={12}
                    y={12}
                    text={zone.label}
                    fill="rgba(255,255,255,0.92)"
                    fontSize={16}
                    fontStyle="700"
                    listening={false}
                  />
                </Group>
              ))}

              {/* Walls */}
              {visibleWalls.map(wall => (
                <Line
                  key={wall.id}
                  points={wall.points?.flatMap(p => [p.x, p.y]) || []}
                  stroke="rgba(255,255,255,0.42)"
                  strokeWidth={wall.thickness || 10}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              ))}

              {/* Tables */}
              {visibleObjects.map(obj => {
                if (obj.type === 'table') {
                  const liveTable = tables.find(t => t.floorplan_item_id === obj.id);
                  const status = liveTable?.status || 'free';
                  const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.free;
                  const isSelected = selectedTable?.id === liveTable?.id;
                  const isHighlighted = highlightedTables.includes(liveTable?.id);
                  const duration = liveTable?.seated_at ? moment().diff(moment(liveTable.seated_at), 'minutes') : null;

                  return (
                    <Group
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation || 0}
                      onClick={() => liveTable && onTableClick?.(liveTable)}
                      onTap={() => liveTable && onTableClick?.(liveTable)}
                    >
                      {/* Table */}
                      {obj.shape === 'round' ? (
                        <Circle
                          x={obj.w / 2}
                          y={obj.h / 2}
                          radius={obj.w / 2}
                          fill={statusInfo.bg}
                          stroke={isSelected ? '#22c55e' : (isHighlighted ? '#3B82F6' : '#ffffff')}
                          strokeWidth={isSelected || isHighlighted ? 3 : 2}
                        />
                      ) : (
                        <Rect
                          width={obj.w}
                          height={obj.h}
                          fill={statusInfo.bg}
                          stroke={isSelected ? '#22c55e' : (isHighlighted ? '#3B82F6' : '#ffffff')}
                          strokeWidth={isSelected || isHighlighted ? 3 : 2}
                          cornerRadius={14}
                        />
                      )}

                      {/* Label */}
                      <Text
                        x={0}
                        y={0}
                        width={obj.w}
                        height={obj.h}
                        text={obj.label}
                        fontSize={18}
                        fontStyle="700"
                        fill="#ffffff"
                        align="center"
                        verticalAlign="middle"
                        listening={false}
                      />

                      {/* Duration Badge */}
                      {status === 'occupied' && duration && (
                        <Group y={obj.h + 5}>
                          <Rect
                            width={60}
                            height={20}
                            fill="#ffffff"
                            cornerRadius={10}
                            stroke="#F59E0B"
                            strokeWidth={1}
                          />
                          <Text
                            text={`⏱ ${duration}m`}
                            fontSize={9}
                            fill="#F59E0B"
                            fontStyle="bold"
                            width={60}
                            align="center"
                            y={6}
                          />
                        </Group>
                      )}
                    </Group>
                  );
                }

                if (obj.type === 'note') {
                  return (
                    <Group key={obj.id} x={obj.x} y={obj.y}>
                      <Rect
                        width={obj.w}
                        height={obj.h}
                        fill={obj.fill || 'rgba(59,130,246,0.10)'}
                        stroke={obj.stroke || 'rgba(59,130,246,0.35)'}
                        strokeWidth={1.6}
                        cornerRadius={14}
                        listening={false}
                      />
                      <Text
                        x={16}
                        y={16}
                        text={obj.text || 'Note'}
                        fill="rgba(255,255,255,0.92)"
                        fontSize={16}
                        fontStyle="600"
                        listening={false}
                      />
                    </Group>
                  );
                }

                return null;
              })}
            </Layer>
          </Stage>
        </div>
      </CardContent>
    </Card>
  );
}
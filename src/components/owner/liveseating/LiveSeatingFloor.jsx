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

  const visibleObjects = floorPlan?.objects?.filter(o => o.layer === activeLayer) || [];
  const layers = [...new Set(floorPlan?.objects?.map(o => o.layer) || ['main'])];

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
              <Rect width={2000} height={1400} fill="#ffffff" />

              {/* Objects */}
              {visibleObjects.map(obj => {
                if (obj.type === 'table') {
                  const status = getTableStatus(obj);
                  const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.free;
                  const isSelected = selectedTable?.label === obj.label;
                  const isHighlighted = highlightedTables.some(id => {
                    const t = tables.find(tb => tb.id === id);
                    return t?.label === obj.label;
                  });
                  const duration = getSeatedDuration(obj);

                  return (
                    <Group
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation || 0}
                      onClick={() => {
                        const liveTable = tables.find(t => t.label === obj.label);
                        if (liveTable) onTableClick?.(liveTable);
                      }}
                      onTap={() => {
                        const liveTable = tables.find(t => t.label === obj.label);
                        if (liveTable) onTableClick?.(liveTable);
                      }}
                    >
                      {/* Shadow */}
                      {obj.shape === 'round' ? (
                        <Circle
                          radius={(obj.width || 80) / 2}
                          fill="#00000015"
                          offsetY={-4}
                        />
                      ) : (
                        <Rect
                          width={obj.width || 80}
                          height={obj.height || 80}
                          fill="#00000015"
                          offsetY={-4}
                          cornerRadius={obj.shape === 'booth' ? 12 : 8}
                        />
                      )}

                      {/* Table */}
                      {obj.shape === 'round' ? (
                        <Circle
                          radius={(obj.width || 80) / 2}
                          fill={statusInfo.bg}
                          stroke={isSelected ? '#10B981' : (isHighlighted ? '#3B82F6' : statusInfo.bg)}
                          strokeWidth={isSelected || isHighlighted ? 4 : 0}
                        />
                      ) : (
                        <Rect
                          width={obj.width || 80}
                          height={obj.height || 80}
                          fill={statusInfo.bg}
                          stroke={isSelected ? '#10B981' : (isHighlighted ? '#3B82F6' : statusInfo.bg)}
                          strokeWidth={isSelected || isHighlighted ? 4 : 0}
                          cornerRadius={obj.shape === 'booth' ? 12 : 8}
                        />
                      )}

                      {/* Label */}
                      <Text
                        text={obj.label}
                        fontSize={13}
                        fontStyle="bold"
                        fill="#ffffff"
                        width={obj.width || 80}
                        align="center"
                        y={obj.shape === 'round' ? 0 : ((obj.height || 80) / 2) - 18}
                        offsetY={obj.shape === 'round' ? ((obj.width || 80) / 4) : 0}
                      />
                      <Text
                        text={`${obj.seats} seats`}
                        fontSize={10}
                        fill="#ffffff"
                        opacity={0.9}
                        width={obj.width || 80}
                        align="center"
                        y={obj.shape === 'round' ? 0 : ((obj.height || 80) / 2) + 2}
                        offsetY={obj.shape === 'round' ? -((obj.width || 80) / 8) : 0}
                      />

                      {/* Duration Badge */}
                      {status === 'occupied' && duration && (
                        <Group y={(obj.height || 80) + 5}>
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

                if (obj.type === 'text') {
                  return (
                    <Text
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      text={obj.text}
                      fontSize={obj.fontSize || 18}
                      fill={obj.fill || '#111827'}
                      fontStyle="bold"
                      listening={false}
                    />
                  );
                }

                if (obj.type === 'wall') {
                  return (
                    <Line
                      key={obj.id}
                      points={obj.points}
                      stroke={obj.stroke || '#111827'}
                      strokeWidth={obj.strokeWidth || 6}
                      lineCap="round"
                      listening={false}
                    />
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
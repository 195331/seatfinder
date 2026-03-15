import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, ZoomIn, ZoomOut, Maximize2, Link2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import moment from 'moment';
import FloorPlanRenderer from '../FloorPlanRenderer';
import TableCombinationEngine from './TableCombinationEngine';

// Universal color system: Available=emerald, Arrived Early=amber, Occupied=red, Reserved=blue
const STATUS_COLORS = {
  free:          { bg: '#10B981', text: 'Available',            emoji: '🟢' },
  arrived_early: { bg: '#F59E0B', text: 'Arrived Early',        emoji: '🟡' },
  occupied:      { bg: '#EF4444', text: 'Occupied / Checked In', emoji: '🔴' },
  reserved:      { bg: '#3B82F6', text: 'Reserved',             emoji: '🔵' },
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
  const [camera, setCamera] = useState({ x: -260, y: -140, scale: 1.18 });
  const [activeLayer, setActiveLayer] = useState('MAIN');
  const [linkModeActive, setLinkModeActive] = useState(false);
  const [combinedIds, setCombinedIds] = useState([]); // floorplan_item_ids that are combined

  const clampScale = (s) => Math.max(0.35, Math.min(2.4, s));

  const fitToContent = () => {
    const boundary = currentRoom?.roomBoundary;
    if (!boundary || boundary.length < 3) {
      setCamera({ x: -260, y: -140, scale: 1.18 });
      return;
    }
    const xs = boundary.map((p) => p.x);
    const ys = boundary.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const pad = 80;
    const boxW = (maxX - minX) + pad * 2;
    const boxH = (maxY - minY) + pad * 2;

    const viewW = 800;
    const viewH = 500;

    const scale = clampScale(Math.min(viewW / boxW, viewH / boxH));
    const x = -(minX - pad) * scale + 20;
    const y = -(minY - pad) * scale + 20;
    setCamera({ x, y, scale });
  };

  // Handle new floor plan structure with rooms
  const currentRoom = floorPlan?.rooms?.[activeLayer];
  const layers = floorPlan?.rooms ? Object.keys(floorPlan.rooms) : ['MAIN'];

  // Build table status map (combined tables get 'combined' status → purple)
  const tableStatusMap = useMemo(() => {
    const map = {};
    for (const t of tables) {
      if (t?.floorplan_item_id) {
        const isGroupBooking = t.party_name?.startsWith('GROUP_BOOKING_');
        map[t.floorplan_item_id] = isGroupBooking ? 'combined' : t.status;
      }
    }
    // Also mark pending combination selections
    for (const fpId of combinedIds) {
      map[fpId] = 'combined';
    }
    return map;
  }, [tables, combinedIds]);

  // Build centre map for SVG overlay lines
  const centreMap = useMemo(() => {
    const map = {};
    const roomItems = Object.values(floorPlan?.rooms || {}).flatMap(r => r?.items || []);
    for (const item of roomItems) {
      if (item.type === 'table') {
        map[item.id] = {
          x: item.x + (item.w || 80) / 2,
          y: item.y + (item.h || 80) / 2,
        };
      }
    }
    return map;
  }, [floorPlan]);

  // Convert stage coords → overlay pixel
  const toPixel = ({ x, y }) => ({
    px: x * camera.scale + camera.x,
    py: y * camera.scale + camera.y,
  });

  // Build SVG link lines for currently combined IDs
  const linkLines = useMemo(() => {
    const lines = [];
    const ids = combinedIds.filter(id => centreMap[id]);
    for (let i = 0; i < ids.length - 1; i++) {
      const a = centreMap[ids[i]];
      const b = centreMap[ids[i + 1]];
      if (a && b) {
        const { px: x1, py: y1 } = toPixel(a);
        const { px: x2, py: y2 } = toPixel(b);
        lines.push({ x1, y1, x2, y2, key: `${ids[i]}-${ids[i + 1]}` });
      }
    }
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedIds, centreMap, camera]);

  // Build highlighted tables
  const highlightedIds = useMemo(() => {
    return highlightedTables.map(id => {
      const t = tables.find(tb => tb.id === id);
      return t?.floorplan_item_id;
    }).filter(Boolean);
  }, [highlightedTables, tables]);

  const selectedTableItemId = useMemo(() => {
    return tables.find(t => t.id === selectedTable?.id)?.floorplan_item_id;
  }, [selectedTable, tables]);

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
            {/* Link Mode toggle */}
            <Button
              size="sm"
              variant={linkModeActive ? 'default' : 'outline'}
              onClick={() => { setLinkModeActive(v => !v); setCombinedIds([]); }}
              className={linkModeActive ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' : 'border-purple-300 text-purple-700 hover:bg-purple-50'}
            >
              <Link2 className="w-4 h-4 mr-1" />
              {linkModeActive ? 'Exit Link Mode' : 'Link Mode'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCamera(c => ({ ...c, scale: clampScale(c.scale * 0.88) }))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Badge variant="outline" className="px-3">{Math.round(camera.scale * 100)}%</Badge>
            <Button size="sm" variant="outline" onClick={() => setCamera(c => ({ ...c, scale: clampScale(c.scale * 1.12) }))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={fitToContent}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Link Mode Panel */}
        {linkModeActive && (
          <div className="border-2 border-purple-300 bg-purple-50/60 rounded-xl p-4">
            <TableCombinationEngine
              tables={tables}
              reservations={reservations}
              floorPlan={floorPlan}
              camera={camera}
              onCombinationConfirmed={(ids) => {
                setCombinedIds(ids);
                setLinkModeActive(false);
              }}
              onClose={() => { setLinkModeActive(false); setCombinedIds([]); }}
            />
          </div>
        )}

        {/* Canvas - with clipping */}
        <div className="bg-slate-900 rounded-xl mx-auto border-2 border-slate-700 relative w-full" style={{ height: 500, overflow: 'hidden', pointerEvents: 'auto' }}>
          {/* SVG overlay for dashed link lines */}
          {linkLines.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none z-10"
              width="100%"
              height="100%"
            >
              {linkLines.map(({ x1, y1, x2, y2, key }) => (
                <line
                  key={key}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="8 5"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          )}
          <FloorPlanRenderer
            stageRef={stageRef}
            width={800}
            height={500}
            camera={camera}
            roomData={currentRoom}
            showGrid={true}
            showZones={true}
            showTableStatus={true}
            tableStatusMap={tableStatusMap}
            selectedIds={selectedTableItemId ? [selectedTableItemId] : []}
            highlightedIds={highlightedIds}
            onTableClick={(tableObj) => {
              if (tableObj.type === 'table') {
                console.log("Owner table click:", tableObj);
                const liveTable = tables.find(t => t.floorplan_item_id === tableObj.id);
                if (liveTable) onTableClick?.(liveTable);
              }
            }}
            draggable={true}
            onDragEnd={(e) => setCamera(c => ({ ...c, x: e.target.x(), y: e.target.y() }))}
            onWheel={(e) => {
              e.evt.preventDefault();
              const st = stageRef.current;
              if (!st) return;
              const pointer = st.getPointerPosition();
              if (!pointer) return;

              const direction = e.evt.deltaY > 0 ? -1 : 1;
              const factor = direction > 0 ? 1.08 : 0.92;
              
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

              setCamera({ x: newPos.x, y: newPos.y, scale: newScale });
            }}
            readOnly={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}
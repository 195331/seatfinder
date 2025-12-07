import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import moment from 'moment';

const STATUS_COLORS = {
  free: { bg: '#10B981', text: 'Free', emoji: '🟢' },
  seated: { bg: '#F59E0B', text: 'Seated', emoji: '🟡' },
  dirty: { bg: '#F97316', text: 'Needs Cleaning', emoji: '🟠' },
  reserved: { bg: '#3B82F6', text: 'Reserved', emoji: '🔵' },
  closed: { bg: '#94A3B8', text: 'Closed', emoji: '⚪' }
};

export default function LiveSeatingFloor({ 
  floorPlan, 
  tables = [], 
  selectedTable, 
  onTableClick,
  highlightedTables = []
}) {
  const [zoom, setZoom] = useState(1);

  const getTableData = (floorTable) => {
    return tables.find(t => t.label === floorTable.label) || floorTable;
  };

  const getSeatedDuration = (table) => {
    if (!table.seated_at) return null;
    return moment().diff(moment(table.seated_at), 'minutes');
  };

  return (
    <Card className="border-0 shadow-lg h-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-500" />
            Live Floor Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
            <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 overflow-auto">
        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {Object.entries(STATUS_COLORS).map(([status, info]) => (
            <Badge key={status} variant="outline" className="text-xs gap-1">
              <span>{info.emoji}</span>
              {info.text}
            </Badge>
          ))}
        </div>

        {/* Floor Plan Canvas */}
        <div className="bg-slate-100 rounded-xl overflow-hidden mx-auto" style={{ width: 'fit-content' }}>
          <div
            className="relative bg-white"
            style={{
              width: 1000 * zoom,
              height: 700 * zoom
            }}
          >
            {/* Grid */}
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              <defs>
                <pattern id="liveGrid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse">
                  <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#liveGrid)" />
            </svg>

            {/* Areas */}
            {floorPlan.areas.map(area => (
              <div
                key={area.id}
                className="absolute border-2 border-dashed rounded-lg pointer-events-none"
                style={{
                  left: area.x * zoom,
                  top: area.y * zoom,
                  width: area.width * zoom,
                  height: area.height * zoom,
                  backgroundColor: `${area.color}10`,
                  borderColor: `${area.color}40`
                }}
              >
                <div
                  className="absolute -top-2.5 left-2 px-2 py-0.5 rounded text-white font-medium"
                  style={{ backgroundColor: area.color, fontSize: 10 * zoom }}
                >
                  {area.name}
                </div>
              </div>
            ))}

            {/* Tables */}
            <TooltipProvider>
              {floorPlan.tables.map(floorTable => {
                const table = getTableData(floorTable);
                const statusInfo = STATUS_COLORS[table.status] || STATUS_COLORS.free;
                const isSelected = selectedTable?.id === table.id;
                const isHighlighted = highlightedTables.includes(table.id);
                const duration = getSeatedDuration(table);

                return (
                  <Tooltip key={table.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "absolute flex flex-col items-center justify-center cursor-pointer transition-all border-2",
                          isSelected && "ring-4 ring-emerald-400 z-30",
                          isHighlighted && "ring-4 ring-blue-300 animate-pulse z-20",
                          !isSelected && !isHighlighted && "hover:shadow-lg z-10",
                          table.shape === 'circle' && "rounded-full",
                          table.shape === 'square' && "rounded-lg",
                          (table.shape === 'rectangle' || table.shape === 'large') && "rounded-lg"
                        )}
                        style={{
                          left: table.x * zoom,
                          top: table.y * zoom,
                          width: table.width * zoom,
                          height: table.height * zoom,
                          backgroundColor: statusInfo.bg,
                          borderColor: isSelected ? '#10B981' : statusInfo.bg
                        }}
                        onClick={() => onTableClick(table)}
                      >
                        <div className="text-white text-center pointer-events-none">
                          <div className="font-bold" style={{ fontSize: 12 * zoom }}>{table.label}</div>
                          <div className="opacity-90" style={{ fontSize: 9 * zoom }}>{table.capacity} seats</div>
                        </div>
                        {table.status === 'seated' && duration && (
                          <div 
                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-1.5 py-0.5 rounded-full shadow-sm border border-amber-200"
                            style={{ fontSize: 8 * zoom }}
                          >
                            <Clock className="w-2 h-2 inline mr-0.5" />
                            {duration}m
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold">{table.label} ({table.capacity} seats)</div>
                        <div className="text-xs">Status: {statusInfo.emoji} {statusInfo.text}</div>
                        {table.status === 'seated' && table.party_name && (
                          <>
                            <div className="text-xs">Party: {table.party_name} ({table.party_size || table.capacity})</div>
                            {duration && <div className="text-xs">Seated: {duration} minutes ago</div>}
                          </>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
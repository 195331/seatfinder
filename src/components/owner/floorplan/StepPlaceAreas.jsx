import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GRID_SIZE = 40;
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export default function StepPlaceAreas({ floorPlan, onChange, onNext, onBack }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingArea, setDraggingArea] = useState(null);
  const [resizingArea, setResizingArea] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState([]);

  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const handleAreaMouseDown = (e, area, isResize = false) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (isResize) {
      setResizingArea(area.id);
      setResizeStart({ x: e.clientX, y: e.clientY, width: area.width, height: area.height });
    } else {
      setDraggingArea(area.id);
      setDragOffset({ x: x - area.x, y: y - area.y });
    }
  };

  const findAlignmentGuides = useCallback((currentArea) => {
    const guides = [];
    const threshold = 5;

    floorPlan.areas.forEach(area => {
      if (area.id === currentArea.id) return;

      // Horizontal alignment
      if (Math.abs(currentArea.y - area.y) < threshold) {
        guides.push({ type: 'horizontal', pos: area.y, start: Math.min(currentArea.x, area.x), end: Math.max(currentArea.x + currentArea.width, area.x + area.width) });
      }
      if (Math.abs((currentArea.y + currentArea.height) - (area.y + area.height)) < threshold) {
        guides.push({ type: 'horizontal', pos: area.y + area.height, start: Math.min(currentArea.x, area.x), end: Math.max(currentArea.x + currentArea.width, area.x + area.width) });
      }

      // Vertical alignment
      if (Math.abs(currentArea.x - area.x) < threshold) {
        guides.push({ type: 'vertical', pos: area.x, start: Math.min(currentArea.y, area.y), end: Math.max(currentArea.y + currentArea.height, area.y + area.height) });
      }
      if (Math.abs((currentArea.x + currentArea.width) - (area.x + area.width)) < threshold) {
        guides.push({ type: 'vertical', pos: area.x + area.width, start: Math.min(currentArea.y, area.y), end: Math.max(currentArea.y + currentArea.height, area.y + area.height) });
      }
    });

    return guides;
  }, [floorPlan.areas]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (draggingArea) {
      const area = floorPlan.areas.find(a => a.id === draggingArea);
      if (!area) return;

      let newX = snapToGrid(Math.max(0, Math.min(CANVAS_WIDTH - area.width, x - dragOffset.x)));
      let newY = snapToGrid(Math.max(0, Math.min(CANVAS_HEIGHT - area.height, y - dragOffset.y)));

      const updatedArea = { ...area, x: newX, y: newY };
      const guides = findAlignmentGuides(updatedArea);
      setAlignmentGuides(guides);

      onChange({
        areas: floorPlan.areas.map(a => a.id === draggingArea ? updatedArea : a)
      });
    }

    if (resizingArea && resizeStart) {
      const newWidth = snapToGrid(Math.max(GRID_SIZE * 3, resizeStart.width + (e.clientX - resizeStart.x) / zoom));
      const newHeight = snapToGrid(Math.max(GRID_SIZE * 3, resizeStart.height + (e.clientY - resizeStart.y) / zoom));
      onChange({
        areas: floorPlan.areas.map(a => a.id === resizingArea ? { ...a, width: newWidth, height: newHeight } : a)
      });
    }
  }, [draggingArea, resizingArea, dragOffset, resizeStart, zoom, pan, floorPlan.areas, onChange, findAlignmentGuides]);

  const handleMouseUp = useCallback(() => {
    setDraggingArea(null);
    setResizingArea(null);
    setResizeStart(null);
    setAlignmentGuides([]);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Position Your Areas</h2>
          <p className="text-sm text-slate-600">Drag to move, resize from bottom-right corner</p>
        </div>
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

      <div className="bg-slate-100 p-2 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-600">
          Areas snap to grid automatically. Blue guides appear when areas align perfectly.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden relative">
        <div
          ref={canvasRef}
          className="relative bg-slate-800"
          style={{
            width: CANVAS_WIDTH * zoom,
            height: CANVAS_HEIGHT * zoom,
            transformOrigin: '0 0'
          }}
        >
          {/* Grid */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            <defs>
              <pattern id="placeGrid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#placeGrid)" />

            {/* Alignment Guides */}
            {alignmentGuides.map((guide, idx) => (
              guide.type === 'horizontal' ? (
                <line
                  key={idx}
                  x1={guide.start * zoom}
                  y1={guide.pos * zoom}
                  x2={guide.end * zoom}
                  y2={guide.pos * zoom}
                  stroke="#60A5FA"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              ) : (
                <line
                  key={idx}
                  x1={guide.pos * zoom}
                  y1={guide.start * zoom}
                  x2={guide.pos * zoom}
                  y2={guide.end * zoom}
                  stroke="#60A5FA"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )
            ))}
          </svg>

          {/* Areas */}
          {floorPlan.areas.map(area => (
            <div
              key={area.id}
              className="absolute border-2 border-white rounded-lg shadow-lg cursor-move transition-shadow hover:shadow-xl"
              style={{
                left: area.x * zoom,
                top: area.y * zoom,
                width: area.width * zoom,
                height: area.height * zoom,
                backgroundColor: `${area.color}40`,
                borderColor: area.color
              }}
              onMouseDown={(e) => handleAreaMouseDown(e, area)}
            >
              <div
                className="absolute -top-3 left-2 px-2 py-0.5 text-xs font-semibold rounded text-white"
                style={{ backgroundColor: area.color }}
              >
                {area.name}
              </div>
              <div
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize rounded-tl-lg"
                style={{ backgroundColor: area.color }}
                onMouseDown={(e) => handleAreaMouseDown(e, area, true)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={onNext} className="gap-2 bg-emerald-600 hover:bg-emerald-700" size="lg">
          Continue to Tables
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
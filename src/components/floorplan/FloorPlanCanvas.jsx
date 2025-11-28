import React, { useRef, useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Circle, Square, RectangleHorizontal, Armchair } from 'lucide-react';

const TABLE_SIZE = {
  2: { width: 50, height: 50 },
  4: { width: 60, height: 60 },
  6: { width: 80, height: 60 },
  10: { width: 120, height: 60 },
};

const getTableSize = (seats, shape) => {
  if (TABLE_SIZE[seats]) return TABLE_SIZE[seats];
  // Custom sizes based on seats
  const baseSize = 40 + (seats * 8);
  if (shape === 'rectangle' || shape === 'booth') {
    return { width: baseSize * 1.5, height: baseSize * 0.8 };
  }
  return { width: baseSize, height: baseSize };
};

const TableShape = ({ table, isSelected, onSelect, onDrag, zoom }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const size = getTableSize(table.seats, table.shape);

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - table.x * zoom,
      y: e.clientY - table.y * zoom
    });
    onSelect(table.id);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = (e.clientX - dragOffset.x) / zoom;
      const newY = (e.clientY - dragOffset.y) / zoom;
      onDrag(table.id, { x: Math.max(0, newX), y: Math.max(0, newY) });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onDrag, table.id, zoom]);

  const shapeClasses = cn(
    "absolute flex flex-col items-center justify-center cursor-move transition-shadow",
    "border-2 shadow-sm hover:shadow-md",
    isSelected 
      ? "border-emerald-500 ring-2 ring-emerald-200 shadow-lg" 
      : "border-slate-300 hover:border-slate-400",
    table.shape === 'round' && "rounded-full",
    table.shape === 'square' && "rounded-lg",
    table.shape === 'rectangle' && "rounded-lg",
    table.shape === 'booth' && "rounded-xl",
    isDragging && "opacity-80"
  );

  const bgColor = table.shape === 'booth' 
    ? 'bg-amber-50' 
    : 'bg-white';

  return (
    <div
      className={cn(shapeClasses, bgColor)}
      style={{
        left: table.x,
        top: table.y,
        width: size.width,
        height: size.height,
        transform: `rotate(${table.rotation || 0}deg)`,
      }}
      onMouseDown={handleMouseDown}
    >
      <span className="text-xs font-semibold text-slate-700">{table.label}</span>
      <span className="text-[10px] text-slate-500">{table.seats} seats</span>
      {table.isAccessible && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-[8px]">♿</span>
        </div>
      )}
    </div>
  );
};

const AreaOverlay = ({ area, isSelected }) => {
  return (
    <div
      className={cn(
        "absolute border-2 border-dashed rounded-lg transition-all",
        isSelected ? "border-emerald-500" : "border-slate-300"
      )}
      style={{
        left: area.bounds?.x || 50,
        top: area.bounds?.y || 50,
        width: area.bounds?.width || 300,
        height: area.bounds?.height || 200,
        backgroundColor: `${area.color}15`,
      }}
    >
      <div 
        className="absolute -top-3 left-2 px-2 py-0.5 text-xs font-medium rounded"
        style={{ 
          backgroundColor: area.color,
          color: 'white'
        }}
      >
        {area.name}
      </div>
    </div>
  );
};

export default function FloorPlanCanvas({
  zoom,
  areas,
  tables,
  selectedTableId,
  selectedAreaId,
  onSelectTable,
  onUpdateTable,
  onCanvasClick,
  isDraggingNewTable
}) {
  const canvasRef = useRef(null);

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('canvas-grid')) {
      const rect = canvasRef.current.getBoundingClientRect();
      onCanvasClick(e, rect);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDraggingNewTable) {
        // Reset dragging state (handled in parent)
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDraggingNewTable]);

  return (
    <div 
      ref={canvasRef}
      className={cn(
        "relative w-full h-full bg-white rounded-xl border-2 border-slate-200 overflow-hidden",
        isDraggingNewTable && "cursor-crosshair"
      )}
      onClick={handleCanvasClick}
      style={{ minHeight: 400 }}
    >
      {/* Grid Background */}
      <div 
        className="canvas-grid absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #f1f5f9 1px, transparent 1px),
            linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        }}
      />

      {/* Canvas Content */}
      <div 
        className="relative w-full h-full"
        style={{ 
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: `${100 / zoom}%`,
          height: `${100 / zoom}%`,
        }}
      >
        {/* Areas */}
        {areas.map(area => (
          <AreaOverlay 
            key={area.id} 
            area={area} 
            isSelected={selectedAreaId === area.id}
          />
        ))}

        {/* Tables */}
        {tables.map(table => (
          <TableShape
            key={table.id}
            table={table}
            isSelected={selectedTableId === table.id}
            onSelect={onSelectTable}
            onDrag={(id, pos) => onUpdateTable(id, pos)}
            zoom={zoom}
          />
        ))}

        {/* Empty State */}
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-400">
              <div className="text-4xl mb-2">🪑</div>
              <p className="text-sm">Add tables from the palette on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
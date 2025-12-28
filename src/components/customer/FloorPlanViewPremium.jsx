import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, Loader2, LogIn, Sparkles, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

export default function FloorPlanViewPremium({ 
  floorPlanData,
  tables,
  onReserveTable, 
  isSubmitting,
  currentUser 
}) {
  const [selectedTable, setSelectedTable] = useState(null);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [reservationData, setReservationData] = useState({
    date: null,
    time: '',
    partySize: 2,
    notes: ''
  });

  // Extract data from new floor plan format
  const outline = floorPlanData?.outline;
  const items = floorPlanData?.items || [];
  
  // Get tables from items array with status merged from tables prop
  const floorPlanTables = useMemo(() => {
    return items
      .filter(it => it.type === 'table')
      .map(fpTable => {
        // Find matching table entity for status
        const tableEntity = tables.find(t => t.label === fpTable.label);
        return {
          ...fpTable,
          status: tableEntity?.status || 'free',
          id: tableEntity?.id || fpTable.id,
          capacity: fpTable.seats
        };
      });
  }, [items, tables]);

  const areas = items.filter(it => it.type === 'area');
  const walls = items.filter(it => it.type === 'wall');
  const textBoxes = items.filter(it => it.type === 'textBox');

  const handleTableClick = async (table) => {
    if (table.status === 'occupied' || table.status === 'reserved') return;
    
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      setSelectedTable(table);
      setShowLoginDialog(true);
      return;
    }
    
    setSelectedTable(table);
    setReservationData(prev => ({ ...prev, partySize: table.capacity || 2 }));
    setShowReserveDialog(true);
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleSubmitReservation = () => {
    if (!reservationData.date || !reservationData.time) return;
    
    onReserveTable({
      table_id: selectedTable.id,
      reservation_date: format(reservationData.date, 'yyyy-MM-dd'),
      reservation_time: reservationData.time,
      party_size: reservationData.partySize,
      notes: reservationData.notes
    });
    
    setShowReserveDialog(false);
    setSelectedTable(null);
    setReservationData({ date: null, time: '', partySize: 2, notes: '' });
  };

  const availableCount = floorPlanTables.filter(t => t.status === 'free').length;
  const reservedCount = floorPlanTables.filter(t => t.status === 'reserved').length;
  const occupiedCount = floorPlanTables.filter(t => t.status === 'occupied').length;

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <div className="flex flex-wrap gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-900">{availableCount} Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm font-medium text-amber-900">{reservedCount} Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-red-900">{occupiedCount} Occupied</span>
        </div>
      </div>

      {/* Floor Plan Canvas */}
      <div className="relative bg-slate-50 rounded-xl border-2 border-slate-200 overflow-auto">
        <div style={{ minHeight: 500, position: 'relative' }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 2400 1600"
            className="w-full"
            style={{ minHeight: 500 }}
          >
            {/* Subtle grid */}
            <defs>
              <pattern id="customerGridPattern" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="2400" height="1600" fill="url(#customerGridPattern)" />

            {/* Outline */}
            {outline && (
              <rect
                x={outline.x}
                y={outline.y}
                width={outline.w}
                height={outline.h}
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth={3}
                rx={14}
              />
            )}

            {/* Areas (background zones) */}
            {areas.map(area => (
              <g key={area.id}>
                <rect
                  x={area.x}
                  y={area.y}
                  width={area.w}
                  height={area.h}
                  rx={12}
                  fill={area.style?.fill || '#e0f2fe'}
                  opacity={area.style?.opacity || 0.3}
                  stroke={area.style?.stroke || '#60a5fa'}
                  strokeWidth={2}
                  strokeDasharray="6,6"
                />
                <g pointerEvents="none">
                  <rect
                    x={area.x + 12}
                    y={area.y + 10}
                    width={Math.max(70, (area.name?.length || 4) * 8 + 26)}
                    height={26}
                    rx={8}
                    fill={area.style?.stroke || '#60a5fa'}
                    opacity={0.95}
                  />
                  <text x={area.x + 24} y={area.y + 28} fill="#ffffff" fontSize={13} fontWeight={700}>
                    {area.name || "Area"}
                  </text>
                </g>
              </g>
            ))}

            {/* Walls */}
            {walls.map(wall => (
              <line
                key={wall.id}
                x1={wall.x1}
                y1={wall.y1}
                x2={wall.x2}
                y2={wall.y2}
                stroke={wall.style?.stroke || '#111827'}
                strokeWidth={wall.style?.width || 6}
                strokeLinecap="round"
              />
            ))}

            {/* Text Labels */}
            {textBoxes.map(txt => (
              <g key={txt.id}>
                <rect 
                  x={txt.x} 
                  y={txt.y} 
                  width={txt.w} 
                  height={txt.h} 
                  rx={10} 
                  fill="#ffffff" 
                  opacity={0.65} 
                />
                <text 
                  x={txt.x + 10} 
                  y={txt.y + txt.h / 2 + 6} 
                  fill={txt.style?.color || '#111827'} 
                  fontSize={txt.style?.size || 16} 
                  fontWeight={700}
                >
                  {txt.text || "Label"}
                </text>
              </g>
            ))}

            {/* Tables (interactive) */}
            {floorPlanTables.map(table => {
              const isAvailable = table.status === 'free';
              const isSelected = selectedTable?.id === table.id;
              
              const fill = isAvailable ? '#d1fae5' : 
                          table.status === 'reserved' ? '#fef3c7' : '#fee2e2';
              const stroke = isAvailable ? '#10b981' : 
                            table.status === 'reserved' ? '#f59e0b' : '#ef4444';

              const cx = table.x + table.w / 2;
              const cy = table.y + table.h / 2;

              return (
                <g 
                  key={table.id}
                  transform={`rotate(${table.rotation || 0}, ${cx}, ${cy})`}
                  className={cn(
                    "transition-all",
                    isAvailable && "cursor-pointer hover:opacity-80"
                  )}
                  onClick={() => handleTableClick(table)}
                >
                  {/* Shadow */}
                  <ellipse
                    cx={cx}
                    cy={table.y + table.h + 10}
                    rx={table.w / 2}
                    ry={8}
                    fill="#00000012"
                  />

                  {/* Table shape */}
                  {table.shape === 'round' ? (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={Math.min(table.w, table.h) / 2} 
                      fill={fill} 
                      stroke={isSelected ? '#8b5cf6' : stroke} 
                      strokeWidth={isSelected ? 4 : 3}
                      filter={isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : ''}
                    />
                  ) : (
                    <rect 
                      x={table.x} 
                      y={table.y} 
                      width={table.w} 
                      height={table.h} 
                      rx={14} 
                      fill={fill} 
                      stroke={isSelected ? '#8b5cf6' : stroke} 
                      strokeWidth={isSelected ? 4 : 3}
                      filter={isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : ''}
                    />
                  )}

                  {/* Label */}
                  <text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fontWeight={800} fill="#111827">
                    {table.label}
                  </text>
                  <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fontWeight={600} fill="#64748b">
                    {table.seats} seats
                  </text>

                  {/* Status badge */}
                  {!isAvailable && (
                    <g>
                      <circle cx={table.x + table.w - 14} cy={table.y + 14} r={12} fill={stroke} />
                      <text x={table.x + table.w - 14} y={table.y + 18} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={700}>
                        {table.status === 'reserved' ? '⏱' : '✕'}
                      </text>
                    </g>
                  )}

                  {/* Available checkmark */}
                  {isAvailable && (
                    <g opacity={0.5}>
                      <circle cx={table.x + table.w - 14} cy={table.y + 14} r={12} fill="#10b981" />
                      <text x={table.x + table.w - 14} y={table.y + 18} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={700}>
                        ✓
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <p className="text-sm text-slate-500 text-center">
        Click on an available table to request a reservation
      </p>

      {/* Login Required Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Sign In Required</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Create an account to reserve</h3>
              <p className="text-sm text-slate-500 mt-1">
                Sign in with Google or email to make a reservation at this restaurant.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-sm">
              <Users className="w-5 h-5 text-slate-500" />
              <span>Table {selectedTable?.label} • {selectedTable?.capacity || selectedTable?.seats} seats</span>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign In to Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reservation Dialog */}
      <Dialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reserve {selectedTable?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
              <Users className="w-5 h-5 text-emerald-600" />
              <span className="font-medium text-emerald-900">
                Table for up to {selectedTable?.capacity || selectedTable?.seats} people
              </span>
            </div>

            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1.5 justify-start text-left"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reservationData.date ? format(reservationData.date, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={reservationData.date}
                    onSelect={(date) => setReservationData(prev => ({ ...prev, date }))}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Time</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {TIME_SLOTS.map(time => (
                  <Button
                    key={time}
                    variant={reservationData.time === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setReservationData(prev => ({ ...prev, time }))}
                    className={cn(
                      reservationData.time === time && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Party Size</Label>
              <Input
                type="number"
                min={1}
                max={selectedTable?.capacity || selectedTable?.seats || 10}
                value={reservationData.partySize}
                onChange={(e) => setReservationData(prev => ({ 
                  ...prev, 
                  partySize: parseInt(e.target.value) || 1 
                }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Special Requests (optional)</Label>
              <Input
                value={reservationData.notes}
                onChange={(e) => setReservationData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Birthday, dietary needs, etc."
                className="mt-1.5"
              />
            </div>

            <Button
              onClick={handleSubmitReservation}
              disabled={!reservationData.date || !reservationData.time || isSubmitting}
              className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Request Reservation
                </>
              )}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              The restaurant will confirm your reservation request
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
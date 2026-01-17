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
import SpecialRequestsForm from './SpecialRequestsForm';

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
    notes: '',
    seatingPreference: '',
    specialRequests: '',
    dietaryNeeds: [],
    occasion: 'none'
  });

  // Handle new floor plan structure with rooms
  const rooms = floorPlanData?.rooms || {};
  const hasFloorPlan = Object.keys(rooms).length > 0 && floorPlanData?.publishedAt;
  
  const allTables = Object.values(rooms).flatMap(room => 
    (room.items || []).filter(it => it.type === 'table')
  );
  
  // Get tables with status merged from tables prop
  const floorPlanTables = useMemo(() => {
    return allTables.map(fpTable => {
      // Find matching table entity for status
      const tableEntity = tables.find(t => t.floorplan_item_id === fpTable.id);
      return {
        ...fpTable,
        status: tableEntity?.status || 'free',
        id: tableEntity?.id || fpTable.id,
        capacity: fpTable.seats,
        zone_type: tableEntity?.zone_type
      };
    });
  }, [allTables, tables]);

  const allZones = Object.values(rooms).flatMap(room => room.zones || []);
  const allWalls = Object.values(rooms).flatMap(room => room.walls || []);
  const allRoomBoundaries = Object.entries(rooms).map(([id, room]) => ({
    id,
    boundary: room.roomBoundary || []
  }));

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
    
    const notes = reservationData.seatingPreference 
      ? `${reservationData.seatingPreference.charAt(0).toUpperCase() + reservationData.seatingPreference.slice(1)} seating preferred. ${reservationData.notes}`.trim()
      : reservationData.notes;
    
    onReserveTable({
      table_id: selectedTable.id,
      reservation_date: format(reservationData.date, 'yyyy-MM-dd'),
      reservation_time: reservationData.time,
      party_size: reservationData.partySize,
      notes,
      special_requests: reservationData.specialRequests,
      dietary_needs: reservationData.dietaryNeeds,
      occasion: reservationData.occasion
    });
    
    setShowReserveDialog(false);
    setSelectedTable(null);
    setReservationData({ date: null, time: '', partySize: 2, notes: '', seatingPreference: '', specialRequests: '', dietaryNeeds: [], occasion: 'none' });
  };

  const availableCount = floorPlanTables.filter(t => t.status === 'free').length;
  const reservedCount = floorPlanTables.filter(t => t.status === 'reserved').length;
  const occupiedCount = floorPlanTables.filter(t => t.status === 'occupied').length;

  if (!hasFloorPlan) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">This restaurant hasn't set up their floor plan yet</h3>
        <p className="text-slate-600">Try joining the waitlist instead</p>
      </div>
    );
  }

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
      <div className="relative bg-slate-900 rounded-xl border-2 border-slate-700 overflow-auto">
        <div style={{ minHeight: 500, position: 'relative' }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 2400 1700"
            className="w-full"
            style={{ minHeight: 500 }}
          >
            {/* Dark background */}
            <rect width="2400" height="1700" fill="#0b1220" />

            {/* Room Boundaries */}
            {allRoomBoundaries.map(({ id, boundary }) => 
              boundary.length >= 3 && (
                <polygon
                  key={id}
                  points={boundary.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(34,197,94,0.10)"
                  stroke="rgba(34,197,94,0.38)"
                  strokeWidth={2}
                />
              )
            )}

            {/* Zones */}
            {allZones.map(zone => (
              <g key={zone.id}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  rx={16}
                  fill={zone.fill}
                  stroke={zone.stroke}
                  strokeWidth={2}
                  strokeDasharray="12,8"
                  opacity={0.5}
                />
                <text x={zone.x + 12} y={zone.y + 28} fill="rgba(255,255,255,0.92)" fontSize={16} fontWeight={700}>
                  {zone.label}
                </text>
              </g>
            ))}

            {/* Walls */}
            {allWalls.map(wall => (
              <polyline
                key={wall.id}
                points={wall.points?.map(p => `${p.x},${p.y}`).join(' ') || ''}
                fill="none"
                stroke="rgba(255,255,255,0.42)"
                strokeWidth={wall.thickness || 10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
                  {/* Table shape */}
                  {table.shape === 'round' ? (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={Math.min(table.w, table.h) / 2} 
                      fill={fill} 
                      stroke={isSelected ? '#22c55e' : stroke} 
                      strokeWidth={isSelected ? 4 : 3}
                      filter={isSelected ? 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.5))' : ''}
                    />
                  ) : (
                    <rect 
                      x={table.x} 
                      y={table.y} 
                      width={table.w} 
                      height={table.h} 
                      rx={14} 
                      fill={fill} 
                      stroke={isSelected ? '#22c55e' : stroke} 
                      strokeWidth={isSelected ? 4 : 3}
                      filter={isSelected ? 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.5))' : ''}
                    />
                  )}

                  {/* Label */}
                  <text x={cx} y={cy} textAnchor="middle" fontSize={18} fontWeight={700} fill="#ffffff">
                    {table.label}
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
              <Label>Seating Preference (optional)</Label>
              <select
                value={reservationData.seatingPreference || ''}
                onChange={(e) => setReservationData(prev => ({ ...prev, seatingPreference: e.target.value }))}
                className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">No preference</option>
                <option value="window">Window seat</option>
                <option value="booth">Booth</option>
                <option value="outdoor">Outdoor</option>
                <option value="bar">Bar seating</option>
                <option value="quiet">Quiet area</option>
              </select>
            </div>

            {/* Special Requests Form */}
            <SpecialRequestsForm
              specialRequests={reservationData.specialRequests}
              dietaryNeeds={reservationData.dietaryNeeds}
              occasion={reservationData.occasion}
              onSpecialRequestsChange={(val) => setReservationData(prev => ({ ...prev, specialRequests: val }))}
              onDietaryNeedsChange={(val) => setReservationData(prev => ({ ...prev, dietaryNeeds: val }))}
              onOccasionChange={(val) => setReservationData(prev => ({ ...prev, occasion: val }))}
              showAITip={true}
            />

            <div>
              <Label>Additional Notes (optional)</Label>
              <Input
                value={reservationData.notes}
                onChange={(e) => setReservationData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any other information..."
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
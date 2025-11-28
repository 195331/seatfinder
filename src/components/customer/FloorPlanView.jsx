import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Users, Loader2, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const GRID_SIZE = 40;
const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

const TABLE_TYPES = [
  { seats: 2, shape: 'circle', label: '2 Seats' },
  { seats: 4, shape: 'square', label: '4 Seats' },
  { seats: 6, shape: 'rectangle', label: '6 Seats' },
  { seats: 10, shape: 'large', label: '10 Seats' },
];

export default function FloorPlanView({ 
  tables, 
  areas, 
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

  const handleTableClick = async (table) => {
    if (table.status === 'occupied' || table.status === 'reserved') return;
    
    // Check if user is logged in
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      setSelectedTable(table);
      setShowLoginDialog(true);
      return;
    }
    
    setSelectedTable(table);
    setReservationData(prev => ({ ...prev, partySize: table.capacity || table.seats }));
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

  const getTableShape = (table) => {
    const seats = table.capacity || table.seats;
    const tableType = TABLE_TYPES.find(t => t.seats === seats) || TABLE_TYPES[1];
    
    const isAvailable = table.status === 'free';
    const isSelected = selectedTable?.id === table.id;
    
    const width = tableType.shape === 'circle' ? 40 : 
                  tableType.shape === 'square' ? 50 :
                  tableType.shape === 'rectangle' ? 80 : 100;
    const height = tableType.shape === 'circle' ? 40 : 
                   tableType.shape === 'square' ? 50 : 50;

    const baseClasses = cn(
      "absolute flex items-center justify-center transition-all border-2",
      isAvailable 
        ? "cursor-pointer hover:scale-105 hover:shadow-lg" 
        : "cursor-not-allowed opacity-60",
      isSelected && "ring-2 ring-emerald-400 scale-105",
      tableType.shape === 'circle' && "rounded-full",
      tableType.shape === 'square' && "rounded-lg",
      (tableType.shape === 'rectangle' || tableType.shape === 'large') && "rounded-lg"
    );

    const colorClasses = isAvailable 
      ? "bg-emerald-50 border-emerald-400 hover:bg-emerald-100"
      : table.status === 'reserved' 
        ? "bg-amber-50 border-amber-400"
        : "bg-red-50 border-red-400";

    return (
      <div
        key={table.id}
        className={cn(baseClasses, colorClasses)}
        style={{
          left: table.position_x || table.x || 100,
          top: table.position_y || table.y || 100,
          width,
          height,
        }}
        onClick={() => handleTableClick(table)}
      >
        <div className="text-center pointer-events-none">
          <div className="text-xs font-bold text-slate-700">{table.label}</div>
          <div className="text-[10px] text-slate-500">{seats}</div>
        </div>
        {tableType.shape === 'large' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-slate-300 absolute" />
            <div className="w-0.5 h-full bg-slate-300 absolute" />
          </div>
        )}
      </div>
    );
  };

  // Calculate canvas dimensions from tables/areas
  const canvasWidth = Math.max(600, ...tables.map(t => (t.position_x || t.x || 0) + 120));
  const canvasHeight = Math.max(400, ...tables.map(t => (t.position_y || t.y || 0) + 100));

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400" />
          <span className="text-sm text-slate-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-100 border-2 border-amber-400" />
          <span className="text-sm text-slate-600">Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-400" />
          <span className="text-sm text-slate-600">Occupied</span>
        </div>
        <div className="ml-auto flex gap-3">
          {TABLE_TYPES.map(type => (
            <div key={type.seats} className="flex items-center gap-1.5">
              <div className={cn(
                "w-5 h-5 border-2 border-slate-400 flex items-center justify-center text-[8px] font-bold bg-white",
                type.shape === 'circle' && "rounded-full",
                type.shape === 'square' && "rounded",
                (type.shape === 'rectangle' || type.shape === 'large') && "rounded w-7 h-4"
              )}>
                {type.seats}
              </div>
              <span className="text-xs text-slate-500">{type.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floor Plan */}
      <div 
        className="relative bg-white rounded-xl border-2 border-slate-200 overflow-auto"
        style={{ minHeight: 400 }}
      >
        <div style={{ width: canvasWidth, height: canvasHeight, position: 'relative' }}>
          {/* Grid */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            <defs>
              <pattern id="customerGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#f1f5f9" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#customerGrid)" />
          </svg>

          {/* Areas */}
          {areas.map(area => (
            <div
              key={area.id}
              className="absolute border-2 border-dashed rounded-lg pointer-events-none"
              style={{
                left: area.x || 40,
                top: area.y || 40,
                width: area.width || 300,
                height: area.height || 200,
                backgroundColor: `${area.color || '#3B82F6'}15`,
                borderColor: area.color || '#3B82F6',
              }}
            >
              <div
                className="absolute -top-3 left-2 px-2 py-0.5 text-xs font-medium rounded text-white"
                style={{ backgroundColor: area.color || '#3B82F6' }}
              >
                {area.name}
              </div>
            </div>
          ))}

          {/* Tables */}
          {tables.map(table => getTableShape(table))}

          {/* Empty state */}
          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-slate-400">No floor plan available</p>
            </div>
          )}
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
            <p className="text-xs text-slate-400">
              You'll be redirected back here after signing in
            </p>
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
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Users className="w-5 h-5 text-slate-500" />
              <span className="font-medium">
                Table for {selectedTable?.capacity || selectedTable?.seats} people
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
                'Request Reservation'
              )}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              The restaurant will confirm or decline your reservation request
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
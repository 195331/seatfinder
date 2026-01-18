import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, Loader2, LogIn, CheckCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import SpecialRequestsForm from './SpecialRequestsForm';
import FloorPlanRenderer from '../owner/FloorPlanRenderer';

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
  const stageRef = useRef(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [camera, setCamera] = useState({ x: -260, y: -140, scale: 1.18 });
  const [activeLayer, setActiveLayer] = useState('MAIN');
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
  const layers = hasFloorPlan ? Object.keys(rooms) : [];
  
  const currentRoom = rooms[activeLayer];

  // Build table status map
  const tableStatusMap = useMemo(() => {
    const map = {};
    for (const t of tables) {
      if (t?.floorplan_item_id) {
        map[t.floorplan_item_id] = t.status;
      }
    }
    return map;
  }, [tables]);

  const selectedTableItemId = useMemo(() => {
    return tables.find(t => t.id === selectedTable?.id)?.floorplan_item_id;
  }, [selectedTable, tables]);

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

    const viewW = 1180;
    const viewH = 600;

    const scale = clampScale(Math.min(viewW / boxW, viewH / boxH));
    const x = -(minX - pad) * scale + 20;
    const y = -(minY - pad) * scale + 20;
    setCamera({ x, y, scale });
  };

  const handleTableClick = async (tableObj) => {
    // Find the actual table entity
    const tableEntity = tables.find(t => t.floorplan_item_id === tableObj.id);
    if (!tableEntity) return;
    if (tableEntity.status === 'occupied' || tableEntity.status === 'reserved') return;
    
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      setSelectedTable(tableEntity);
      setShowLoginDialog(true);
      return;
    }
    
    setSelectedTable(tableEntity);
    setReservationData(prev => ({ ...prev, partySize: tableObj.seats || 2 }));
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

  const availableCount = tables.filter(t => t.status === 'free').length;
  const reservedCount = tables.filter(t => t.status === 'reserved').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;

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

      {/* Floor Plan Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {layers.length > 1 && layers.map(layer => (
            <Button
              key={layer}
              size="sm"
              variant={activeLayer === layer ? 'default' : 'outline'}
              onClick={() => setActiveLayer(layer)}
              className="rounded-full"
            >
              {layer}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Floor Plan Canvas */}
      <div className="relative bg-slate-900 rounded-xl border-2 border-slate-700 overflow-hidden" style={{ height: 600 }}>
        <FloorPlanRenderer
          stageRef={stageRef}
          width={1180}
          height={600}
          camera={camera}
          roomData={currentRoom}
          showGrid={true}
          showZones={true}
          showTableStatus={true}
          tableStatusMap={tableStatusMap}
          selectedIds={selectedTableItemId ? [selectedTableItemId] : []}
          highlightedIds={[]}
          onTableClick={(tableObj) => {
            if (tableObj.type === 'table') {
              console.log("Customer table click:", tableObj);
              handleTableClick(tableObj);
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

      <p className="text-sm text-slate-500 text-center mt-4">
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
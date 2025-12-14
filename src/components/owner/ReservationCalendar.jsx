import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Check, X, Clock, Filter, Edit, List, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import moment from 'moment';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 10); // 10 AM - 11 PM

export default function ReservationCalendar({ restaurantId, restaurantName }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newReservation, setNewReservation] = useState({ party_size: 2 });
  const [isEditing, setIsEditing] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', area: 'all' });
  const [skipRules, setSkipRules] = useState(true);

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId, moment(currentDate).format('YYYY-MM')],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 1000),
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas', restaurantId],
    queryFn: () => base44.entities.RestaurantArea.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reservation.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
      setShowNewDialog(false);
      setNewReservation({ party_size: 2 });
      toast.success('Reservation created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reservation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservations']);
      setSelectedReservation(null);
      toast.success('Reservation updated');
    }
  });

  const dayReservations = useMemo(() => {
    let filtered = reservations.filter(r => 
      moment(r.reservation_date).format('YYYY-MM-DD') === moment(currentDate).format('YYYY-MM-DD')
    );
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    if (filters.area !== 'all') {
      const areaTables = tables.filter(t => t.area_id === filters.area).map(t => t.id);
      filtered = filtered.filter(r => areaTables.includes(r.table_id));
    }
    
    return filtered;
  }, [reservations, currentDate, filters, tables]);
  
  const checkConflict = (date, time, partySize, excludeId = null) => {
    const timeSlot = reservations.filter(r => 
      r.id !== excludeId &&
      r.reservation_date === date &&
      r.reservation_time === time &&
      r.status !== 'cancelled' &&
      r.status !== 'declined'
    );
    const totalPartySize = timeSlot.reduce((sum, r) => sum + r.party_size, 0) + partySize;
    const capacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    return totalPartySize > capacity * 0.9; // 90% capacity warning
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'declined': return 'bg-red-500';
      case 'cancelled': return 'bg-slate-400';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Reservation Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setView('day')}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm transition-all",
                    view === 'day' ? "bg-white shadow-sm font-medium" : "text-slate-600"
                  )}
                >
                  Day
                </button>
                <button
                  onClick={() => setView('week')}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm transition-all",
                    view === 'week' ? "bg-white shadow-sm font-medium" : "text-slate-600"
                  )}
                >
                  Week
                </button>
                <button
                  onClick={() => setView('month')}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm transition-all",
                    view === 'month' ? "bg-white shadow-sm font-medium" : "text-slate-600"
                  )}
                >
                  Month
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Confirmed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
                {areas.length > 0 && (
                  <Select value={filters.area} onValueChange={(v) => setFilters({ ...filters, area: v })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {areas.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={() => setShowNewDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(moment(currentDate).subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate())}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <h3 className="font-semibold text-lg">
                {view === 'month' ? moment(currentDate).format('MMMM YYYY') :
                 view === 'week' ? `Week of ${moment(currentDate).startOf('week').format('MMM D')}` :
                 moment(currentDate).format('dddd, MMMM D, YYYY')}
              </h3>
              <Button variant="link" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(moment(currentDate).add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate())}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Views */}
          {view === 'day' && (
            <DayView
              date={currentDate}
              reservations={dayReservations}
              onSelectReservation={setSelectedReservation}
              onClickTimeSlot={(hour) => {
                setNewReservation({
                  party_size: 2,
                  reservation_date: moment(currentDate).format('YYYY-MM-DD'),
                  reservation_time: `${hour}:00`
                });
                setShowNewDialog(true);
              }}
              getStatusColor={getStatusColor}
            />
          )}

          {view === 'week' && (
            <WeekView
              date={currentDate}
              reservations={reservations}
              onSelectReservation={setSelectedReservation}
              getStatusColor={getStatusColor}
            />
          )}

          {view === 'month' && (
            <MonthView
              date={currentDate}
              reservations={reservations}
              onSelectDate={(date) => {
                setCurrentDate(date);
                setView('day');
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => { setSelectedReservation(null); setIsEditing(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{isEditing ? 'Edit Reservation' : 'Reservation Details'}</DialogTitle>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4 pt-4">
              {!isEditing ? (
                <>
                  <div>
                    <p className="text-sm text-slate-500">Guest</p>
                    <p className="font-semibold">{selectedReservation.user_name}</p>
                    <p className="text-sm text-slate-600">{selectedReservation.user_email}</p>
                    <p className="text-sm text-slate-600">{selectedReservation.user_phone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Party Size</p>
                      <p className="font-semibold">{selectedReservation.party_size} people</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Status</p>
                      <Badge className={getStatusColor(selectedReservation.status)}>
                        {selectedReservation.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date & Time</p>
                    <p className="font-semibold">
                      {moment(selectedReservation.reservation_date).format('MMM D, YYYY')} at {selectedReservation.reservation_time}
                    </p>
                  </div>
                  {selectedReservation.notes && (
                    <div>
                      <p className="text-sm text-slate-500">Notes</p>
                      <p className="text-sm">{selectedReservation.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-4">
                    {selectedReservation.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => updateMutation.mutate({ id: selectedReservation.id, data: { status: 'approved' } })}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => updateMutation.mutate({ id: selectedReservation.id, data: { status: 'declined' } })}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                      </>
                    )}
                    {selectedReservation.status === 'approved' && (
                      <>
                        <Button
                          onClick={() => updateMutation.mutate({ id: selectedReservation.id, data: { status: 'cancelled' } })}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            await base44.entities.WaitlistEntry.create({
                              restaurant_id: restaurantId,
                              guest_name: selectedReservation.user_name,
                              guest_phone: selectedReservation.user_phone || selectedReservation.user_email,
                              party_size: selectedReservation.party_size,
                              notes: selectedReservation.notes,
                              status: 'waiting'
                            });
                            await updateMutation.mutateAsync({ id: selectedReservation.id, data: { status: 'cancelled' } });
                            toast.success('Moved to waitlist');
                          }}
                          className="flex-1"
                        >
                          <List className="w-4 h-4 mr-2" />
                          Move to Waitlist
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Guest Name</Label>
                    <Input
                      value={selectedReservation.user_name}
                      onChange={(e) => setSelectedReservation({ ...selectedReservation, user_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={selectedReservation.reservation_date}
                        onChange={(e) => setSelectedReservation({ ...selectedReservation, reservation_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={selectedReservation.reservation_time}
                        onChange={(e) => setSelectedReservation({ ...selectedReservation, reservation_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Party Size</Label>
                    <Input
                      type="number"
                      min="1"
                      value={selectedReservation.party_size}
                      onChange={(e) => setSelectedReservation({ ...selectedReservation, party_size: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={selectedReservation.notes || ''}
                      onChange={(e) => setSelectedReservation({ ...selectedReservation, notes: e.target.value })}
                    />
                  </div>
                  {checkConflict(selectedReservation.reservation_date, selectedReservation.reservation_time, selectedReservation.party_size, selectedReservation.id) && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-sm text-amber-800">Warning: This time slot may exceed capacity</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        updateMutation.mutate({
                          id: selectedReservation.id,
                          data: {
                            user_name: selectedReservation.user_name,
                            reservation_date: selectedReservation.reservation_date,
                            reservation_time: selectedReservation.reservation_time,
                            party_size: selectedReservation.party_size,
                            notes: selectedReservation.notes
                          }
                        });
                        setIsEditing(false);
                      }}
                      className="flex-1"
                    >
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Reservation Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Guest Name</Label>
              <Input
                value={newReservation.user_name || ''}
                onChange={(e) => setNewReservation({ ...newReservation, user_name: e.target.value })}
                placeholder="Guest name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newReservation.reservation_date || moment(currentDate).format('YYYY-MM-DD')}
                  onChange={(e) => setNewReservation({ ...newReservation, reservation_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newReservation.reservation_time || '19:00'}
                  onChange={(e) => setNewReservation({ ...newReservation, reservation_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Party Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={newReservation.party_size}
                  onChange={(e) => setNewReservation({ ...newReservation, party_size: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Table</Label>
                <Select
                  value={newReservation.table_id}
                  onValueChange={(v) => setNewReservation({ ...newReservation, table_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label} ({t.capacity} seats)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={newReservation.user_phone || ''}
                onChange={(e) => setNewReservation({ ...newReservation, user_phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={newReservation.user_email || ''}
                onChange={(e) => setNewReservation({ ...newReservation, user_email: e.target.value })}
                placeholder="Email"
              />
            </div>
            <div>
              <Label>Area (optional)</Label>
              <Select
                value={newReservation.area_id}
                onValueChange={(v) => setNewReservation({ ...newReservation, area_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newReservation.notes || ''}
                onChange={(e) => setNewReservation({ ...newReservation, notes: e.target.value })}
                placeholder="Special requests, allergies, highchair..."
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Skip auto-reservation rules</p>
                <p className="text-xs text-slate-500">Confirm immediately without rule checks</p>
              </div>
              <Switch checked={skipRules} onCheckedChange={setSkipRules} />
            </div>
            {checkConflict(newReservation.reservation_date, newReservation.reservation_time, newReservation.party_size) && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-800">Warning: This time slot may exceed capacity</p>
              </div>
            )}
            <Button
              onClick={() => createMutation.mutate({ ...newReservation, status: skipRules ? 'approved' : 'pending' })}
              disabled={!newReservation.user_name || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? 'Creating...' : skipRules ? 'Confirm Reservation' : 'Create & Apply Rules'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayView({ date, reservations, onSelectReservation, onClickTimeSlot, getStatusColor }) {
  return (
    <div className="space-y-2">
      {HOURS.map(hour => {
        const hourReservations = reservations.filter(r => {
          const resHour = parseInt(r.reservation_time?.split(':')[0] || 0);
          return resHour === hour;
        });

        return (
          <div key={hour} className="flex gap-4 min-h-[60px] border-b border-slate-100">
            <div className="w-20 text-sm text-slate-500 pt-1">
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
            <div 
              className="flex-1 flex gap-2 flex-wrap py-1 cursor-pointer hover:bg-slate-50 rounded transition-colors"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onClickTimeSlot(hour);
                }
              }}
            >
              {hourReservations.map(res => (
                <button
                  key={res.id}
                  onClick={() => onSelectReservation(res)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-left text-white text-sm hover:opacity-80 transition-opacity",
                    getStatusColor(res.status)
                  )}
                >
                  <p className="font-medium">{res.user_name || 'Walk-in'}</p>
                  <p className="text-xs opacity-90">{res.party_size} people • {res.reservation_time}</p>
                </button>
              ))}
              {hourReservations.length === 0 && (
                <span className="text-xs text-slate-400 self-center ml-2">Click to add reservation</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ date, reservations, onSelectReservation, getStatusColor }) {
  const weekDays = Array.from({ length: 7 }, (_, i) => moment(date).startOf('week').add(i, 'days'));

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map(day => {
        const dayReservations = reservations.filter(r =>
          moment(r.reservation_date).format('YYYY-MM-DD') === day.format('YYYY-MM-DD')
        );

        return (
          <div key={day.format('YYYY-MM-DD')} className="border rounded-lg p-3">
            <p className="font-semibold text-sm mb-2">{day.format('ddd D')}</p>
            <div className="space-y-1">
              {dayReservations.slice(0, 5).map(res => (
                <button
                  key={res.id}
                  onClick={() => onSelectReservation(res)}
                  className={cn(
                    "w-full px-2 py-1 rounded text-white text-xs text-left hover:opacity-80",
                    getStatusColor(res.status)
                  )}
                >
                  {res.reservation_time} • {res.party_size}p
                </button>
              ))}
              {dayReservations.length > 5 && (
                <p className="text-xs text-slate-500 text-center">+{dayReservations.length - 5} more</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ date, reservations, onSelectDate }) {
  const monthStart = moment(date).startOf('month');
  const monthEnd = moment(date).endOf('month');
  const calendarStart = moment(monthStart).startOf('week');
  const calendarEnd = moment(monthEnd).endOf('week');

  const days = [];
  let currentDay = calendarStart.clone();
  while (currentDay.isSameOrBefore(calendarEnd)) {
    days.push(currentDay.clone());
    currentDay.add(1, 'day');
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="text-center text-sm font-medium text-slate-600 p-2">
          {day}
        </div>
      ))}
      {days.map(day => {
        const dayReservations = reservations.filter(r =>
          moment(r.reservation_date).format('YYYY-MM-DD') === day.format('YYYY-MM-DD')
        );
        const isCurrentMonth = day.month() === monthStart.month();

        return (
          <button
            key={day.format('YYYY-MM-DD')}
            onClick={() => onSelectDate(day.toDate())}
            className={cn(
              "aspect-square p-2 rounded-lg border hover:border-slate-300 transition-all",
              isCurrentMonth ? "bg-white" : "bg-slate-50 text-slate-400"
            )}
          >
            <p className={cn("text-sm font-medium mb-1", day.isSame(moment(), 'day') && "text-emerald-600")}>
              {day.format('D')}
            </p>
            {dayReservations.length > 0 && (
              <div className={cn(
                "w-6 h-6 rounded-full text-xs flex items-center justify-center text-white mx-auto",
                dayReservations.length > 10 ? "bg-red-500" : dayReservations.length > 5 ? "bg-amber-500" : "bg-emerald-500"
              )}>
                {dayReservations.length}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
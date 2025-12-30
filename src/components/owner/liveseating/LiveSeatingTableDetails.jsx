import React, { useState } from 'react';
import { Users, Clock, Edit, Trash2, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import moment from 'moment';

const STATUS_COLORS = {
  free: { color: 'emerald', label: 'Free', emoji: '🟢' },
  seated: { color: 'amber', label: 'Seated', emoji: '🟡' },
  dirty: { color: 'orange', label: 'Needs Cleaning', emoji: '🟠' },
  reserved: { color: 'blue', label: 'Reserved', emoji: '🔵' },
  closed: { color: 'slate', label: 'Closed', emoji: '⚪' }
};

export default function LiveSeatingTableDetails({ 
  table, 
  onStatusChange, 
  onSeatParty,
  waitlist = [],
  tables = [],
  isUpdating 
}) {
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [seatMode, setSeatMode] = useState('waitlist'); // 'waitlist' or 'walkin'
  const [selectedWaitlistId, setSelectedWaitlistId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInSize, setWalkInSize] = useState('');
  const [notes, setNotes] = useState(table?.notes || '');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');

  if (!table) {
    return (
      <Card className="border-0 shadow-lg h-full">
        <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">No Table Selected</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Click on a table in the floor plan to view details and take actions
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = STATUS_COLORS[table.status] || STATUS_COLORS.free;
  const seatedDuration = table.seated_at ? moment().diff(moment(table.seated_at), 'minutes') : 0;

  const handleSeatParty = () => {
    if (seatMode === 'waitlist' && selectedWaitlistId) {
      const entry = waitlist.find(w => w.id === selectedWaitlistId);
      onSeatParty({
        tableId: table.id,
        waitlistEntryId: entry.id,
        partyName: entry.guest_name,
        partySize: entry.party_size
      });
    } else if (seatMode === 'walkin' && walkInSize) {
      onSeatParty({
        tableId: table.id,
        partyName: walkInName || 'Walk-in',
        partySize: parseInt(walkInSize),
        isWalkIn: true
      });
    }
    setShowSeatDialog(false);
    setWalkInName('');
    setWalkInSize('');
    setSelectedWaitlistId('');
  };

  const handleMoveParty = () => {
    if (!targetTableId) return;
    
    onStatusChange(targetTableId, 'seated', {
      party_name: table.party_name,
      party_size: table.party_size,
      seated_at: table.seated_at,
      notes: table.notes
    });
    onStatusChange(table.id, 'dirty');
    setShowMoveDialog(false);
  };

  return (
    <>
      <Card className="border-0 shadow-lg h-full">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{table.label}</CardTitle>
            <Badge className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-700`}>
              {statusInfo.emoji} {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Table Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Capacity</span>
              <span className="font-medium">{table.capacity} seats</span>
            </div>
            {table.area_id && (
              <div className="flex justify-between">
                <span className="text-slate-500">Area</span>
                <span className="font-medium">
                  {tables.find(t => t.area_id === table.area_id)?.area_name || 'N/A'}
                </span>
              </div>
            )}
          </div>

          {/* Party Details (if seated) */}
          {table.status === 'seated' && (
            <div className="p-3 bg-amber-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">
                  {table.party_name || 'Walk-in'}
                </span>
                <Badge variant="outline">{table.party_size || table.capacity} guests</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-3 h-3" />
                Seated {seatedDuration} minutes ago
              </div>
              {table.notes && (
                <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-amber-200">
                  {table.notes}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {table.status === 'free' && (
              <Button
                onClick={() => setShowSeatDialog(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
              >
                <Users className="w-4 h-4 mr-2" />
                Seat Party
              </Button>
            )}

            {table.status === 'seated' && (
              <>
                <Button
                  onClick={() => onStatusChange(table.id, 'dirty')}
                  disabled={isUpdating}
                  variant="outline"
                  className="w-full h-10"
                >
                  Mark as Dirty
                </Button>
                <Button
                  onClick={() => setShowMoveDialog(true)}
                  variant="outline"
                  className="w-full h-10 gap-2"
                >
                  Move to Another Table
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}

            {table.status === 'dirty' && (
              <Button
                onClick={() => onStatusChange(table.id, 'free')}
                disabled={isUpdating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Clean
              </Button>
            )}

            {table.status === 'free' && (
              <Button
                onClick={() => onStatusChange(table.id, 'closed')}
                disabled={isUpdating}
                variant="outline"
                className="w-full"
              >
                Close Table
              </Button>
            )}

            {table.status === 'closed' && (
              <Button
                onClick={() => onStatusChange(table.id, 'free')}
                disabled={isUpdating}
                className="w-full"
              >
                Reopen Table
              </Button>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs text-slate-500">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onStatusChange(table.id, table.status, { notes })}
              placeholder="Add notes..."
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seat Party Dialog */}
      <Dialog open={showSeatDialog} onOpenChange={setShowSeatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat Party at {table.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Button
                variant={seatMode === 'waitlist' ? 'default' : 'outline'}
                onClick={() => setSeatMode('waitlist')}
                className="flex-1"
              >
                From Waitlist
              </Button>
              <Button
                variant={seatMode === 'walkin' ? 'default' : 'outline'}
                onClick={() => setSeatMode('walkin')}
                className="flex-1"
              >
                Walk-in
              </Button>
            </div>

            {seatMode === 'waitlist' ? (
              <div>
                <Label>Select Party</Label>
                <Select value={selectedWaitlistId} onValueChange={setSelectedWaitlistId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose from waitlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {(waitlist || []).map((entry, idx) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        #{idx + 1} - {entry.guest_name || 'Guest'} (Party of {entry.party_size})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Party Name (Optional)</Label>
                  <Input
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="Walk-in"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Party Size *</Label>
                  <Input
                    type="number"
                    value={walkInSize}
                    onChange={(e) => setWalkInSize(e.target.value)}
                    placeholder="Number of guests"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleSeatParty}
              disabled={seatMode === 'waitlist' ? !selectedWaitlistId : !walkInSize}
              className="w-full"
            >
              Seat Party
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Party Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {table.party_name || 'Party'} to Another Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Label>Select Destination Table</Label>
            <Select value={targetTableId} onValueChange={setTargetTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose table" />
              </SelectTrigger>
              <SelectContent>
                {(tables || []).filter(t => t?.status === 'free' && t?.id !== table?.id).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} ({t.capacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleMoveParty} disabled={!targetTableId} className="w-full">
              Move Party
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
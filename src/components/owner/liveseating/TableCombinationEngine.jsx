import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Link2Off, CheckCircle2, X, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * TableCombinationEngine
 *
 * Props:
 *   tables          — full list of live Table records
 *   reservations    — list of Reservation records for today
 *   floorPlan       — current floorPlan object (for computing canvas positions)
 *   camera          — { x, y, scale } of the Konva stage (for SVG overlay math)
 *   onCombinationConfirmed(tableIds, reservationId) — callback after confirm
 *   onClose()       — dismiss / exit link mode
 */
export default function TableCombinationEngine({
  tables = [],
  reservations = [],
  floorPlan,
  camera,
  onCombinationConfirmed,
  onClose,
}) {
  const [pendingIds, setPendingIds] = useState([]);
  const [targetReservationId, setTargetReservationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Large-party reservations (> 6 guests) that haven't been linked yet
  const largeParyReservations = reservations.filter(
    r => r.party_size > 6 && !r.combined_table_ids?.length
  );

  // Build a map: floorplan_item_id → canvas centre (in stage coords)
  const centreMap = React.useMemo(() => {
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

  // Toggle a table into/out of the pending list (max 6)
  const toggle = (table) => {
    const fpId = table.floorplan_item_id || table.id;
    setPendingIds(prev =>
      prev.includes(fpId)
        ? prev.filter(id => id !== fpId)
        : prev.length < 6 ? [...prev, fpId] : prev
    );
  };

  const isSelected = (table) => {
    const fpId = table.floorplan_item_id || table.id;
    return pendingIds.includes(fpId);
  };

  // Convert stage coords → SVG overlay pixel coords
  const toPixel = ({ x, y }) => ({
    px: x * camera.scale + camera.x,
    py: y * camera.scale + camera.y,
  });

  // Build SVG link lines between selected table centres
  const linkLines = [];
  for (let i = 0; i < pendingIds.length - 1; i++) {
    const a = centreMap[pendingIds[i]];
    const b = centreMap[pendingIds[i + 1]];
    if (a && b) {
      const { px: x1, py: y1 } = toPixel(a);
      const { px: x2, py: y2 } = toPixel(b);
      linkLines.push({ x1, y1, x2, y2, key: `${pendingIds[i]}-${pendingIds[i + 1]}` });
    }
  }

  const handleConfirm = async () => {
    if (pendingIds.length < 2) return;
    setSaving(true);
    try {
      // Mark tables as 'combined' (purple) using a party_name sentinel
      for (const fpId of pendingIds) {
        const liveTable = tables.find(t => t.floorplan_item_id === fpId || t.id === fpId);
        if (liveTable) {
          await base44.entities.Table.update(liveTable.id, {
            status: 'occupied',
            party_name: `GROUP_BOOKING_${pendingIds.join('_')}`,
          });
        }
      }
      // Link to reservation if one was selected
      if (targetReservationId) {
        await base44.entities.Reservation.update(targetReservationId, {
          combined_table_ids: pendingIds,
        });
      }
      setConfirmed(true);
      onCombinationConfirmed?.(pendingIds, targetReservationId);
    } catch (e) {
      console.error('Combination save failed', e);
    }
    setSaving(false);
  };

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-purple-500" />
        <p className="font-bold text-slate-800">Tables Linked!</p>
        <p className="text-sm text-slate-500">{pendingIds.length} tables combined for group booking.</p>
        <Button onClick={onClose} size="sm" variant="outline">Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-slate-800 text-sm">Link Mode — Select Tables to Combine</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Large party alert */}
      {largeParyReservations.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
              Combo Alert — Large Party Reservations
            </span>
          </div>
          <div className="space-y-1">
            {largeParyReservations.map(r => (
              <button
                key={r.id}
                onClick={() => setTargetReservationId(r.id === targetReservationId ? '' : r.id)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                  targetReservationId === r.id
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-purple-200 text-slate-700 hover:border-purple-400'
                }`}
              >
                <span className="font-semibold">{r.user_name || 'Guest'}</span>
                {' · '}
                <span className="font-bold text-purple-700" style={targetReservationId === r.id ? { color: '#e9d5ff' } : {}}>
                  {r.party_size} guests
                </span>
                {' · '}
                {r.reservation_time}
              </button>
            ))}
          </div>
          <p className="text-xs text-purple-600 mt-2">Tap a reservation to link it after confirming.</p>
        </div>
      )}

      {/* Table selection grid */}
      <div>
        <p className="text-xs text-slate-500 mb-2">
          Select 2–6 tables to combine ({pendingIds.length} selected):
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => toggle(table)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-all ${
                isSelected(table)
                  ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-200'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
              }`}
            >
              <span className="text-base">{isSelected(table) ? '🟣' : '⬜'}</span>
              <span>{table.label || `T${table.id?.slice(-3)}`}</span>
              <span className="text-[10px] opacity-75">{table.capacity} seats</span>
              {isSelected(table) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-700 rounded-full text-white text-[9px] flex items-center justify-center">
                  {pendingIds.indexOf(table.floorplan_item_id || table.id) + 1}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Overlay description (visual feedback handled in LiveSeatingFloor via prop) */}
      {pendingIds.length >= 2 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700 flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          Dashed link lines are shown on the floor map between selected tables.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          onClick={handleConfirm}
          disabled={pendingIds.length < 2 || saving}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm"
        >
          {saving ? 'Saving…' : `Confirm Combination (${pendingIds.length} tables)`}
        </Button>
        <Button onClick={onClose} variant="outline" size="sm">
          <Link2Off className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
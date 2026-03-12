import { base44 } from '@/api/base44Client';

/**
 * Checks whether a given table is already booked at the specified date/time.
 * Considers approved, arrived_early, and checked_in reservations as "active".
 * A conflict occurs when the same table has an active reservation on the same date
 * within a 2-hour window (before or after) of the requested time.
 *
 * @param {string} tableId
 * @param {string} date - "YYYY-MM-DD"
 * @param {string} time - "HH:MM"
 * @param {string|null} excludeReservationId - skip this reservation (useful for reschedule checks)
 * @returns {Promise<{ conflict: boolean, conflicting: object|null }>}
 */
export async function checkTableConflict(tableId, date, time, excludeReservationId = null) {
  if (!tableId || !date || !time) return { conflict: false, conflicting: null };

  const activeStatuses = ['approved', 'arrived_early', 'checked_in', 'pending'];
  const existing = await base44.entities.Reservation.filter({
    table_id: tableId,
    reservation_date: date,
  });

  const requestedMinutes = timeToMinutes(time);

  const conflicting = (existing || []).find(r => {
    if (excludeReservationId && r.id === excludeReservationId) return false;
    if (!activeStatuses.includes(r.status)) return false;
    const existingMinutes = timeToMinutes(r.reservation_time);
    // 2-hour window overlap guard
    return Math.abs(requestedMinutes - existingMinutes) < 120;
  });

  return { conflict: !!conflicting, conflicting: conflicting || null };
}

/**
 * Converts "HH:MM" string to total minutes from midnight.
 */
function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
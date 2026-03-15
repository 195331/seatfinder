/**
 * Seating Automation Backend Function
 *
 * Handles three triggers:
 *  1. reservation_confirmed — called via entity automation when a reservation status changes to "approved"
 *                             Decreases available_seats by party_size immediately.
 *  2. reservation_seated    — called when a reservation status changes to "checked_in"
 *                             Decreases available_seats by party_size immediately.
 *  3. pos_table_paid        — called by POS when a table is marked "paid" or "closed"
 *                             Increases available_seats by table capacity after a 10-min grace period.
 *
 * Payload:
 *   { trigger: "reservation_confirmed", reservation_id, party_size, restaurant_id }
 *   { trigger: "reservation_seated",    reservation_id, party_size, restaurant_id }
 *   { trigger: "pos_table_paid",        table_id, restaurant_id }
 *
 * Entity automation payload (auto-called):
 *   { event: { type, entity_name, entity_id }, data: <reservation>, old_data: <reservation> }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // ── Entity Automation payload (reservation status change) ─────────────────
    // When triggered by entity automation, body has: event, data, old_data
    if (body.event && body.data && body.event.entity_name === 'Reservation') {
      const reservation = body.data;
      const oldReservation = body.old_data;

      // Only act when status changes TO 'approved' (confirmed)
      if (reservation.status === 'approved' && oldReservation?.status !== 'approved') {
        const restId = reservation.restaurant_id;
        const restaurants = await base44.asServiceRole.entities.Restaurant.filter({ id: restId });
        const restaurant = restaurants?.[0];
        if (!restaurant || restaurant.manual_override_active) {
          // Skip if manual override is active — owner is managing manually
          return Response.json({ success: true, message: 'Manual override active, skipping auto-deduct' });
        }

        const currentAvailable = Number(restaurant.available_seats || 0);
        const decrease = Number(reservation.party_size || 0);
        const newAvailable = Math.max(0, currentAvailable - decrease);

        await base44.asServiceRole.entities.Restaurant.update(restId, {
          available_seats: newAvailable,
          seating_updated_at: new Date().toISOString(),
        });

        if (restaurant.total_seats > 0) {
          await base44.asServiceRole.entities.SeatingHistory.create({
            restaurant_id: restId,
            available_seats: newAvailable,
            total_seats: Number(restaurant.total_seats),
            occupancy_percent: ((Number(restaurant.total_seats) - newAvailable) / Number(restaurant.total_seats)) * 100,
            recorded_at: new Date().toISOString(),
          });
        }

        await base44.asServiceRole.entities.AuditLog.create({
          restaurant_id: restId,
          action_type: 'seating_auto_decrease',
          source: 'system_automation',
          entity_type: 'reservation',
          entity_id: reservation.id,
          performed_by: 'system',
          performed_by_name: 'Seating Automation',
          old_value: { available_seats: currentAvailable },
          new_value: { available_seats: newAvailable },
          reason: `Reservation approved — party of ${decrease} auto-deducted from available seats`,
        });

        return Response.json({
          success: true,
          message: `Reservation confirmed. Seats decreased by ${decrease}. Now ${newAvailable} available.`,
          old_available: currentAvailable,
          new_available: newAvailable,
        });
      }

      return Response.json({ success: true, message: 'No seat change needed for this status transition' });
    }

    // ── Manual / direct trigger payload ───────────────────────────────────────
    const { trigger, restaurant_id } = body;

    if (!trigger || !restaurant_id) {
      return Response.json({ error: 'Missing trigger or restaurant_id' }, { status: 400 });
    }

    // Fetch the restaurant
    const restaurants = await base44.entities.Restaurant.filter({ id: restaurant_id });
    const restaurant = restaurants?.[0] || restaurants?.data?.[0];
    if (!restaurant) {
      return Response.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // ── 1. Reservation Confirmed / Seated ─────────────────────────────────────
    if (trigger === 'reservation_confirmed' || trigger === 'reservation_seated') {
      const { reservation_id, party_size } = body;
      if (!reservation_id || !party_size) {
        return Response.json({ error: 'Missing reservation_id or party_size' }, { status: 400 });
      }

      // Skip if manual override is active
      if (restaurant.manual_override_active) {
        return Response.json({ success: true, message: 'Manual override active, skipping auto-deduct' });
      }

      const currentAvailable = Number(restaurant.available_seats || 0);
      const decrease = Number(party_size);
      const newAvailable = Math.max(0, currentAvailable - decrease);

      await base44.entities.Restaurant.update(restaurant_id, {
        available_seats: newAvailable,
        seating_updated_at: new Date().toISOString(),
      });

      if (restaurant.total_seats > 0) {
        await base44.entities.SeatingHistory.create({
          restaurant_id,
          available_seats: newAvailable,
          total_seats: Number(restaurant.total_seats),
          occupancy_percent: ((Number(restaurant.total_seats) - newAvailable) / Number(restaurant.total_seats)) * 100,
          recorded_at: new Date().toISOString(),
        });
      }

      await base44.entities.AuditLog.create({
        restaurant_id,
        action_type: 'seating_auto_decrease',
        source: 'system_automation',
        entity_type: 'reservation',
        entity_id: reservation_id,
        performed_by: 'system',
        performed_by_name: 'Seating Automation',
        old_value: { available_seats: currentAvailable },
        new_value: { available_seats: newAvailable },
        reason: `Reservation ${trigger === 'reservation_confirmed' ? 'confirmed' : 'seated'} — party of ${decrease} auto-deducted from available seats`,
      });

      return Response.json({
        success: true,
        message: `Seats decreased by ${decrease}. Now ${newAvailable} available.`,
        old_available: currentAvailable,
        new_available: newAvailable,
      });
    }

    // ── 2. POS Table Paid / Closed ─────────────────────────────────────────────
    if (trigger === 'pos_table_paid') {
      const { table_id, status: tableStatus } = body;
      if (!table_id) {
        return Response.json({ error: 'Missing table_id' }, { status: 400 });
      }

      const tables = await base44.entities.Table.filter({ id: table_id });
      const table = tables?.[0] || tables?.data?.[0];
      if (!table) {
        return Response.json({ error: 'Table not found' }, { status: 404 });
      }

      const tableCapacity = Number(table.capacity || 0);
      const posStatus = tableStatus || 'paid';

      // Mark table as free
      await base44.entities.Table.update(table_id, { status: 'free' });

      // Audit the POS event immediately
      await base44.entities.AuditLog.create({
        restaurant_id,
        action_type: posStatus === 'closed' ? 'pos_table_closed' : 'pos_table_paid',
        source: 'system_automation',
        entity_type: 'table',
        entity_id: table_id,
        performed_by: 'system',
        performed_by_name: 'POS Integration',
        old_value: { table_status: posStatus },
        new_value: { table_status: 'free' },
        reason: `POS marked table "${table.label}" as ${posStatus}. Grace period started (10 min).`,
      });

      // ── Grace Period Delay ──
      // We use setTimeout for the delay. Since Deno functions are ephemeral,
      // we respond immediately and the delay runs in the background.
      // For production reliability, consider a scheduled job or queue.
      const restaurantSnapshot = { ...restaurant };
      setTimeout(async () => {
        try {
          // Re-fetch latest restaurant state after grace period
          const freshRestaurants = await base44.asServiceRole.entities.Restaurant.filter({ id: restaurant_id });
          const freshRestaurant = freshRestaurants?.[0] || freshRestaurants?.data?.[0];
          if (!freshRestaurant) return;

          const currentAvail = Number(freshRestaurant.available_seats || 0);
          const totalSeats = Number(freshRestaurant.total_seats || 0);
          const newAvailable = Math.min(totalSeats, currentAvail + tableCapacity);

          await base44.asServiceRole.entities.Restaurant.update(restaurant_id, {
            available_seats: newAvailable,
            seating_updated_at: new Date().toISOString(),
          });

          if (totalSeats > 0) {
            await base44.asServiceRole.entities.SeatingHistory.create({
              restaurant_id,
              available_seats: newAvailable,
              total_seats: totalSeats,
              occupancy_percent: ((totalSeats - newAvailable) / totalSeats) * 100,
              recorded_at: new Date().toISOString(),
            });
          }

          await base44.asServiceRole.entities.AuditLog.create({
            restaurant_id,
            action_type: 'seating_auto_increase',
            source: 'system_automation',
            entity_type: 'table',
            entity_id: table_id,
            performed_by: 'system',
            performed_by_name: 'Seating Automation',
            old_value: { available_seats: currentAvail },
            new_value: { available_seats: newAvailable },
            reason: `Table "${table.label}" released after 10-min grace period. +${tableCapacity} seats added.`,
          });
        } catch (err) {
          console.error('Grace period seat restore failed:', err.message);
        }
      }, GRACE_PERIOD_MS);

      return Response.json({
        success: true,
        message: `Table "${table.label}" marked free. Seats (+${tableCapacity}) will be restored in 10 minutes.`,
        table_capacity: tableCapacity,
        grace_period_minutes: 10,
      });
    }

    return Response.json({ error: `Unknown trigger: ${trigger}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
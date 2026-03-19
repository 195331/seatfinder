/**
 * Reservation Reminder Function
 *
 * Runs on a schedule every 5 minutes.
 * Finds reservations starting in ~2 hours (between 115-125 min from now),
 * sends an in-app notification + email with confirm/cancel links.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role since this is a scheduled/system task
    const now = new Date();

    // Window: reservations happening 115–125 minutes from now
    const windowStart = new Date(now.getTime() + 115 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 125 * 60 * 1000);

    const windowStartDate = windowStart.toISOString().split('T')[0];
    const windowEndDate   = windowEnd.toISOString().split('T')[0];

    // Fetch approved/pending reservations for today or tomorrow
    const reservations = await base44.asServiceRole.entities.Reservation.filter(
      { status: 'approved' },
      '-reservation_date',
      200
    );

    // Also check pending
    const pendingReservations = await base44.asServiceRole.entities.Reservation.filter(
      { status: 'pending' },
      '-reservation_date',
      200
    );

    const allReservations = [...reservations, ...pendingReservations];

    let sent = 0;
    const errors = [];

    for (const res of allReservations) {
      try {
        if (!res.reservation_date || !res.reservation_time) continue;

        // Parse reservation datetime
        const resDateTime = new Date(`${res.reservation_date}T${res.reservation_time}`);
        if (isNaN(resDateTime.getTime())) continue;

        // Check if within our 2-hour reminder window
        if (resDateTime < windowStart || resDateTime > windowEnd) continue;

        // Check if reminder already sent (use a flag in notes or skip if notification exists)
        const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
          reservation_id: res.id,
          type: 'reservation_approved', // re-use type — we'll check title
        });

        const alreadySent = existingNotifs.some(n => n.title?.includes('Reminder'));
        if (alreadySent) continue;

        // Fetch restaurant name
        let restaurantName = 'your restaurant';
        if (res.restaurant_id) {
          const rests = await base44.asServiceRole.entities.Restaurant.filter({ id: res.restaurant_id });
          if (rests?.[0]?.name) restaurantName = rests[0].name;
        }

        const timeStr = res.reservation_time;
        const dateStr = new Date(res.reservation_date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        });

        // Build confirm/cancel URLs — users navigate to MyReservations where they can act
        const appBaseUrl = 'https://app.base44.com'; // generic fallback; works for any deployment
        const confirmUrl = `${appBaseUrl}/MyReservations?action=confirm&id=${res.id}`;
        const cancelUrl  = `${appBaseUrl}/MyReservations?action=cancel&id=${res.id}`;

        // 1. Create in-app notification
        await base44.asServiceRole.entities.Notification.create({
          user_id:          res.user_id,
          user_email:       res.user_email,
          type:             'reservation_approved',
          title:            `⏰ Reminder: Your reservation is in 2 hours`,
          message:          `You have a reservation at ${restaurantName} today at ${timeStr} for ${res.party_size} guest${res.party_size !== 1 ? 's' : ''}. Don't forget!`,
          restaurant_name:  restaurantName,
          reservation_id:   res.id,
          is_read:          false,
        });

        // 2. Send reminder email (if user email available)
        if (res.user_email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to:      res.user_email,
            subject: `⏰ Reminder: Your reservation at ${restaurantName} is in 2 hours`,
            body: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 8px;">🍽️</div>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Reservation Reminder</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Your table is coming up soon!</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px 32px;">
      <p style="color: #475569; font-size: 16px; margin: 0 0 24px;">
        Hi ${res.user_name || 'there'}! Just a friendly reminder about your upcoming reservation.
      </p>

      <!-- Reservation Details Card -->
      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 14px;">Restaurant</span>
          <span style="color: #0f172a; font-weight: 600; font-size: 14px;">${restaurantName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 14px;">Date</span>
          <span style="color: #0f172a; font-weight: 600; font-size: 14px;">${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 14px;">Time</span>
          <span style="color: #0f172a; font-weight: 600; font-size: 14px;">${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b; font-size: 14px;">Party size</span>
          <span style="color: #0f172a; font-weight: 600; font-size: 14px;">${res.party_size} guest${res.party_size !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <!-- CTA Buttons -->
      <p style="color: #475569; font-size: 14px; margin: 0 0 16px; text-align: center;">Will you be joining us?</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a href="${confirmUrl}" style="
          display: inline-block;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 15px;
        ">✅ Confirm Arrival</a>
        <a href="${cancelUrl}" style="
          display: inline-block;
          background: white;
          color: #ef4444;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          border: 2px solid #fecaca;
        ">❌ Cancel</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">
        You're receiving this because you have a reservation. If you need help, visit your reservations page.
      </p>
    </div>
  </div>
</body>
</html>
            `.trim(),
          });
        }

        sent++;
      } catch (err) {
        errors.push({ reservation_id: res.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      checked: allReservations.length,
      reminders_sent: sent,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
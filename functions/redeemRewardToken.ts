import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find the redemption record
    const redemptions = await base44.asServiceRole.entities.RewardRedemption.filter({ token });
    if (!redemptions || redemptions.length === 0) {
      return Response.json({ error: 'Invalid or unknown token' }, { status: 404 });
    }

    const redemption = redemptions[0];

    // Check if already redeemed
    if (redemption.status === 'redeemed') {
      return Response.json({ error: 'This reward has already been redeemed' }, { status: 400 });
    }

    // Check expiry
    if (new Date(redemption.expires_at) < new Date()) {
      await base44.asServiceRole.entities.RewardRedemption.update(redemption.id, { status: 'expired' });
      return Response.json({ error: 'This redemption link has expired' }, { status: 400 });
    }

    // Get loyalty record
    const loyalties = await base44.asServiceRole.entities.CustomerLoyalty.filter({ id: redemption.loyalty_id });
    if (!loyalties || loyalties.length === 0) {
      return Response.json({ error: 'Loyalty record not found' }, { status: 404 });
    }

    const loyalty = loyalties[0];
    const currentPoints = loyalty.available_points || 0;

    if (currentPoints < redemption.points_cost) {
      return Response.json({ error: 'Insufficient points' }, { status: 400 });
    }

    // Deduct points and record redemption
    const newAvailable = currentPoints - redemption.points_cost;
    const newPointsRedeemed = (loyalty.points_redeemed || 0) + redemption.points_cost;
    const newHistory = [
      ...(loyalty.rewards_redeemed || []),
      {
        reward_id: token,
        redeemed_at: new Date().toISOString(),
        points_used: redemption.points_cost,
        reward_name: redemption.reward_name
      }
    ];

    await Promise.all([
      base44.asServiceRole.entities.CustomerLoyalty.update(loyalty.id, {
        available_points: newAvailable,
        points_redeemed: newPointsRedeemed,
        rewards_redeemed: newHistory
      }),
      base44.asServiceRole.entities.RewardRedemption.update(redemption.id, {
        status: 'redeemed',
        redeemed_at: new Date().toISOString()
      })
    ]);

    return Response.json({
      success: true,
      reward_name: redemption.reward_name,
      reward_description: redemption.reward_description,
      points_deducted: redemption.points_cost,
      remaining_points: newAvailable,
      user_name: redemption.user_name
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, dateOnly, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const membershipId = body.membership_id;
    const customerId = body.customer_id;
    const expires_at = String(body.expires_at || '').trim();
    const activated_at = String(body.activated_at || '').trim();
    if (!expires_at) return json({ error: 'Missing expiry date' }, 400);

    let membership = membershipId
      ? await database.entities.LoyaltyMembership.get(membershipId)
      : null;
    if (!membership && customerId) {
      const rows = await database.entities.LoyaltyMembership.filter({ customer_id: customerId });
      membership = (rows || []).find((m: any) => m.status === 'ACTIVE') || rows?.[0];
    }
    if (!membership) return json({ error: 'Membership not found' }, 404);

    const expiryIso = expires_at.length <= 10 ? `${expires_at}T23:59:59.000Z` : expires_at;
    const activatedIso = activated_at
      ? (activated_at.length <= 10 ? `${activated_at}T00:00:00.000Z` : activated_at)
      : membership.activated_at;
    const expired = new Date(expiryIso).getTime() <= Date.now();
    membership = await database.entities.LoyaltyMembership.update(membership.id, {
      expires_at: expiryIso,
      activated_at: activatedIso,
      status: expired ? 'EXPIRED' : 'ACTIVE',
    });

    const customer = await database.entities.Customer.update(membership.customer_id, {
      has_winwin_card: !expired,
      card_purchase_date: dateOnly(activatedIso),
      card_expiry_date: dateOnly(expiryIso),
      card_renewal_reminder_sent: false,
    });

    return json({
      success: true,
      membership,
      customer: await enrichCustomer(database, customer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

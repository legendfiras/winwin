import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, getActiveMembership, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const customer = await database.entities.Customer.get(body.customer_id);
    if (!customer) return json({ error: 'Customer not found' }, 404);

    const active = await getActiveMembership(database, customer.id);
    const memberships = await database.entities.LoyaltyMembership.filter({ customer_id: customer.id, status: 'ACTIVE' });
    for (const m of memberships || []) {
      await database.entities.LoyaltyMembership.update(m.id, { status: 'DEACTIVATED' });
    }
    if (body.membership_id && !active) {
      await database.entities.LoyaltyMembership.update(body.membership_id, { status: 'DEACTIVATED' });
    }

    const updated = await database.entities.Customer.update(customer.id, {
      has_winwin_card: false,
    });

    return json({
      success: true,
      customer: await enrichCustomer(database, updated),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

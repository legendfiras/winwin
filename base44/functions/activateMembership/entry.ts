import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, activateMembershipRecord, enrichCustomer,
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

    const result = await activateMembershipRecord(database, {
      customer,
      source: 'MANUAL',
      approved_by: admin.session.id,
      awardBonus: body.award_bonus !== false,
    });

    return json({
      success: true,
      membership: result.membership,
      customer: await enrichCustomer(database, result.customer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

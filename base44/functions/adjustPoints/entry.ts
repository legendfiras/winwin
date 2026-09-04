import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, creditPoints, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const customerId = body.customer_id;
    const amount = parseInt(body.amount, 10);
    const reason = String(body.reason || '').trim();
    const mode = body.mode === 'remove' || amount < 0 ? 'remove' : 'add';
    if (!customerId) return json({ error: 'Missing customer_id' }, 400);
    if (!amount || amount === 0 || Number.isNaN(amount)) return json({ error: 'Enter a valid number of points' }, 400);
    if (!reason) return json({ error: 'A reason is required' }, 400);

    const customer = await database.entities.Customer.get(customerId);
    if (!customer) return json({ error: 'Customer not found' }, 404);

    const delta = mode === 'remove' ? -Math.abs(amount) : Math.abs(amount);
    if ((customer.points || 0) + delta < 0) {
      return json({ error: 'Points cannot go below 0' }, 400);
    }

    const credited = await creditPoints(database, {
      customer,
      amount: delta,
      type: mode === 'remove' ? 'MANUAL_REMOVE' : 'MANUAL_ADD',
      reason,
      source: 'ADMIN_MANUAL',
      idempotency_key: `MANUAL:${customerId}:${admin.session.id}:${Date.now()}:${delta}`,
      created_by_admin_id: admin.session.id,
    });

    return json({
      success: true,
      customer: await enrichCustomer(database, credited.customer),
      ledger: credited.ledger,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

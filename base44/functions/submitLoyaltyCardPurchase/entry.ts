import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, requireCustomerSession, enrichCustomer } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const authz = await requireCustomerSession(database, body.session_token);
    if (authz.error) return authz.error;

    const amount_usd = Number(body.amount_usd || 10);
    const tx = await database.entities.StoreTransaction.create({
      customer_id: authz.customer.id,
      customer_email: authz.customer.email,
      customer_name: authz.customer.full_name,
      type: 'LOYALTY_CARD',
      status: 'PENDING',
      amount_usd: Number.isFinite(amount_usd) && amount_usd > 0 ? amount_usd : 10,
      product_summary: String(body.product_summary || 'WinWin loyalty card').trim(),
      calculated_points: 100,
      submitted_by: 'CUSTOMER',
    });

    return json({
      success: true,
      transaction: tx,
      customer: await enrichCustomer(database, authz.customer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

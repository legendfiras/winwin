import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, pointsForPurchaseUsd, publicCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const customerId = body.customer_id;
    const type = body.type === 'LOYALTY_CARD' ? 'LOYALTY_CARD' : 'PRODUCT_PURCHASE';
    if (!customerId) return json({ error: 'Missing customer_id' }, 400);
    const customer = await database.entities.Customer.get(customerId);
    if (!customer) return json({ error: 'Customer not found' }, 404);

    const amount_usd = Number(body.amount_usd || (type === 'LOYALTY_CARD' ? 10 : 0));
    if (!Number.isFinite(amount_usd) || amount_usd <= 0) {
      return json({ error: 'Enter a valid amount' }, 400);
    }
    const calculated_points = type === 'LOYALTY_CARD' ? 100 : pointsForPurchaseUsd(amount_usd);
    const product_ids = Array.isArray(body.product_ids) ? body.product_ids : [];

    const tx = await database.entities.StoreTransaction.create({
      customer_id: customer.id,
      customer_email: customer.email,
      customer_name: customer.full_name,
      type,
      status: 'PENDING',
      amount_usd,
      product_ids: JSON.stringify(product_ids),
      product_summary: String(body.product_summary || '').trim(),
      calculated_points,
      submitted_by: 'ADMIN',
    });

    return json({ success: true, transaction: tx, customer: publicCustomer(customer) });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

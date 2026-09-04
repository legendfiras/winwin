import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, requireCustomerSession, requireAdminSession } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);

    const admin = await requireAdminSession(database, body.admin_session_token);
    const customerAuth = admin.error
      ? await requireCustomerSession(database, body.session_token)
      : null;
    if (admin.error && customerAuth?.error) return customerAuth.error;

    const customerId = admin.error
      ? customerAuth!.customer.id
      : (body.customer_id || customerAuth?.customer?.id);
    if (!customerId) return json({ error: 'Missing customer_id' }, 400);

    const rows = await database.entities.PointsLedger.filter({ customer_id: customerId });
    const list = Array.isArray(rows) ? rows : [];
    list.sort((a: any, b: any) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
    return json({ success: true, ledger: list });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, requireAdminSession } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const status = body.status;
    let list;
    if (!status) {
      list = await database.entities.StoreTransaction.list('-created_date', 500);
    } else if (status === 'PENDING') {
      const pending = await database.entities.StoreTransaction.filter({ status: 'PENDING' });
      const processing = await database.entities.StoreTransaction.filter({ status: 'PROCESSING' });
      list = [...(pending || []), ...(processing || [])];
    } else {
      list = await database.entities.StoreTransaction.filter({ status });
    }
    list = Array.isArray(list) ? list : [];
    list.sort((a: any, b: any) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
    return json({ success: true, transactions: list });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

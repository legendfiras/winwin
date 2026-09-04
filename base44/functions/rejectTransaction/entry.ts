import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, requireAdminSession, nowIso } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const txId = body.transaction_id;
    if (!txId) return json({ error: 'Missing transaction_id' }, 400);
    const tx = await database.entities.StoreTransaction.get(txId);
    if (!tx) return json({ error: 'Transaction not found' }, 404);

    if (tx.status === 'APPROVED') {
      return json({ error: 'Approved transactions cannot be rejected' }, 409);
    }
    if (tx.status === 'REJECTED') {
      return json({ success: true, already_rejected: true, transaction: tx });
    }

    const updated = await database.entities.StoreTransaction.update(tx.id, {
      status: 'REJECTED',
      reviewed_by: admin.session.id,
      reviewed_at: nowIso(),
      reject_reason: String(body.reject_reason || '').trim(),
    });
    return json({ success: true, transaction: updated });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, sha256, hashPassword, createCustomerSession, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const token = String(body.token || body.reset_token || '');
    const newPassword = String(body.new_password || body.newPassword || '');
    if (!token) return json({ error: 'Invalid or expired reset link' }, 400);
    if (newPassword.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

    const reset_token_hash = await sha256(token);
    const auths = await database.entities.CustomerAuth.filter({ reset_token_hash });
    const auth = auths?.[0];
    if (!auth) return json({ error: 'Invalid or expired reset link' }, 400);
    if (!auth.reset_expires_at || new Date(auth.reset_expires_at).getTime() <= Date.now()) {
      return json({ error: 'Invalid or expired reset link' }, 400);
    }

    await database.entities.CustomerAuth.update(auth.id, {
      password_hash: hashPassword(newPassword),
      reset_token_hash: '',
      reset_expires_at: null,
      must_reset_password: false,
    });
    await database.entities.Customer.update(auth.customer_id, { password: '' });

    const sessions = await database.entities.CustomerSession.filter({ customer_id: auth.customer_id });
    for (const s of sessions || []) {
      await database.entities.CustomerSession.delete(s.id);
    }

    const { token: session_token } = await createCustomerSession(database, auth.customer_id);
    const customer = await database.entities.Customer.get(auth.customer_id);
    return json({
      success: true,
      session_token,
      customer: await enrichCustomer(database, customer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

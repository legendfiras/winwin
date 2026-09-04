import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, sha256, randomToken, addHoursIso, RESET_HOURS, getAuthForCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const app_origin = String(body.app_origin || '').replace(/\/$/, '');

    // Always succeed to avoid account enumeration.
    if (!email) return json({ success: true });

    const matches = await database.entities.Customer.filter({ email });
    const customer = matches?.[0];
    if (customer && app_origin) {
      let auth = await getAuthForCustomer(database, customer.id);
      const raw = randomToken();
      const reset_token_hash = await sha256(raw);
      const reset_expires_at = addHoursIso(RESET_HOURS);
      if (auth) {
        await database.entities.CustomerAuth.update(auth.id, { reset_token_hash, reset_expires_at });
      } else {
        await database.entities.CustomerAuth.create({
          customer_id: customer.id,
          password_hash: '!',
          reset_token_hash,
          reset_expires_at,
          must_reset_password: true,
        });
      }
      const link = `${app_origin}/reset-password?token=${encodeURIComponent(raw)}`;
      try {
        await database.integrations.Core.SendEmail({
          to: customer.email,
          subject: 'Reset your WinWin password',
          body: `Hi ${customer.full_name || ''},

We received a request to reset your WinWin password.

Open this link within 1 hour:
${link}

If you did not request this, you can ignore this email.

– The WinWin Team`,
        });
      } catch (_e) { /* still return success */ }
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

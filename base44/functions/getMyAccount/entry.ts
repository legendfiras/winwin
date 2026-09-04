import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readBody, json, db, requireCustomerSession, enrichCustomer } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const authz = await requireCustomerSession(database, body.session_token);
    if (authz.error) return authz.error;
    const customer = await enrichCustomer(database, authz.customer);
    return json({ success: true, customer });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

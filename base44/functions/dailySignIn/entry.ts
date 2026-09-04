import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireCustomerSession, creditPoints, todayStr, DAILY_POINTS, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const today = todayStr();

    if (body?._check_only) {
      const authz = body.session_token
        ? await requireCustomerSession(database, body.session_token)
        : null;
      const customerId = authz && !authz.error ? authz.customer.id : body.customer_id;
      if (!customerId) return json({ today, already_signed_in: false });
      try {
        const customer = await database.entities.Customer.get(customerId);
        return json({
          today,
          already_signed_in: customer?.last_signin_date === today,
        });
      } catch (_e) {
        return json({ today, already_signed_in: false });
      }
    }

    const authz = await requireCustomerSession(database, body.session_token);
    if (authz.error) return authz.error;
    let customer = authz.customer;

    const key = `DAILY_LOGIN:${customer.id}:${today}`;
    const credited = await creditPoints(database, {
      customer,
      amount: DAILY_POINTS,
      type: 'DAILY_LOGIN',
      reason: 'Daily sign-in bonus',
      source: 'DAILY_LOGIN',
      idempotency_key: key,
    });

    const publicProfile = await enrichCustomer(database, credited.customer);
    return json({
      success: !credited.duplicate,
      already_signed_in: credited.duplicate,
      points_awarded: credited.duplicate ? 0 : DAILY_POINTS,
      message: credited.duplicate ? 'Already signed in today' : 'Daily points awarded',
      customer: publicProfile,
      today,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

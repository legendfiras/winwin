import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, hashPassword, verifyPassword, createCustomerSession,
  getAuthForCustomer, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return json({ error: 'Email and password are required' }, 400);
    }

    const matches = await database.entities.Customer.filter({ email });
    const customer = matches?.[0];
    if (!customer) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    let auth = await getAuthForCustomer(database, customer.id);
    let ok = false;
    if (auth?.password_hash) {
      ok = verifyPassword(password, auth.password_hash);
    } else if (customer.password && customer.password === password) {
      ok = true;
      const hash = hashPassword(password);
      if (auth) {
        await database.entities.CustomerAuth.update(auth.id, {
          password_hash: hash,
          must_reset_password: true,
        });
      } else {
        auth = await database.entities.CustomerAuth.create({
          customer_id: customer.id,
          password_hash: hash,
          must_reset_password: true,
        });
      }
      await database.entities.Customer.update(customer.id, { password: '' });
    }

    if (!ok) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    const { token } = await createCustomerSession(database, customer.id);
    const publicProfile = await enrichCustomer(database, customer);
    return json({
      success: true,
      session_token: token,
      customer: publicProfile,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, publicCustomer, hashPassword, createCustomerSession,
  creditPoints, SIGNUP_POINTS, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = String(body.mobile || '').trim();
    const country = String(body.country || '').trim();
    const password = String(body.password || '');
    const ambassador_code = String(body.ambassador_code || '').trim() || null;

    if (!full_name || !email || !mobile || !country || !password) {
      return json({ error: 'Missing required fields' }, 400);
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const existing = await database.entities.Customer.filter({ email });
    if (existing.length > 0) {
      return json({ error: 'Email already registered. Please sign in.' }, 409);
    }

    const customer = await database.entities.Customer.create({
      full_name,
      email,
      mobile,
      country,
      points: 0,
      has_winwin_card: false,
      draw_entries: 0,
      last_signin_date: null,
      ambassador_code,
      is_ambassador: false,
      signup_bonus_granted: false,
    });

    await database.entities.CustomerAuth.create({
      customer_id: customer.id,
      password_hash: hashPassword(password),
      must_reset_password: false,
    });

    const credited = await creditPoints(database, {
      customer,
      amount: SIGNUP_POINTS,
      type: 'SIGNUP_BONUS',
      reason: 'New account registration bonus',
      source: 'SIGNUP_BONUS',
      idempotency_key: `SIGNUP_BONUS:${customer.id}`,
    });

    const { token } = await createCustomerSession(database, customer.id);
    const publicProfile = await enrichCustomer(database, credited.customer);

    try {
      const settingsList = await database.entities.AppSettings.list();
      const emailSetting = settingsList.find((s: any) => s.setting_key === 'admin_email');
      const adminEmail = emailSetting?.setting_value || 'moustafa-sd@hotmail.com';
      const ambassadorEmailInfo = ambassador_code ? `\nAmbassador Code: ${ambassador_code}` : '';
      await database.integrations.Core.SendEmail({
        to: adminEmail,
        subject: `New WinWin Customer: ${full_name}`,
        body: `New customer signed up!\n\nName: ${full_name}\nEmail: ${email}\nMobile: ${mobile}\nCountry: ${country}${ambassadorEmailInfo}\n\nYou can view them in the admin dashboard.`,
      });
    } catch (_e) { /* non-fatal */ }

    return json({
      success: true,
      session_token: token,
      customer: publicProfile,
      points_awarded: SIGNUP_POINTS,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

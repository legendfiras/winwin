import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { db, json, todayStr, dateOnly } from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);

    const today = new Date();
    const todayDate = todayStr(today);
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const reminderDate = todayStr(twoDaysFromNow);

    const memberships = await database.entities.LoyaltyMembership.filter({ status: 'ACTIVE' });
    let reminders_sent = 0;
    let cards_expired = 0;

    for (const membership of memberships || []) {
      const expiryDay = dateOnly(membership.expires_at);
      if (!expiryDay) continue;

      let customer;
      try {
        customer = await database.entities.Customer.get(membership.customer_id);
      } catch (_e) {
        continue;
      }
      if (!customer) continue;

      if (expiryDay === reminderDate && !customer.card_renewal_reminder_sent) {
        try {
          await database.integrations.Core.SendEmail({
            to: customer.email,
            subject: 'Your WinWin Card Expires in 2 Days – Renew Now!',
            body: `Hi ${customer.full_name},

Your WinWin Card expires on ${expiryDay} – that's just 2 days away!

Renew now to keep enjoying your benefits:
- Exclusive discounts on all products
- Earn points on every purchase
- Redeem points for free items
- Enter our monthly prize draws

Contact us on WhatsApp to renew: +961 78 714 472

Thank you for being a valued WinWin customer!

– The WinWin Team`,
          });
          await database.entities.Customer.update(customer.id, {
            card_renewal_reminder_sent: true,
          });
          reminders_sent += 1;
        } catch (err) {
          console.error(`Failed to send reminder to ${customer.email}:`, err.message);
        }
      }

      if (expiryDay <= todayDate) {
        try {
          await database.entities.LoyaltyMembership.update(membership.id, { status: 'EXPIRED' });
          await database.entities.Customer.update(customer.id, {
            has_winwin_card: false,
          });
          await database.integrations.Core.SendEmail({
            to: customer.email,
            subject: 'Your WinWin Card Has Expired',
            body: `Hi ${customer.full_name},

Your WinWin Card has expired today (${todayDate}). Your card benefits are no longer active.

Don't worry – your points are safe! Renew your card to regain access to:
- Exclusive discounts
- Points earning and redemption
- Monthly prize draws

Contact us on WhatsApp to renew: +961 78 714 472

– The WinWin Team`,
          });
          cards_expired += 1;
        } catch (err) {
          console.error(`Failed to process expiry for ${customer.email}:`, err.message);
        }
      }
    }

    // Catch legacy customers whose flag is still on but whose date has passed.
    const activeCardHolders = await database.entities.Customer.filter({ has_winwin_card: true });
    for (const customer of activeCardHolders || []) {
      const expiryDay = dateOnly(customer.card_expiry_date);
      if (expiryDay && expiryDay <= todayDate) {
        await database.entities.Customer.update(customer.id, { has_winwin_card: false });
        cards_expired += 1;
      }
    }

    return json({
      success: true,
      reminders_sent,
      cards_expired,
      checked_date: todayDate,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

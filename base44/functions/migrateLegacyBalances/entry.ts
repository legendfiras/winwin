import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, hashPassword, getAuthForCustomer,
  getLedgerByKey, creditPoints, dateOnly, todayStr,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const customers = await database.entities.Customer.list('-created_date', 5000);
    const now = new Date();
    const today = todayStr(now);
    let migrated_balances = 0;
    let hashed_passwords = 0;
    let imported_memberships = 0;

    for (const customer of customers || []) {
      const migKey = `MIGRATION:${customer.id}`;
      const existingMig = await getLedgerByKey(database, migKey);
      if (!existingMig) {
        await creditPoints(database, {
          customer,
          amount: customer.points || 0,
          type: 'MIGRATION',
          reason: 'Migrated balance from previous Base44 system',
          source: 'MIGRATION',
          idempotency_key: migKey,
          created_by_admin_id: admin.session.id,
        });
        migrated_balances += 1;
      }

      const auth = await getAuthForCustomer(database, customer.id);
      if (!auth && customer.password) {
        await database.entities.CustomerAuth.create({
          customer_id: customer.id,
          password_hash: hashPassword(customer.password),
          must_reset_password: true,
        });
        await database.entities.Customer.update(customer.id, { password: '' });
        hashed_passwords += 1;
      } else if (auth && customer.password) {
        await database.entities.Customer.update(customer.id, { password: '' });
      }

      const memberships = await database.entities.LoyaltyMembership.filter({ customer_id: customer.id });
      if ((!memberships || memberships.length === 0) && (customer.has_winwin_card || customer.card_expiry_date)) {
        const expiryDate = dateOnly(customer.card_expiry_date);
        const active = Boolean(customer.has_winwin_card && expiryDate && expiryDate >= today);
        const expired = Boolean(expiryDate && expiryDate < today);
        if (active || expired) {
          await database.entities.LoyaltyMembership.create({
            customer_id: customer.id,
            status: active ? 'ACTIVE' : 'EXPIRED',
            activated_at: customer.card_purchase_date
              ? `${dateOnly(customer.card_purchase_date)}T00:00:00.000Z`
              : now.toISOString(),
            expires_at: customer.card_expiry_date
              ? `${expiryDate}T23:59:59.000Z`
              : now.toISOString(),
            source: 'MIGRATION',
            approved_by: admin.session.id,
          });
          if (expired && customer.has_winwin_card) {
            await database.entities.Customer.update(customer.id, { has_winwin_card: false });
          }
          imported_memberships += 1;
        }
      }
    }

    return json({
      success: true,
      migrated_balances,
      hashed_passwords,
      imported_memberships,
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

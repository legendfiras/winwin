import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, isMembershipActive, daysUntilExpiry, publicCustomer, todayStr,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const now = new Date();
    const customers = await database.entities.Customer.list('-created_date', 5000);
    const memberships = await database.entities.LoyaltyMembership.list('-created_date', 5000);
    const byCustomer: Record<string, any[]> = {};
    for (const m of memberships || []) {
      if (!byCustomer[m.customer_id]) byCustomer[m.customer_id] = [];
      byCustomer[m.customer_id].push(m);
    }

    const rows = (customers || []).map((c: any) => {
      const list = byCustomer[c.id] || [];
      list.sort((a: any, b: any) => String(b.activated_at || '').localeCompare(String(a.activated_at || '')));
      const latest = list[0] || null;
      const active = latest && isMembershipActive(latest, now);
      const days_remaining = latest ? daysUntilExpiry(latest.expires_at, now) : 0;
      let status = 'NONE';
      if (active) {
        status = days_remaining > 0 && days_remaining <= 2 ? 'EXPIRING_SOON' : 'ACTIVE';
      } else if (latest?.status === 'EXPIRED' || (latest && days_remaining <= 0)) {
        status = 'EXPIRED';
      } else if (latest?.status === 'DEACTIVATED') {
        status = 'EXPIRED';
      }
      return {
        customer: publicCustomer(c),
        membership: latest,
        status,
        days_remaining: active ? days_remaining : 0,
        activated_at: latest?.activated_at || c.card_purchase_date || null,
        expires_at: latest?.expires_at || c.card_expiry_date || null,
      };
    });

    const filter = String(body.filter || 'all').toUpperCase();
    const filtered = filter === 'ALL' || !body.filter
      ? rows
      : rows.filter((r: any) => {
          if (filter === 'ACTIVE') return r.status === 'ACTIVE';
          if (filter === 'EXPIRING_SOON') return r.status === 'EXPIRING_SOON';
          if (filter === 'EXPIRED') return r.status === 'EXPIRED';
          if (filter === 'NONE' || filter === 'NO_MEMBERSHIP') return r.status === 'NONE';
          return true;
        });

    return json({ success: true, server_today: todayStr(now), rows: filtered });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

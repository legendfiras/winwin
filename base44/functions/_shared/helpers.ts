import bcrypt from 'npm:bcryptjs@2.4.3';

export const SIGNUP_POINTS = 10;
export const DAILY_POINTS = 2;
export const LOYALTY_BONUS_POINTS = 100;
export const MEMBERSHIP_MONTHS = 30;
export const SESSION_DAYS = 30;
export const RESET_HOURS = 1;
export const BCRYPT_ROUNDS = 10;

export function json(data: Record<string, unknown> | object, status = 200) {
  return Response.json(data, { status });
}

export async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function randomToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function addDaysIso(days: number, from = new Date()) {
  const d = new Date(from);
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export function addHoursIso(hours: number, from = new Date()) {
  const d = new Date(from);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

export function addMonthsIso(months: number, from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function dateOnly(iso?: string | null) {
  if (!iso) return null;
  return String(iso).split('T')[0];
}

export function pointsForPurchaseUsd(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 15) return 0;
  if (n <= 20) return 20;
  if (n <= 40) return 35;
  if (n <= 60) return 50;
  if (n <= 100) return 75;
  return 100;
}

export function pointsPriceFromUsd(price: number) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function publicCustomer(customer: any, extras: Record<string, unknown> = {}) {
  if (!customer) return null;
  const { password, ...rest } = customer;
  return { ...rest, ...extras };
}

export function isMembershipActive(membership: any, now = new Date()) {
  if (!membership || membership.status !== 'ACTIVE') return false;
  if (!membership.expires_at) return false;
  return new Date(membership.expires_at).getTime() > now.getTime();
}

export function cardActiveFromCustomer(customer: any, now = new Date()) {
  if (!customer?.has_winwin_card) return false;
  if (!customer.card_expiry_date) return false;
  const expiry = new Date(customer.card_expiry_date);
  if (Number.isNaN(expiry.getTime())) return false;
  if (String(customer.card_expiry_date).length <= 10) {
    return dateOnly(customer.card_expiry_date)! >= todayStr(now);
  }
  return expiry.getTime() > now.getTime();
}

export function daysUntilExpiry(expiryIso: string | null | undefined, now = new Date()) {
  if (!expiryIso) return 0;
  const expiry = new Date(expiryIso.length <= 10 ? `${expiryIso}T23:59:59.000Z` : expiryIso);
  if (Number.isNaN(expiry.getTime())) return 0;
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function findByKey(entities: any, entityName: string, field: string, value: string) {
  const rows = await entities[entityName].filter({ [field]: value });
  return Array.isArray(rows) ? rows : [];
}

export async function getAuthForCustomer(db: any, customerId: string) {
  const rows = await db.entities.CustomerAuth.filter({ customer_id: customerId });
  return rows?.[0] || null;
}

export async function getLedgerByKey(db: any, key: string) {
  const rows = await db.entities.PointsLedger.filter({ idempotency_key: key });
  return rows?.[0] || null;
}

export async function creditPoints(db: any, opts: {
  customer: any;
  amount: number;
  type: string;
  reason: string;
  source?: string;
  idempotency_key: string;
  related_transaction_id?: string | null;
  created_by_admin_id?: string | null;
}) {
  const existing = await getLedgerByKey(db, opts.idempotency_key);
  if (existing) {
    return { duplicate: true, customer: opts.customer, ledger: existing };
  }
  const ledger = await db.entities.PointsLedger.create({
    customer_id: opts.customer.id,
    points_amount: opts.amount,
    type: opts.type,
    source: opts.source || opts.type,
    reason: opts.reason,
    idempotency_key: opts.idempotency_key,
    related_transaction_id: opts.related_transaction_id || null,
    created_by_admin_id: opts.created_by_admin_id || null,
  });
  const newPoints = Math.max(0, (opts.customer.points || 0) + opts.amount);
  const extra: Record<string, unknown> = {};
  if (opts.type === 'SIGNUP_BONUS') extra.signup_bonus_granted = true;
  if (opts.type === 'DAILY_LOGIN') extra.last_signin_date = todayStr();
  const updated = await db.entities.Customer.update(opts.customer.id, {
    points: newPoints,
    ...extra,
  });
  return { duplicate: false, customer: updated, ledger };
}

export async function requireCustomerSession(db: any, token?: string) {
  if (!token) return { error: json({ error: 'unauthorized' }, 401) };
  const token_hash = await sha256(token);
  const sessions = await db.entities.CustomerSession.filter({ token_hash });
  const session = sessions?.[0];
  if (!session) return { error: json({ error: 'unauthorized' }, 401) };
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return { error: json({ error: 'unauthorized' }, 401) };
  }
  const customer = await db.entities.Customer.get(session.customer_id);
  if (!customer) return { error: json({ error: 'unauthorized' }, 401) };
  return { session, customer };
}

export async function requireAdminSession(db: any, token?: string) {
  if (!token) return { error: json({ error: 'unauthorized' }, 401) };
  const token_hash = await sha256(token);
  const sessions = await db.entities.AdminSession.filter({ token_hash });
  const session = sessions?.[0];
  if (!session) return { error: json({ error: 'unauthorized' }, 401) };
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return { error: json({ error: 'unauthorized' }, 401) };
  }
  return { session };
}

export async function createCustomerSession(db: any, customerId: string) {
  const token = randomToken();
  const token_hash = await sha256(token);
  const row = await db.entities.CustomerSession.create({
    customer_id: customerId,
    token_hash,
    expires_at: addDaysIso(SESSION_DAYS),
  });
  return { token, session: row };
}

export async function createAdminSession(db: any) {
  const token = randomToken();
  const token_hash = await sha256(token);
  const row = await db.entities.AdminSession.create({
    token_hash,
    expires_at: addDaysIso(SESSION_DAYS),
    label: 'admin',
  });
  return { token, session: row };
}

export async function getActiveMembership(db: any, customerId: string, now = new Date()) {
  const rows = await db.entities.LoyaltyMembership.filter({ customer_id: customerId });
  const list = Array.isArray(rows) ? rows : [];
  return list.find((m: any) => isMembershipActive(m, now)) || null;
}

export async function syncCustomerCard(db: any, customer: any, membership: any | null, now = new Date()) {
  const active = isMembershipActive(membership, now);
  if (membership?.id && membership.status === 'ACTIVE' && !active) {
    await db.entities.LoyaltyMembership.update(membership.id, { status: 'EXPIRED' });
  }
  const patch: Record<string, unknown> = {
    has_winwin_card: active,
  };
  if (membership) {
    patch.card_purchase_date = dateOnly(membership.activated_at);
    patch.card_expiry_date = dateOnly(membership.expires_at);
  }
  if (
    customer.has_winwin_card !== patch.has_winwin_card ||
    (membership && customer.card_expiry_date !== patch.card_expiry_date) ||
    (membership && customer.card_purchase_date !== patch.card_purchase_date)
  ) {
    return db.entities.Customer.update(customer.id, patch);
  }
  return { ...customer, ...patch };
}

export async function enrichCustomer(db: any, customer: any) {
  const now = new Date();
  let latest = await getLatestMembership(db, customer.id);
  if (latest?.id && latest.status === 'ACTIVE' && !isMembershipActive(latest, now)) {
    await db.entities.LoyaltyMembership.update(latest.id, { status: 'EXPIRED' });
    latest = { ...latest, status: 'EXPIRED' };
  }
  const active = latest && isMembershipActive(latest, now) ? latest : null;
  const synced = await syncCustomerCard(db, customer, latest, now);
  const expiry = active?.expires_at || latest?.expires_at || synced.card_expiry_date;
  const days_left = daysUntilExpiry(expiry, now);
  const card_active = Boolean(active) || (!latest && cardActiveFromCustomer(synced, now));
  const auth = await getAuthForCustomer(db, synced.id);
  return publicCustomer(synced, {
    card_active,
    card_days_left: days_left,
    card_expiring_soon: card_active && days_left > 0 && days_left <= 2,
    card_expired: Boolean(expiry) && !card_active,
    must_reset_password: Boolean(auth?.must_reset_password),
    membership: active || latest || null,
    server_today: todayStr(now),
  });
}

export async function getLatestMembership(db: any, customerId: string) {
  const rows = await db.entities.LoyaltyMembership.filter({ customer_id: customerId });
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a: any, b: any) => String(b.activated_at || '').localeCompare(String(a.activated_at || '')));
  return list[0] || null;
}

export async function activateMembershipRecord(db: any, opts: {
  customer: any;
  source: string;
  approved_by?: string | null;
  related_transaction_id?: string | null;
  activated_at?: Date;
  expires_at?: string | null;
  awardBonus?: boolean;
}) {
  const now = opts.activated_at || new Date();
  const expires_at = opts.expires_at || addMonthsIso(MEMBERSHIP_MONTHS, now);
  const previous = await db.entities.LoyaltyMembership.filter({ customer_id: opts.customer.id, status: 'ACTIVE' });
  for (const m of previous || []) {
    await db.entities.LoyaltyMembership.update(m.id, { status: 'DEACTIVATED' });
  }
  const membership = await db.entities.LoyaltyMembership.create({
    customer_id: opts.customer.id,
    status: 'ACTIVE',
    activated_at: now.toISOString(),
    expires_at,
    source: opts.source,
    approved_by: opts.approved_by || null,
    related_transaction_id: opts.related_transaction_id || null,
  });
  const customer = await db.entities.Customer.update(opts.customer.id, {
    has_winwin_card: true,
    card_purchase_date: todayStr(now),
    card_expiry_date: dateOnly(expires_at),
    card_renewal_reminder_sent: false,
  });
  let bonus = null;
  if (opts.awardBonus !== false) {
    const key = opts.related_transaction_id
      ? `LOYALTY_CARD_BONUS:${opts.related_transaction_id}`
      : `LOYALTY_CARD_BONUS:${membership.id}`;
    bonus = await creditPoints(db, {
      customer,
      amount: LOYALTY_BONUS_POINTS,
      type: 'LOYALTY_CARD_BONUS',
      reason: 'WinWin loyalty card activation bonus',
      source: opts.source,
      idempotency_key: key,
      related_transaction_id: opts.related_transaction_id || membership.id,
      created_by_admin_id: opts.approved_by || null,
    });
  }
  return { membership, customer: bonus?.customer || customer, bonus };
}

export function db(base44: any) {
  return { entities: base44.asServiceRole.entities, integrations: base44.asServiceRole.integrations, raw: base44 };
}

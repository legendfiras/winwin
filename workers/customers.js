import {
  ACCOUNT_SOURCE,
  MIGRATION_STATUS,
  EMAIL_STATUS,
  RECOVERY_STATUS,
  LEDGER_TYPE,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  splitName,
  countEmails,
  mapLegacyRecord,
  emptyMigrationReport,
  tallyEmailStatus,
} from './migration.js';

const SIGNUP_POINTS = 10;
const DAILY_POINTS = 2;
const SESSION_DAYS = 30;
const RESET_HOURS = 1;
const PBKDF2_ITERS = 100000;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function addDaysIso(days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function addHoursIso(hours) {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function randomToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(buf);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERS}$${toHex(salt)}$${toHex(bits)}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const parts = String(stored).split('$');
  if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
  const iterations = Number(parts[1]) || PBKDF2_ITERS;
  const salt = fromHex(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits) === expected;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

async function rateLimit(env, key, limit, windowSec) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const id = `${key}:${bucket}`;
  const row = await env.DB.prepare('SELECT hit_count FROM rate_limits WHERE key = ?').bind(id).first();
  const next = Number(row?.hit_count || 0) + 1;
  if (row) {
    await env.DB.prepare('UPDATE rate_limits SET hit_count = ? WHERE key = ?').bind(next, id).run();
  } else {
    await env.DB.prepare('INSERT INTO rate_limits (key, hit_count, created_date) VALUES (?, ?, ?)')
      .bind(id, 1, nowIso())
      .run();
  }
  return next <= limit;
}

export async function ensureCustomerSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      legacy_user_id TEXT,
      full_name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      email_normalized TEXT,
      mobile TEXT,
      mobile_normalized TEXT,
      country TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      has_winwin_card INTEGER NOT NULL DEFAULT 0,
      card_number TEXT,
      card_purchase_date TEXT,
      card_expiry_date TEXT,
      draw_entries INTEGER NOT NULL DEFAULT 0,
      last_signin_date TEXT,
      ambassador_code TEXT,
      is_ambassador INTEGER NOT NULL DEFAULT 0,
      signup_bonus_granted INTEGER NOT NULL DEFAULT 0,
      wallet_balance REAL NOT NULL DEFAULT 0,
      account_source TEXT NOT NULL DEFAULT 'new',
      migration_status TEXT NOT NULL DEFAULT '',
      password_setup_required INTEGER NOT NULL DEFAULT 0,
      profile_review_required INTEGER NOT NULL DEFAULT 0,
      email_status TEXT NOT NULL DEFAULT 'unverified',
      created_date TEXT,
      updated_date TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_auth (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      reset_token_hash TEXT,
      reset_expires_at TEXT,
      verify_token_hash TEXT,
      verify_expires_at TEXT,
      must_reset_password INTEGER NOT NULL DEFAULT 0,
      created_date TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_sessions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS points_ledger (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      points_amount INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      source TEXT,
      reason TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      related_transaction_id TEXT,
      created_by_admin_id TEXT,
      created_date TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS loyalty_memberships (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      activated_at TEXT,
      expires_at TEXT,
      source TEXT,
      approved_by TEXT,
      related_transaction_id TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      label TEXT,
      full_name TEXT,
      phone TEXT,
      governorate TEXT,
      area TEXT,
      street TEXT,
      building TEXT,
      floor TEXT,
      instructions TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_date TEXT,
      updated_date TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS recovery_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      requested_email TEXT,
      submitted_name TEXT,
      submitted_phone TEXT,
      submitted_legacy_id TEXT,
      submitted_card_number TEXT,
      match_notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      reviewed_at TEXT,
      reject_reason TEXT,
      created_date TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      hit_count INTEGER NOT NULL DEFAULT 0,
      created_date TEXT
    )`),
  ]);
  const alters = [
    "ALTER TABLE customer_auth ADD COLUMN verify_token_hash TEXT",
    "ALTER TABLE customer_auth ADD COLUMN verify_expires_at TEXT",
  ];
  for (const sql of alters) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      /* column already exists */
    }
  }
  const indexes = [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_legacy ON customers (legacy_user_id) WHERE legacy_user_id IS NOT NULL AND legacy_user_id != ''",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_login_email ON customers (email_normalized) WHERE email_normalized != '' AND email_status IN ('valid','unverified','verified')",
    'CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile_normalized)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_hash ON customer_sessions (token_hash)',
    'CREATE INDEX IF NOT EXISTS idx_recovery_status ON recovery_requests (status, created_date)',
    'CREATE INDEX IF NOT EXISTS idx_addresses_customer ON customer_addresses (customer_id)',
  ];
  for (const sql of indexes) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      /* D1/SQLite version may not support partial unique indexes */
    }
  }
}

function publicCustomer(row, extras = {}) {
  if (!row) return null;
  const now = new Date();
  const expiry = row.card_expiry_date ? String(row.card_expiry_date).split('T')[0] : '';
  const today = todayStr(now);
  const card_active = Boolean(row.has_winwin_card) && expiry && expiry >= today;
  const days_left = expiry ? Math.ceil((new Date(`${expiry}T23:59:59.000Z`).getTime() - now.getTime()) / 86400000) : 0;
  return {
    id: row.id,
    legacy_user_id: row.legacy_user_id || '',
    full_name: row.full_name || '',
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    email: row.email || '',
    mobile: row.mobile || '',
    country: row.country || '',
    points: Number(row.points) || 0,
    has_winwin_card: Boolean(row.has_winwin_card),
    card_number: row.card_number || '',
    card_purchase_date: row.card_purchase_date || '',
    card_expiry_date: row.card_expiry_date || '',
    card_active,
    card_days_left: days_left,
    card_expiring_soon: card_active && days_left > 0 && days_left <= 2,
    card_expired: Boolean(expiry) && !card_active,
    draw_entries: Number(row.draw_entries) || 0,
    last_signin_date: row.last_signin_date || '',
    ambassador_code: row.ambassador_code || '',
    is_ambassador: Boolean(row.is_ambassador),
    wallet_balance: Number(row.wallet_balance) || 0,
    signup_bonus_granted: Boolean(row.signup_bonus_granted),
    account_source: row.account_source || ACCOUNT_SOURCE.NEW,
    migration_status: row.migration_status || '',
    password_setup_required: Boolean(row.password_setup_required),
    profile_review_required: Boolean(row.profile_review_required),
    email_status: row.email_status || EMAIL_STATUS.UNVERIFIED,
    server_today: today,
    ...extras,
  };
}

async function getCustomer(env, id) {
  return env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
}

async function getAuth(env, customerId) {
  return env.DB.prepare('SELECT * FROM customer_auth WHERE customer_id = ?').bind(customerId).first();
}

async function createSession(env, customerId) {
  const token = randomToken();
  await env.DB.prepare(
    'INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(randomId(), customerId, await sha256(token), addDaysIso(SESSION_DAYS))
    .run();
  return token;
}

async function requireCustomer(env, token) {
  if (!token) return null;
  const hash = await sha256(token);
  const session = await env.DB.prepare(
    'SELECT * FROM customer_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(hash, nowIso())
    .first();
  if (!session) return null;
  const customer = await getCustomer(env, session.customer_id);
  if (!customer) return null;
  return { session, customer };
}

async function requireAdmin(env, body, request) {
  const token = String(body?.admin_session_token || request.headers.get('X-Admin-Token') || '');
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(hash, nowIso())
    .first();
}

async function creditPoints(env, opts) {
  const existing = await env.DB.prepare('SELECT * FROM points_ledger WHERE idempotency_key = ?')
    .bind(opts.idempotency_key)
    .first();
  if (existing) {
    const customer = await getCustomer(env, opts.customer.id);
    return { duplicate: true, customer, ledger: existing };
  }
  const amount = Math.trunc(Number(opts.amount) || 0);
  const ledgerId = randomId();
  const nextPoints = Math.max(0, (Number(opts.customer.points) || 0) + amount);
  const loginExtra = opts.type === LEDGER_TYPE.DAILY_LOGIN;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO points_ledger (id, customer_id, points_amount, type, source, reason, idempotency_key, related_transaction_id, created_by_admin_id, created_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        ledgerId,
        opts.customer.id,
        amount,
        opts.type,
        opts.source || opts.type,
        opts.reason || '',
        opts.idempotency_key,
        opts.related_transaction_id || '',
        opts.created_by_admin_id || '',
        nowIso(),
      ),
      loginExtra
        ? env.DB.prepare('UPDATE customers SET points = ?, last_signin_date = ?, updated_date = ? WHERE id = ?')
            .bind(nextPoints, todayStr(), nowIso(), opts.customer.id)
        : env.DB.prepare('UPDATE customers SET points = ?, updated_date = ? WHERE id = ?')
            .bind(nextPoints, nowIso(), opts.customer.id),
    ]);
  } catch {
    const customer = await getCustomer(env, opts.customer.id);
    const raced = await env.DB.prepare('SELECT * FROM points_ledger WHERE idempotency_key = ?')
      .bind(opts.idempotency_key)
      .first();
    if (raced) return { duplicate: true, customer, ledger: raced };
    throw new Error('Could not update points');
  }
  const customer = await getCustomer(env, opts.customer.id);
  return { duplicate: false, customer };
}

async function recordImportedBalance(env, customerId, points) {
  const key = `MIGRATION_BALANCE:${customerId}`;
  const existing = await env.DB.prepare('SELECT id FROM points_ledger WHERE idempotency_key = ?').bind(key).first();
  if (existing) return;
  await env.DB.prepare(
    `INSERT INTO points_ledger (id, customer_id, points_amount, type, source, reason, idempotency_key, related_transaction_id, created_by_admin_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
  )
    .bind(randomId(), customerId, points, LEDGER_TYPE.MIGRATION_BALANCE, LEDGER_TYPE.MIGRATION_BALANCE, 'Imported legacy points balance', key, nowIso())
    .run();
}

async function sendEmail(env, { to, subject, text }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !to) return { sent: false };
  const from = env.MAIL_FROM || 'WinWin <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}

async function issueResetToken(env, customer, origin) {
  const raw = randomToken();
  const reset_token_hash = await sha256(raw);
  const reset_expires_at = addHoursIso(RESET_HOURS);
  const auth = await getAuth(env, customer.id);
  if (auth) {
    await env.DB.prepare(
      'UPDATE customer_auth SET reset_token_hash = ?, reset_expires_at = ? WHERE customer_id = ?',
    )
      .bind(reset_token_hash, reset_expires_at, customer.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO customer_auth (id, customer_id, password_hash, reset_token_hash, reset_expires_at, must_reset_password, created_date)
       VALUES (?, ?, '', ?, ?, 1, ?)`,
    )
      .bind(randomId(), customer.id, reset_token_hash, reset_expires_at, nowIso())
      .run();
  }
  const base = String(origin || env.APP_ORIGIN || '').replace(/\/$/, '');
  const link = base ? `${base}/reset-password?token=${encodeURIComponent(raw)}` : '';
  if (customer.email && isValidEmail(customer.email) && link) {
    await sendEmail(env, {
      to: customer.email,
      subject: 'Set up your WinWin password',
      text: `Hi ${customer.full_name || ''},\n\nSet your WinWin password using this link. It expires in 1 hour and can be used once:\n${link}\n\nIf you did not request this, ignore this email.\n\n– WinWin`,
    });
  }
  return { raw, link };
}

async function issueVerifyToken(env, customer, origin) {
  if (!customer?.email || !isValidEmail(customer.email)) return { sent: false };
  const raw = randomToken();
  const verify_token_hash = await sha256(raw);
  const verify_expires_at = addHoursIso(24);
  const auth = await getAuth(env, customer.id);
  if (auth) {
    await env.DB.prepare(
      'UPDATE customer_auth SET verify_token_hash = ?, verify_expires_at = ? WHERE customer_id = ?',
    )
      .bind(verify_token_hash, verify_expires_at, customer.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO customer_auth (id, customer_id, password_hash, reset_token_hash, reset_expires_at, verify_token_hash, verify_expires_at, must_reset_password, created_date)
       VALUES (?, ?, '', '', '', ?, ?, 0, ?)`,
    )
      .bind(randomId(), customer.id, verify_token_hash, verify_expires_at, nowIso())
      .run();
  }
  const base = String(origin || env.APP_ORIGIN || '').replace(/\/$/, '');
  const link = base ? `${base}/verify-email?token=${encodeURIComponent(raw)}` : '';
  if (!link) return { sent: false, raw };
  const mailed = await sendEmail(env, {
    to: customer.email,
    subject: 'Verify your WinWin email',
    text: `Hi ${customer.full_name || ''},\n\nConfirm your email with this link. It expires in 24 hours:\n${link}\n\n– WinWin`,
  });
  return { sent: mailed.sent, raw, link };
}

async function verifyEmail(env, body) {
  const token = String(body.token || '');
  if (!token) return json({ error: 'Invalid or expired verification link' }, 400);
  const verify_token_hash = await sha256(token);
  const auth = await env.DB.prepare('SELECT * FROM customer_auth WHERE verify_token_hash = ?').bind(verify_token_hash).first();
  if (!auth) return json({ error: 'Invalid or expired verification link' }, 400);
  if (!auth.verify_expires_at || new Date(auth.verify_expires_at).getTime() <= Date.now()) {
    return json({ error: 'This verification link has expired. Request a new one from your account.' }, 400);
  }
  await env.DB.prepare(
    "UPDATE customer_auth SET verify_token_hash = '', verify_expires_at = '' WHERE id = ?",
  )
    .bind(auth.id)
    .run();
  await env.DB.prepare(
    `UPDATE customers SET email_status = ?, updated_date = ? WHERE id = ? AND account_source = 'new'`,
  )
    .bind(EMAIL_STATUS.VERIFIED, nowIso(), auth.customer_id)
    .run();
  return json({ success: true });
}

function findLoginEmail(env, email) {
  return env.DB.prepare(
    `SELECT * FROM customers
     WHERE email_normalized = ?
       AND email_status IN ('valid', 'unverified', 'verified')
     LIMIT 1`,
  ).bind(email);
}

async function loginCustomer(env, body, request) {
  const allowed = await rateLimit(env, `login:${clientIp(request)}`, 8, 15 * 60);
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'Invalid email or password' }, 401);

  const customer = await findLoginEmail(env, email).first();
  if (!customer) return json({ error: 'Invalid email or password' }, 401);

  if (customer.account_source === ACCOUNT_SOURCE.MIGRATED && customer.password_setup_required) {
    return json({
      error: 'Your account has been migrated. Set up a new password to continue.',
      code: 'MIGRATED_SETUP_REQUIRED',
    }, 403);
  }

  const auth = await getAuth(env, customer.id);
  const ok = auth?.password_hash ? await verifyPassword(password, auth.password_hash) : false;
  if (!ok) return json({ error: 'Invalid email or password' }, 401);

  const token = await createSession(env, customer.id);
  return json({ success: true, session_token: token, customer: publicCustomer(customer) });
}

async function registerCustomer(env, body, request) {
  const allowed = await rateLimit(env, `register:${clientIp(request)}`, 5, 60 * 60);
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const names = splitName(body.full_name, body.first_name, body.last_name);
  const email = normalizeEmail(body.email);
  const mobile = String(body.mobile || '').trim();
  const password = String(body.password || '');
  const country = String(body.country || '').trim();
  const ambassador_code = String(body.ambassador_code || '').trim();
  if (!names.full_name || !email || !mobile || !password) {
    return json({ error: 'Name, email, phone and password are required' }, 400);
  }
  if (!isValidEmail(email)) return json({ error: 'Enter a valid email address' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const existing = await findLoginEmail(env, email).first();
  if (existing) return json({ error: 'Email already registered. Please sign in.' }, 409);

  const id = randomId();
  const created = nowIso();
  await env.DB.prepare(
    `INSERT INTO customers (
      id, legacy_user_id, full_name, first_name, last_name, email, email_normalized, mobile, mobile_normalized,
      country, points, has_winwin_card, card_number, card_purchase_date, card_expiry_date, draw_entries,
      last_signin_date, ambassador_code, is_ambassador, signup_bonus_granted, wallet_balance, account_source,
      migration_status, password_setup_required, profile_review_required, email_status, created_date, updated_date
    ) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', '', '', 0, '', ?, 0, 0, 0, 'new', '', 0, 0, 'unverified', ?, ?)`,
  )
    .bind(
      id,
      names.full_name,
      names.first_name,
      names.last_name,
      email,
      email,
      mobile,
      normalizePhone(mobile),
      country,
      ambassador_code,
      created,
      created,
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO customer_auth (id, customer_id, password_hash, reset_token_hash, reset_expires_at, must_reset_password, created_date)
     VALUES (?, ?, ?, '', '', 0, ?)`,
  )
    .bind(randomId(), id, await hashPassword(password), created)
    .run();

  let customer = await getCustomer(env, id);
  let pointsAwarded = 0;
  if (customer.account_source === ACCOUNT_SOURCE.NEW && !customer.signup_bonus_granted) {
    const credited = await creditPoints(env, {
      customer,
      amount: SIGNUP_POINTS,
      type: LEDGER_TYPE.SIGNUP_BONUS,
      reason: 'New account registration bonus',
      source: LEDGER_TYPE.SIGNUP_BONUS,
      idempotency_key: `SIGNUP_BONUS:${id}`,
    });
    pointsAwarded = credited.duplicate ? 0 : SIGNUP_POINTS;
    await env.DB.prepare('UPDATE customers SET signup_bonus_granted = 1, updated_date = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
    customer = credited.customer;
  }
  await issueVerifyToken(env, customer, body.app_origin);
  const token = await createSession(env, id);
  const fresh = await getCustomer(env, id);
  return json({
    success: true,
    session_token: token,
    customer: publicCustomer(fresh || customer),
    points_awarded: pointsAwarded,
  }, 201);
}

async function requestPasswordReset(env, body, request) {
  const allowed = await rateLimit(env, `reset:${clientIp(request)}`, 5, 60 * 60);
  const email = normalizeEmail(body.email);
  if (allowed && email) {
    const customer = await findLoginEmail(env, email).first();
    if (
      customer &&
      (customer.email_status === EMAIL_STATUS.VALID ||
        customer.email_status === EMAIL_STATUS.UNVERIFIED ||
        customer.email_status === EMAIL_STATUS.VERIFIED)
    ) {
      await issueResetToken(env, customer, body.app_origin);
    }
  }
  return json({ success: true });
}

async function resetPassword(env, body) {
  const token = String(body.token || body.reset_token || '');
  const newPassword = String(body.new_password || body.newPassword || '');
  if (!token) return json({ error: 'Invalid or expired reset link' }, 400);
  if (newPassword.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
  const reset_token_hash = await sha256(token);
  const auth = await env.DB.prepare('SELECT * FROM customer_auth WHERE reset_token_hash = ?').bind(reset_token_hash).first();
  if (!auth) return json({ error: 'Invalid or expired reset link' }, 400);
  if (!auth.reset_expires_at || new Date(auth.reset_expires_at).getTime() <= Date.now()) {
    return json({ error: 'This setup link has expired. Request a new one.' }, 400);
  }

  await env.DB.prepare(
    `UPDATE customer_auth
     SET password_hash = ?, reset_token_hash = '', reset_expires_at = '', must_reset_password = 0
     WHERE id = ?`,
  )
    .bind(await hashPassword(newPassword), auth.id)
    .run();

  const customer = await getCustomer(env, auth.customer_id);
  const migrated = customer?.account_source === ACCOUNT_SOURCE.MIGRATED;
  await env.DB.prepare(
    `UPDATE customers SET
      password_setup_required = 0,
      migration_status = CASE WHEN account_source = 'migrated' THEN 'claimed' ELSE migration_status END,
      email_status = CASE WHEN email_normalized != '' THEN 'verified' ELSE email_status END,
      updated_date = ?
     WHERE id = ?`,
  )
    .bind(nowIso(), auth.customer_id)
    .run();

  await env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').bind(auth.customer_id).run();
  await env.DB.prepare(
    'UPDATE recovery_requests SET status = ? WHERE customer_id = ? AND status = ?',
  )
    .bind(RECOVERY_STATUS.COMPLETED, auth.customer_id, RECOVERY_STATUS.APPROVED)
    .run();
  const session_token = await createSession(env, auth.customer_id);
  const fresh = await getCustomer(env, auth.customer_id);
  return json({
    success: true,
    session_token,
    customer: publicCustomer(fresh),
    migrated,
  });
}

async function logoutCustomer(env, body) {
  const token = String(body.session_token || '');
  if (token) {
    await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  }
  return json({ success: true });
}

async function getMyAccount(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  return json({ success: true, customer: publicCustomer(authz.customer) });
}

async function dailySignIn(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  if (authz.customer.password_setup_required) {
    return json({ error: 'Finish password setup before claiming daily points' }, 403);
  }
  const today = todayStr();
  const credited = await creditPoints(env, {
    customer: authz.customer,
    amount: DAILY_POINTS,
    type: LEDGER_TYPE.DAILY_LOGIN,
    reason: 'Daily sign-in bonus',
    source: LEDGER_TYPE.DAILY_LOGIN,
    idempotency_key: `DAILY_LOGIN:${authz.customer.id}:${today}`,
  });
  return json({
    success: !credited.duplicate,
    already_signed_in: credited.duplicate,
    points_awarded: credited.duplicate ? 0 : DAILY_POINTS,
    customer: publicCustomer(credited.customer),
    today,
  });
}

async function reviewProfile(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  const names = splitName(body.full_name, body.first_name, body.last_name);
  const mobile = String(body.mobile || '').trim();
  if (!names.full_name) return json({ error: 'Name is required' }, 400);
  if (!mobile) return json({ error: 'Phone number is required' }, 400);
  let email = authz.customer.email;
  let emailNorm = authz.customer.email_normalized;
  let emailStatus = authz.customer.email_status;
  if (body.email != null && normalizeEmail(body.email) !== normalizeEmail(authz.customer.email)) {
    const next = normalizeEmail(body.email);
    if (!isValidEmail(next)) return json({ error: 'Enter a valid email address' }, 400);
    const taken = await findLoginEmail(env, next).first();
    if (taken && taken.id !== authz.customer.id) {
      return json({ error: 'That email is already used by another account.' }, 409);
    }
    email = next;
    emailNorm = next;
    emailStatus = EMAIL_STATUS.UNVERIFIED;
  }
  await env.DB.prepare(
    `UPDATE customers SET full_name = ?, first_name = ?, last_name = ?, mobile = ?, mobile_normalized = ?,
      country = ?, email = ?, email_normalized = ?, email_status = ?, profile_review_required = 0, updated_date = ? WHERE id = ?`,
  )
    .bind(
      names.full_name,
      names.first_name,
      names.last_name,
      mobile,
      normalizePhone(mobile),
      String(body.country || authz.customer.country || '').trim(),
      email,
      emailNorm,
      emailStatus,
      nowIso(),
      authz.customer.id,
    )
    .run();
  const fresh = await getCustomer(env, authz.customer.id);
  return json({ success: true, customer: publicCustomer(fresh) });
}

async function listAddresses(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_date DESC',
  )
    .bind(authz.customer.id)
    .all();
  return json({ success: true, addresses: results || [] });
}

async function saveAddress(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  const full_name = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  const governorate = String(body.governorate || body.area || '').trim();
  const street = String(body.street || '').trim();
  if (!full_name || !phone || !governorate || !street) {
    return json({ error: 'Name, phone, area and street are required' }, 400);
  }
  const id = body.id && String(body.id);
  const isDefault = body.is_default ? 1 : 0;
  if (isDefault) {
    await env.DB.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').bind(authz.customer.id).run();
  }
  if (id) {
    const existing = await env.DB.prepare(
      'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
    )
      .bind(id, authz.customer.id)
      .first();
    if (!existing) return json({ error: 'Address not found' }, 404);
    await env.DB.prepare(
      `UPDATE customer_addresses SET label=?, full_name=?, phone=?, governorate=?, area=?, street=?, building=?, floor=?, instructions=?, is_default=?, updated_date=?
       WHERE id=? AND customer_id=?`,
    )
      .bind(
        String(body.label || 'Home').trim(),
        full_name,
        phone,
        governorate,
        String(body.area || '').trim(),
        street,
        String(body.building || '').trim(),
        String(body.floor || '').trim(),
        String(body.instructions || '').trim(),
        isDefault,
        nowIso(),
        id,
        authz.customer.id,
      )
      .run();
    return json({ success: true, id });
  }
  const newId = randomId();
  await env.DB.prepare(
    `INSERT INTO customer_addresses (id, customer_id, label, full_name, phone, governorate, area, street, building, floor, instructions, is_default, created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId,
      authz.customer.id,
      String(body.label || 'Home').trim(),
      full_name,
      phone,
      governorate,
      String(body.area || '').trim(),
      street,
      String(body.building || '').trim(),
      String(body.floor || '').trim(),
      String(body.instructions || '').trim(),
      isDefault,
      nowIso(),
      nowIso(),
    )
    .run();
  return json({ success: true, id: newId }, 201);
}

async function submitRecovery(env, body, request) {
  const allowed = await rateLimit(env, `recovery:${clientIp(request)}`, 5, 60 * 60);
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const requested_email = normalizeEmail(body.requested_email || body.email);
  const submitted_phone = String(body.phone || body.mobile || '').trim();
  const submitted_legacy_id = String(body.legacy_user_id || body.customer_id || '').trim();
  const submitted_card_number = String(body.card_number || '').trim();
  const submitted_name = String(body.full_name || body.name || '').trim();
  if (!requested_email || !isValidEmail(requested_email)) {
    return json({ error: 'Enter a valid new email address' }, 400);
  }
  if (!submitted_phone && !submitted_legacy_id && !submitted_card_number) {
    return json({ error: 'Provide your phone, customer ID, or loyalty card number' }, 400);
  }

  const emailTaken = await findLoginEmail(env, requested_email).first();
  if (emailTaken) {
    return json({ error: 'That email is already used by another account.' }, 409);
  }

  const phoneNorm = normalizePhone(submitted_phone);
  let matches = [];
  if (submitted_legacy_id) {
    const row = await env.DB.prepare(
      `SELECT * FROM customers WHERE account_source = 'migrated' AND (legacy_user_id = ? OR id = ?) LIMIT 5`,
    )
      .bind(submitted_legacy_id, submitted_legacy_id)
      .first();
    if (row) matches.push(row);
  }
  if (submitted_card_number) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM customers WHERE account_source = 'migrated' AND card_number = ? LIMIT 5`,
    )
      .bind(submitted_card_number)
      .all();
    matches.push(...(results || []));
  }
  if (phoneNorm) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM customers WHERE account_source = 'migrated' AND mobile_normalized = ? LIMIT 5`,
    )
      .bind(phoneNorm)
      .all();
    matches.push(...(results || []));
  }
  const unique = [];
  const seen = new Set();
  for (const row of matches) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      unique.push(row);
    }
  }
  const strong = unique.filter((row) => {
    const phoneOk = phoneNorm && row.mobile_normalized === phoneNorm;
    const idOk = submitted_legacy_id && (row.legacy_user_id === submitted_legacy_id || row.id === submitted_legacy_id);
    const cardOk = submitted_card_number && row.card_number === submitted_card_number;
    return (idOk && (phoneOk || cardOk)) || (cardOk && phoneOk);
  });

  const attached = strong.length === 1 ? strong[0] : unique.length === 1 ? unique[0] : null;
  const customer = attached;
  const auto = Boolean(
    strong.length === 1 &&
      customer &&
      customer.migration_status !== MIGRATION_STATUS.CLAIMED,
  );

  const requestId = randomId();
  await env.DB.prepare(
    `INSERT INTO recovery_requests (
      id, customer_id, requested_email, submitted_name, submitted_phone, submitted_legacy_id, submitted_card_number,
      match_notes, status, created_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      requestId,
      customer?.id || '',
      requested_email,
      submitted_name,
      submitted_phone,
      submitted_legacy_id,
      submitted_card_number,
      auto ? 'auto_eligible' : `matches=${unique.length}`,
      auto ? RECOVERY_STATUS.APPROVED : RECOVERY_STATUS.PENDING,
      nowIso(),
    )
    .run();

  if (auto && customer) {
    await applyApprovedRecovery(env, customer, requested_email, body.app_origin);
    await env.DB.prepare('UPDATE recovery_requests SET status = ? WHERE id = ?')
      .bind(RECOVERY_STATUS.APPROVED, requestId)
      .run();
    return json({
      success: true,
      auto_approved: true,
      message: 'We found your account. Check the new email for password setup instructions.',
    });
  }

  return json({
    success: true,
    auto_approved: false,
    message: 'Your recovery request was submitted. An admin will review it.',
  });
}

async function applyApprovedRecovery(env, customer, requestedEmail, origin) {
  const taken = await findLoginEmail(env, requestedEmail).first();
  if (taken && taken.id !== customer.id) {
    throw new Error('That email is already used by another account.');
  }
  await env.DB.prepare(
    `UPDATE customers SET email = ?, email_normalized = ?, email_status = ?, migration_status = ?,
      password_setup_required = 1, profile_review_required = 1, updated_date = ? WHERE id = ?`,
  )
    .bind(requestedEmail, requestedEmail, EMAIL_STATUS.UNVERIFIED, MIGRATION_STATUS.PENDING, nowIso(), customer.id)
    .run();
  const fresh = await getCustomer(env, customer.id);
  await issueResetToken(env, { ...fresh, email: requestedEmail }, origin);
}

async function listRecoveryRequests(env, body) {
  const status = String(body.status || '');
  const sql = status
    ? 'SELECT * FROM recovery_requests WHERE status = ? ORDER BY created_date DESC LIMIT 200'
    : 'SELECT * FROM recovery_requests ORDER BY created_date DESC LIMIT 200';
  const result = status ? await env.DB.prepare(sql).bind(status).all() : await env.DB.prepare(sql).all();
  const requests = [];
  for (const row of result.results || []) {
    const customer = row.customer_id ? await getCustomer(env, row.customer_id) : null;
    requests.push({
      ...row,
      customer: customer ? publicCustomer(customer) : null,
    });
  }
  return json({ success: true, requests });
}

async function reviewRecovery(env, body, admin) {
  const id = String(body.request_id || '');
  const action = String(body.action || '').toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM recovery_requests WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Request not found' }, 404);
  if (action === 'reject') {
    await env.DB.prepare(
      'UPDATE recovery_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, reject_reason = ? WHERE id = ?',
    )
      .bind(RECOVERY_STATUS.REJECTED, admin.id, nowIso(), String(body.reject_reason || '').trim(), id)
      .run();
    return json({ success: true });
  }
  if (action !== 'approve') return json({ error: 'Unknown action' }, 400);
  const customerId = String(row.customer_id || body.customer_id || '');
  if (!customerId) return json({ error: 'No matching customer on this request. Attach a customer first.' }, 400);
  const customer = await getCustomer(env, customerId);
  if (!customer) return json({ error: 'Customer not found' }, 404);
  if (customer.account_source !== ACCOUNT_SOURCE.MIGRATED) {
    return json({ error: 'Recovery can only be applied to migrated accounts' }, 400);
  }
  if (customer.migration_status === MIGRATION_STATUS.CLAIMED && !customer.password_setup_required) {
    return json({ error: 'This account is already active' }, 409);
  }
  try {
    await applyApprovedRecovery(env, customer, row.requested_email, body.app_origin);
  } catch (err) {
    return json({ error: err.message }, 409);
  }
  await env.DB.prepare(
    'UPDATE recovery_requests SET status = ?, customer_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
  )
    .bind(RECOVERY_STATUS.APPROVED, customerId, admin.id, nowIso(), id)
    .run();
  return json({ success: true });
}

async function listCustomers(env) {
  const { results } = await env.DB.prepare('SELECT * FROM customers ORDER BY created_date DESC LIMIT 2000').all();
  return json({ success: true, customers: (results || []).map((row) => publicCustomer(row)) });
}

async function getLedger(env, body) {
  const customerId = String(body.customer_id || '');
  if (!customerId) return json({ ledger: [] });
  const { results } = await env.DB.prepare(
    'SELECT * FROM points_ledger WHERE customer_id = ? ORDER BY created_date DESC LIMIT 200',
  )
    .bind(customerId)
    .all();
  return json({ success: true, ledger: results || [] });
}

async function adjustPoints(env, body, admin) {
  const customer = await getCustomer(env, String(body.customer_id || ''));
  if (!customer) return json({ error: 'Customer not found' }, 404);
  let amount = Math.trunc(Number(body.amount || body.points || 0));
  if (body.mode === 'remove' || body.mode === 'deduct') amount = -Math.abs(amount);
  if (!amount) return json({ error: 'Amount required' }, 400);
  const credited = await creditPoints(env, {
    customer,
    amount,
    type: LEDGER_TYPE.MANUAL_ADMIN,
    reason: String(body.reason || 'Admin adjustment'),
    source: LEDGER_TYPE.MANUAL_ADMIN,
    idempotency_key: `MANUAL_ADMIN:${customer.id}:${randomId()}`,
    created_by_admin_id: admin.id,
  });
  return json({ success: true, customer: publicCustomer(credited.customer) });
}

async function adminUpdateCustomer(env, body) {
  const customer = await getCustomer(env, String(body.customer_id || body.id || ''));
  if (!customer) return json({ error: 'Customer not found' }, 404);
  const names = splitName(
    body.full_name ?? customer.full_name,
    body.first_name ?? customer.first_name,
    body.last_name ?? customer.last_name,
  );
  const mobile = body.mobile != null ? String(body.mobile).trim() : customer.mobile;
  const country = body.country != null ? String(body.country).trim() : customer.country;
  const ambassador_code = body.ambassador_code != null ? String(body.ambassador_code).trim() : customer.ambassador_code;
  const card_number = body.card_number != null ? String(body.card_number).trim() : customer.card_number;
  await env.DB.prepare(
    `UPDATE customers SET full_name = ?, first_name = ?, last_name = ?, mobile = ?, mobile_normalized = ?,
      country = ?, ambassador_code = ?, card_number = ?, updated_date = ? WHERE id = ?`,
  )
    .bind(
      names.full_name,
      names.first_name,
      names.last_name,
      mobile,
      normalizePhone(mobile),
      country,
      ambassador_code,
      card_number,
      nowIso(),
      customer.id,
    )
    .run();
  const fresh = await getCustomer(env, customer.id);
  return json({ success: true, customer: publicCustomer(fresh) });
}

async function importLegacyCustomers(env, body) {
  const records = Array.isArray(body.customers) ? body.customers : [];
  const report = emptyMigrationReport();
  report.total = records.length;
  const emailCounts = countEmails(records, (row) => row.email || row.email_address || row.Email);
  for (const record of records) {
    try {
      const mapped = mapLegacyRecord(record, emailCounts);
      if (!mapped.legacy_user_id) {
        report.errors += 1;
        report.error_ids.push('missing-legacy-id');
        continue;
      }
      const existing = await env.DB.prepare('SELECT id FROM customers WHERE legacy_user_id = ?')
        .bind(mapped.legacy_user_id)
        .first();
      if (existing) {
        report.skipped += 1;
        continue;
      }
      const id = randomId();
      const loginEmail = mapped.email_status === EMAIL_STATUS.VALID ? mapped.email : '';
      await env.DB.prepare(
        `INSERT INTO customers (
          id, legacy_user_id, full_name, first_name, last_name, email, email_normalized, mobile, mobile_normalized,
          country, points, has_winwin_card, card_number, card_purchase_date, card_expiry_date, draw_entries,
          last_signin_date, ambassador_code, is_ambassador, signup_bonus_granted, wallet_balance, account_source,
          migration_status, password_setup_required, profile_review_required, email_status, created_date, updated_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, 0, 1, 0, 'migrated', ?, 1, 1, ?, ?, ?)`,
      )
        .bind(
          id,
          mapped.legacy_user_id,
          mapped.full_name,
          mapped.first_name,
          mapped.last_name,
          mapped.email,
          loginEmail,
          mapped.mobile,
          normalizePhone(mapped.mobile),
          mapped.country,
          mapped.points,
          mapped.has_winwin_card ? 1 : 0,
          mapped.card_number,
          mapped.card_purchase_date,
          mapped.card_expiry_date,
          mapped.ambassador_code,
          mapped.migration_status,
          mapped.email_status,
          mapped.created_date || nowIso(),
          nowIso(),
        )
        .run();
      await recordImportedBalance(env, id, mapped.points);
      if (mapped.has_winwin_card || mapped.card_expiry_date) {
        const expiry = mapped.card_expiry_date;
        const active = mapped.has_winwin_card && expiry && String(expiry).split('T')[0] >= todayStr();
        await env.DB.prepare(
          `INSERT INTO loyalty_memberships (id, customer_id, status, activated_at, expires_at, source, approved_by, related_transaction_id)
           VALUES (?, ?, ?, ?, ?, 'MIGRATION', '', '')`,
        )
          .bind(
            randomId(),
            id,
            active ? 'ACTIVE' : 'EXPIRED',
            mapped.card_purchase_date || nowIso(),
            expiry || '',
          )
          .run();
      }
      report.imported += 1;
      tallyEmailStatus(report, mapped.email_status);
    } catch (err) {
      report.errors += 1;
      report.error_ids.push(String(err.message || 'error').slice(0, 80));
    }
  }
  return json({ success: true, report });
}

async function adminSendPasswordSetup(env, body) {
  const customer = await getCustomer(env, String(body.customer_id || ''));
  if (!customer) return json({ error: 'Customer not found' }, 404);
  const issued = await issueResetToken(env, customer, body.app_origin);
  return json({ success: true, setup_url: issued.link || '' });
}

export async function customerFromToken(env, token) {
  const authz = await requireCustomer(env, token);
  return authz?.customer || null;
}

export async function saveCheckoutAddress(env, customerId, address = {}, save) {
  if (!save || !customerId) return;
  const full_name = String(address.full_name || '').trim();
  const phone = String(address.phone || '').trim();
  const governorate = String(address.governorate || address.area || '').trim();
  const street = String(address.street || '').trim();
  if (!full_name || !phone || !governorate || !street) return;
  const existingId = String(address.id || '');
  if (existingId) {
    const existing = await env.DB.prepare(
      'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
    )
      .bind(existingId, customerId)
      .first();
    if (existing) {
      await env.DB.prepare(
        `UPDATE customer_addresses SET label=?, full_name=?, phone=?, governorate=?, area=?, street=?, building=?, floor=?, instructions=?, updated_date=?
         WHERE id=? AND customer_id=?`,
      )
        .bind(
          String(address.label || 'Home').trim(),
          full_name,
          phone,
          governorate,
          String(address.area || '').trim(),
          street,
          String(address.building || '').trim(),
          String(address.floor || '').trim(),
          String(address.instructions || '').trim(),
          nowIso(),
          existingId,
          customerId,
        )
        .run();
      return;
    }
  }
  await env.DB.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').bind(customerId).run();
  await env.DB.prepare(
    `INSERT INTO customer_addresses (id, customer_id, label, full_name, phone, governorate, area, street, building, floor, instructions, is_default, created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      randomId(),
      customerId,
      String(address.label || 'Home').trim(),
      full_name,
      phone,
      governorate,
      String(address.area || '').trim(),
      street,
      String(address.building || '').trim(),
      String(address.floor || '').trim(),
      String(address.instructions || '').trim(),
      nowIso(),
      nowIso(),
    )
    .run();
}

export async function handleCustomerFn(env, name, body, request) {
  if (name === 'loginCustomer') return loginCustomer(env, body, request);
  if (name === 'registerCustomer') return registerCustomer(env, body, request);
  if (name === 'requestPasswordReset') return requestPasswordReset(env, body, request);
  if (name === 'resetPassword') return resetPassword(env, body);
  if (name === 'logoutCustomer') return logoutCustomer(env, body);
  if (name === 'getMyAccount') return getMyAccount(env, body);
  if (name === 'dailySignIn') return dailySignIn(env, body);
  if (name === 'reviewProfile') return reviewProfile(env, body);
  if (name === 'listAddresses') return listAddresses(env, body);
  if (name === 'saveAddress') return saveAddress(env, body);
  if (name === 'submitAccountRecovery') return submitRecovery(env, body, request);
  if (name === 'verifyEmail') return verifyEmail(env, body);
  if (name === 'listCustomers') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return listCustomers(env);
  }
  if (name === 'adminUpdateCustomer') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return adminUpdateCustomer(env, body);
  }
  if (name === 'getLedger') {
    const admin = await requireAdmin(env, body, request);
    if (admin) return getLedger(env, body);
    const authz = await requireCustomer(env, body.session_token);
    if (!authz) return json({ error: 'unauthorized' }, 401);
    return getLedger(env, { customer_id: authz.customer.id });
  }
  if (name === 'adjustPoints') {
    const admin = await requireAdmin(env, body, request);
    if (!admin) return json({ error: 'unauthorized' }, 401);
    return adjustPoints(env, body, admin);
  }
  if (name === 'importLegacyCustomers') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return importLegacyCustomers(env, body);
  }
  if (name === 'listRecoveryRequests') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return listRecoveryRequests(env, body);
  }
  if (name === 'reviewRecoveryRequest') {
    const admin = await requireAdmin(env, body, request);
    if (!admin) return json({ error: 'unauthorized' }, 401);
    return reviewRecovery(env, body, admin);
  }
  if (name === 'adminSendPasswordSetup') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return adminSendPasswordSetup(env, body);
  }
  return null;
}

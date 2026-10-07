import { corsHeaders } from '../src/lib/allowedOrigins.js';
import { Resend } from 'resend';
import {
  ACCOUNT_SOURCE,
  MIGRATION_STATUS,
  EMAIL_STATUS,
  RECOVERY_STATUS,
  LEDGER_TYPE,
  normalizeEmail,
  normalizePhone,
  phoneVariants,
  isValidEmail,
  splitName,
  countEmails,
  mapLegacyRecord,
  emptyMigrationReport,
  tallyEmailStatus,
  isUsablePhone,
  looksPlaceholderAmbassador,
  stripLegacySecrets,
} from './migration.js';
import { membershipExpiryDay, membershipExpiryIso } from '../src/lib/membershipTerm.js';

const SIGNUP_POINTS = 10;
const DAILY_POINTS = 2;
const SESSION_DAYS = 30;
const RESET_MINUTES = 30;
const PBKDF2_ITERS = 100000;
const RESET_REQUEST_MESSAGE = 'If an account exists for this email, a password reset link has been sent.';
const EMAIL_TIMEOUT_MS = 8000;
const LOYALTY_BONUS_POINTS = 100;
const EXPIRING_SOON_DAYS = 2;
const LEBANON_OFFSET_MS = 3 * 60 * 60 * 1000;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { ...corsHeaders(), 'Cache-Control': 'no-store' },
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

function addMinutesIso(minutes) {
  const d = new Date();
  d.setTime(d.getTime() + minutes * 60 * 1000);
  return d.toISOString();
}

function dateOnly(iso) {
  if (!iso) return '';
  return String(iso).split('T')[0];
}

// Card dates are day-granularity and the store operates on Beirut time, so
// "today" for expiry purposes must follow Lebanon's clock, not the server's
// UTC day — otherwise cards flip active/expired a few hours too early or late.
function lebanonTodayParts(now = new Date()) {
  const shifted = new Date(now.getTime() + LEBANON_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

function calendarDaysUntil(value, now = new Date()) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const today = lebanonTodayParts(now);
  const start = Date.UTC(today.y, today.mo - 1, today.d);
  const end = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.round((end - start) / 86400000);
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
      card_renewal_reminder_sent INTEGER NOT NULL DEFAULT 0,
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
      last_login_at TEXT NOT NULL DEFAULT '',
      account_status TEXT NOT NULL DEFAULT 'active',
      marketing_emails_enabled INTEGER NOT NULL DEFAULT 0,
      marketing_prompt_shown_at TEXT NOT NULL DEFAULT '',
      marketing_prompt_dismissed_at TEXT NOT NULL DEFAULT '',
      marketing_subscribed_at TEXT NOT NULL DEFAULT '',
      marketing_unsubscribed_at TEXT NOT NULL DEFAULT '',
      last_marketing_email_sent_at TEXT NOT NULL DEFAULT '',
      last_marketing_email_attempted_at TEXT NOT NULL DEFAULT '',
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
    "ALTER TABLE customers ADD COLUMN last_login_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'",
    'ALTER TABLE customers ADD COLUMN marketing_emails_enabled INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE customers ADD COLUMN marketing_prompt_shown_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_prompt_dismissed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_subscribed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_unsubscribed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN last_marketing_email_sent_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN last_marketing_email_attempted_at TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE customers ADD COLUMN card_renewal_reminder_sent INTEGER NOT NULL DEFAULT 0',
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
  const days_left = calendarDaysUntil(row.card_expiry_date, now);
  const stillValid = days_left != null && days_left >= 0;
  const card_active = Boolean(row.has_winwin_card) && stillValid;
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
    card_days_left: stillValid ? days_left : 0,
    card_expiring_soon: card_active && days_left > 0 && days_left <= EXPIRING_SOON_DAYS,
    card_expired: Boolean(row.card_expiry_date) && !card_active,
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
    account_status: row.account_status || 'active',
    marketing_emails_enabled: Boolean(row.marketing_emails_enabled) && !row.marketing_unsubscribed_at,
    marketing_prompt_shown_at: row.marketing_prompt_shown_at || '',
    marketing_prompt_dismissed_at: row.marketing_prompt_dismissed_at || '',
    marketing_subscribed_at: row.marketing_subscribed_at || '',
    marketing_unsubscribed_at: row.marketing_unsubscribed_at || '',
    server_today: todayStr(now),
    ...extras,
  };
}

export async function getCustomer(env, id) {
  return env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
}

async function getAuth(env, customerId) {
  return env.DB.prepare('SELECT * FROM customer_auth WHERE customer_id = ?').bind(customerId).first();
}

async function createSession(env, customerId) {
  const token = randomToken();
  const loginAt = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(randomId(), customerId, await sha256(token), addDaysIso(SESSION_DAYS)),
    env.DB.prepare('UPDATE customers SET last_login_at = ? WHERE id = ?').bind(loginAt, customerId),
  ]);
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

export async function creditPoints(env, opts) {
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

function emailTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('EMAIL_TIMEOUT')), EMAIL_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function logEmailFailure(reason, details = {}) {
  console.error('[WinWin email] Transactional email failed', {
    provider: 'resend',
    reason,
    ...details,
  });
}

async function sendEmail(env, { to, subject, text, html }) {
  if (!to) return { sent: false, provider: 'resend' };
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) {
    logEmailFailure('configuration_missing', {
      missingApiKey: !apiKey,
      missingEmailFrom: !from,
    });
    return { sent: false, provider: 'resend' };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await emailTimeout(resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    }));
    if (result.error) {
      logEmailFailure('api_error', {
        errorType: String(result.error.name || 'unknown').slice(0, 80),
        statusCode: Number(result.error.statusCode) || null,
      });
      return { sent: false, provider: 'resend' };
    }
    return { sent: true, provider: 'resend' };
  } catch (error) {
    logEmailFailure(error?.message === 'EMAIL_TIMEOUT' ? 'timeout' : 'request_error', {
      errorType: String(error?.name || 'unknown').slice(0, 80),
    });
    return { sent: false, provider: 'resend' };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function passwordResetCopy(customer, link) {
  const name = escapeHtml(customer.first_name || customer.full_name || 'there');
  const safeLink = escapeHtml(link);
  const subject = 'Reset your WinWin password';
  const text = `Hi ${customer.first_name || customer.full_name || 'there'},

We received a request to reset your WinWin password.

Reset your password: ${link}

This secure link expires in 30 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email. Your password will not change.

The WinWin team`;
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#faf6ef;font-family:Arial,Helvetica,sans-serif;color:#321a19;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf6ef;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #eadfd2;border-radius:18px;overflow:hidden;">
            <tr>
              <td align="center" style="background:#4b0d1a;padding:28px 24px;">
                <img src="https://winwinleb.com/logo_winwin.png" width="190" alt="WinWin" style="display:block;width:190px;max-width:70%;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 18px;">
                <p style="margin:0 0 12px;font-size:16px;line-height:26px;">Hi ${name},</p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:34px;color:#321a19;">Reset your password</h1>
                <p style="margin:0 0 26px;font-size:15px;line-height:25px;color:#6f625b;">We received a request to reset your WinWin password. Use the secure button below to choose a new one.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 26px;">
                  <tr>
                    <td style="border-radius:10px;background:#9f1d35;">
                      <a href="${safeLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px;font-size:14px;line-height:23px;color:#6f625b;"><strong style="color:#321a19;">This link expires in 30 minutes</strong> and can only be used once.</p>
                <p style="margin:0;font-size:14px;line-height:23px;color:#81776e;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px 32px;">
                <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#9a8d83;">If the button does not work, copy and paste this address into your browser:</p>
                <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;"><a href="${safeLink}" style="color:#9f1d35;">${safeLink}</a></p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:#9a8d83;">© WinWin · winwinleb.com</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

function welcomeBackCopy(customer) {
  const name = customer.first_name || customer.full_name || 'there';
  const subject = 'Welcome to WinWin';
  const text = `Hi ${name},

Your WinWin account is ready.

If you did not set this password, contact WinWin right away.

See you in the shop,
The WinWin team`;
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Your WinWin account is ready.</p>
<p>If you did not set this password, contact WinWin right away.</p>
<p>See you in the shop,<br>The WinWin team</p>`;
  return { subject, text, html };
}

async function issueResetToken(env, customer, options = {}) {
  const raw = randomToken();
  const reset_token_hash = await sha256(raw);
  const reset_expires_at = addMinutesIso(RESET_MINUTES);
  const auth = await getAuth(env, customer.id);
  const previousReset = auth
    ? {
        hash: String(auth.reset_token_hash || ''),
        expiresAt: String(auth.reset_expires_at || ''),
      }
    : { hash: '', expiresAt: '' };
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
  const base = String(env.APP_ORIGIN || 'https://winwinleb.com').replace(/\/$/, '');
  const link = base ? `${base}/reset-password?token=${encodeURIComponent(raw)}` : '';
  let delivery = { sent: false, provider: 'resend' };
  if (customer.email && isValidEmail(customer.email) && link) {
    delivery = await sendEmail(env, { to: customer.email, ...passwordResetCopy(customer, link) });
  }
  if (!delivery.sent && options.restorePreviousOnFailure) {
    await env.DB.prepare(
      `UPDATE customer_auth SET reset_token_hash = ?, reset_expires_at = ?
       WHERE customer_id = ? AND reset_token_hash = ?`,
    )
      .bind(previousReset.hash, previousReset.expiresAt, customer.id, reset_token_hash)
      .run();
  }
  return { raw, link, sent: delivery.sent };
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
    `UPDATE customers SET email_status = ?, updated_date = ? WHERE id = ?`,
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

  let customer = await findLoginEmail(env, email).first();
  if (!customer) return json({ error: 'Invalid email or password' }, 401);

  const migratedSetupPending =
    customer.account_source === ACCOUNT_SOURCE.MIGRATED && customer.password_setup_required;
  const auth = await getAuth(env, customer.id);
  if (migratedSetupPending && !auth?.password_hash) {
    return json({
      error: 'Please reset your password to continue.',
      code: 'MIGRATED_SETUP_REQUIRED',
    }, 403);
  }

  const ok = auth?.password_hash ? await verifyPassword(password, auth.password_hash) : false;
  if (!ok) {
    if (migratedSetupPending) {
      return json({
        error: 'Please reset your password to continue.',
        code: 'MIGRATED_SETUP_REQUIRED',
      }, 403);
    }
    return json({ error: 'Invalid email or password' }, 401);
  }

  if (migratedSetupPending) {
    await env.DB.prepare(
      `UPDATE customers SET password_setup_required = 0, migration_status = ?, updated_date = ? WHERE id = ?`,
    )
      .bind(MIGRATION_STATUS.CLAIMED, nowIso(), customer.id)
      .run();
    customer = await getCustomer(env, customer.id);
  }

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
  const email = normalizeEmail(body.email);
  const emailKey = email ? await sha256(email) : 'missing';
  const [ipAllowed, emailAllowed] = await Promise.all([
    rateLimit(env, `reset-ip:${clientIp(request)}`, 5, 60 * 60),
    rateLimit(env, `reset-email:${emailKey}`, 3, 60 * 60),
  ]);
  if (ipAllowed && emailAllowed && email) {
    const customer = await findLoginEmail(env, email).first();
    if (
      customer &&
      (customer.email_status === EMAIL_STATUS.VALID ||
        customer.email_status === EMAIL_STATUS.UNVERIFIED ||
        customer.email_status === EMAIL_STATUS.VERIFIED)
    ) {
      await issueResetToken(env, customer, { restorePreviousOnFailure: true });
    }
  }
  return json({ success: true, message: RESET_REQUEST_MESSAGE });
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

  const password_hash = await hashPassword(newPassword);
  const consumed = await env.DB.prepare(
    `UPDATE customer_auth
     SET password_hash = ?, reset_token_hash = '', reset_expires_at = '', must_reset_password = 0
     WHERE id = ? AND reset_token_hash = ? AND reset_expires_at > ?`,
  )
    .bind(password_hash, auth.id, reset_token_hash, nowIso())
    .run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    return json({ error: 'Invalid or expired reset link' }, 400);
  }

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

async function updateMarketingPreference(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  const wantsMarketing = body.marketing_emails_enabled === true;
  const now = nowIso();
  if (wantsMarketing) {
    await env.DB.prepare(
      `UPDATE customers SET marketing_emails_enabled = 1, marketing_subscribed_at = ?,
       marketing_unsubscribed_at = '', marketing_prompt_shown_at = CASE WHEN marketing_prompt_shown_at = '' THEN ? ELSE marketing_prompt_shown_at END
       WHERE id = ?`,
    ).bind(now, now, authz.customer.id).run();
  } else {
    await env.DB.prepare(
      `UPDATE customers SET marketing_emails_enabled = 0, marketing_unsubscribed_at = ? WHERE id = ?`,
    ).bind(now, authz.customer.id).run();
  }
  const customer = await getCustomer(env, authz.customer.id);
  return json({ success: true, customer: publicCustomer(customer) });
}

async function recordMarketingPrompt(env, body) {
  const authz = await requireCustomer(env, body.session_token);
  if (!authz) return json({ error: 'unauthorized' }, 401);
  const action = String(body.action || 'shown');
  const now = nowIso();
  if (action === 'dismissed') {
    await env.DB.prepare(
      `UPDATE customers SET marketing_emails_enabled = 0,
       marketing_prompt_shown_at = CASE WHEN marketing_prompt_shown_at = '' THEN ? ELSE marketing_prompt_shown_at END,
       marketing_prompt_dismissed_at = ?
       WHERE id = ? AND marketing_subscribed_at = '' AND marketing_unsubscribed_at = ''`,
    ).bind(now, now, authz.customer.id).run();
  } else {
    await env.DB.prepare(
      `UPDATE customers SET marketing_prompt_shown_at = ?
       WHERE id = ? AND marketing_prompt_shown_at = '' AND marketing_subscribed_at = ''
         AND marketing_unsubscribed_at = ''`,
    ).bind(now, authz.customer.id).run();
  }
  const customer = await getCustomer(env, authz.customer.id);
  return json({ success: true, customer: publicCustomer(customer) });
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
  const country = String(body.country || '').trim();
  if (!names.first_name || !names.last_name) return json({ error: 'First and last name are required' }, 400);
  if (!country) return json({ error: 'Country is required' }, 400);
  if (!isUsablePhone(mobile)) {
    return json({ error: 'Enter a full phone number (at least 8 digits, e.g. 03XXXXXX or 9613XXXXXX)' }, 400);
  }
  if (body.email != null && !isValidEmail(body.email)) {
    return json({ error: 'Enter a valid email address' }, 400);
  }
  let ambassador_code = authz.customer.ambassador_code || '';
  if (body.ambassador_code != null) {
    const nextCode = String(body.ambassador_code).trim();
    ambassador_code = looksPlaceholderAmbassador(nextCode) ? '' : nextCode;
  }
  let email = authz.customer.email;
  let emailNorm = authz.customer.email_normalized;
  let emailStatus = authz.customer.email_status;
  let emailChanged = false;
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
    emailChanged = true;
  }
  await env.DB.prepare(
    `UPDATE customers SET full_name = ?, first_name = ?, last_name = ?, mobile = ?, mobile_normalized = ?,
      country = ?, ambassador_code = ?, email = ?, email_normalized = ?, email_status = ?, profile_review_required = 0, updated_date = ? WHERE id = ?`,
  )
    .bind(
      names.full_name,
      names.first_name,
      names.last_name,
      mobile,
      normalizePhone(mobile),
      country,
      ambassador_code,
      email,
      emailNorm,
      emailStatus,
      nowIso(),
      authz.customer.id,
    )
    .run();
  const fresh = await getCustomer(env, authz.customer.id);
  if (emailChanged) {
    await issueVerifyToken(env, fresh, body.app_origin);
  }
  return json({ success: true, customer: publicCustomer(fresh), email_changed: emailChanged });
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

  const phoneKeys = phoneVariants(submitted_phone);
  const phoneMatches = (value) => phoneKeys.length > 0 && phoneVariants(value).some((v) => phoneKeys.includes(v));
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
  if (phoneKeys.length) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM customers WHERE account_source = 'migrated'
         AND mobile_normalized IN (${phoneKeys.map(() => '?').join(', ')}) LIMIT 5`,
    )
      .bind(...phoneKeys)
      .all();
    matches.push(...(results || []));
  }
  const unique = [];
  const seen = new Set();
  for (const row of matches) {
    if (!seen.has(row.id) && row.migration_status !== MIGRATION_STATUS.MERGED) {
      seen.add(row.id);
      unique.push(row);
    }
  }
  const strong = unique.filter((row) => {
    const phoneOk = phoneMatches(row.mobile_normalized || row.mobile);
    const idOk = submitted_legacy_id && (row.legacy_user_id === submitted_legacy_id || row.id === submitted_legacy_id);
    const cardOk = submitted_card_number && row.card_number === submitted_card_number;
    return (idOk && (phoneOk || cardOk)) || (cardOk && phoneOk);
  });

  const emailOwner = await findLoginEmail(env, requested_email).first();
  if (emailOwner) {
    const ownsEmail = seen.has(emailOwner.id) || phoneMatches(emailOwner.mobile_normalized || emailOwner.mobile);
    if (!ownsEmail) {
      return json({
        error: 'That email belongs to a different account. If it is yours, sign in with it or use "Forgot password"; otherwise enter another email.',
      }, 409);
    }
    // The email is already on this customer's own account. Never change the
    // email or password here — only send a reset link to that inbox.
    await issueResetToken(env, emailOwner);
    const legacy = strong.length === 1 ? strong[0] : unique.length === 1 ? unique[0] : null;
    if (legacy && legacy.id !== emailOwner.id) {
      // They signed up again with a new account; queue the old one for an
      // admin to merge its points and card into the account they use now.
      await env.DB.prepare(
        `INSERT INTO recovery_requests (
          id, customer_id, requested_email, submitted_name, submitted_phone, submitted_legacy_id, submitted_card_number,
          match_notes, status, created_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          randomId(),
          legacy.id,
          requested_email,
          submitted_name,
          submitted_phone,
          submitted_legacy_id,
          submitted_card_number,
          `merge_into=${emailOwner.id}`,
          RECOVERY_STATUS.PENDING,
          nowIso(),
        )
        .run();
      return json({
        success: true,
        auto_approved: true,
        message: 'This email already has a WinWin account. Sign in with it (we emailed you a password link in case you need it). Our team will move the points and card from your old account onto it.',
      });
    }
    const hasPassword = !emailOwner.password_setup_required;
    return json({
      success: true,
      auto_approved: true,
      message: hasPassword
        ? 'This email is already on your WinWin account. Sign in with your password. We also emailed a reset link in case you forgot it.'
        : 'We found your account with this email. Check your inbox for a link to set your password. Your points and card are kept.',
    });
  }

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
    await applyApprovedRecovery(env, customer, requested_email);
    await env.DB.prepare('UPDATE recovery_requests SET status = ? WHERE id = ?')
      .bind(RECOVERY_STATUS.APPROVED, requestId)
      .run();
    return json({
      success: true,
      auto_approved: true,
      message: 'We found your account. Check your email for a reset link.',
    });
  }

  return json({
    success: true,
    auto_approved: false,
    message: 'Your recovery request was submitted. An admin will review it.',
  });
}

function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function sameFirstName(row, firstName) {
  const want = String(firstName || '').trim().toLowerCase();
  const have = String(row.first_name || row.full_name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  return Boolean(want) && want === have;
}

// Finds the old-platform account a customer is activating on the new site,
// using the email they sign in with plus the phone on file. No email is sent.
async function findClaimableAccount(env, body) {
  const email = normalizeEmail(body.email);
  const mobile = String(body.mobile || body.phone || '').trim();
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  if (!email || !isValidEmail(email)) return { error: 'Enter a valid email address' };
  if (!firstName || !lastName) return { error: 'Enter your first and last name' };
  if (!isUsablePhone(mobile)) return { error: 'Enter your full phone number' };
  const phoneKeys = phoneVariants(mobile);
  const phoneMatches = (value) => phoneVariants(value).some((v) => phoneKeys.includes(v));
  const noPassword = 'This account already has a password on the new site. Go back and sign in, or use "Forgot password".';

  const owner = await findLoginEmail(env, email).first();
  if (owner) {
    if (!owner.password_setup_required) return { error: noPassword, code: 'HAS_PASSWORD' };
    if (!phoneMatches(owner.mobile_normalized || owner.mobile)) {
      return { error: 'This phone number does not match the one on your account. Enter the number you used on the old WinWin site.' };
    }
    return { customer: owner, email };
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM customers WHERE account_source = 'migrated' AND migration_status != ?
       AND mobile_normalized IN (${phoneKeys.map(() => '?').join(', ')}) LIMIT 10`,
  )
    .bind(MIGRATION_STATUS.MERGED, ...phoneKeys)
    .all();
  let candidates = results || [];
  if (!candidates.length) {
    return { error: 'We could not find an old WinWin account with this email or phone number. Check them, or create a new account.' };
  }
  if (candidates.length > 1) {
    const byName = candidates.filter((row) => sameFirstName(row, firstName));
    if (byName.length === 1) candidates = byName;
  }
  if (candidates.length > 1) {
    return { error: 'More than one account uses this phone number. Please contact us on WhatsApp so we can activate the right one.' };
  }
  const match = candidates[0];
  if (!match.password_setup_required) return { error: noPassword, code: 'HAS_PASSWORD' };
  if (match.email_status === EMAIL_STATUS.VALID && match.email_normalized && match.email_normalized !== email) {
    return { error: `This phone number is linked to ${maskEmail(match.email_normalized)}. Sign in with that email instead.` };
  }
  return { customer: match, email };
}

async function checkAccountClaim(env, body, request) {
  const allowed = await rateLimit(env, `claim-check:${clientIp(request)}`, 15, 60 * 60);
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const found = await findClaimableAccount(env, body);
  if (found.error) return json({ error: found.error, code: found.code || '' }, 400);
  return json({ success: true });
}

async function claimAccount(env, body, request) {
  const allowed = await rateLimit(env, `claim:${clientIp(request)}`, 10, 60 * 60);
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);
  const password = String(body.password || body.new_password || '');
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
  const found = await findClaimableAccount(env, body);
  if (found.error) return json({ error: found.error, code: found.code || '' }, 400);
  const { customer, email } = found;
  const names = splitName('', body.first_name, body.last_name);
  const mobile = String(body.mobile || body.phone || '').trim();
  const country = String(body.country || customer.country || '').trim();
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE customers SET full_name = ?, first_name = ?, last_name = ?, mobile = ?, mobile_normalized = ?, country = ?,
      email = ?, email_normalized = ?, email_status = ?, password_setup_required = 0, profile_review_required = 0,
      migration_status = ?, updated_date = ? WHERE id = ?`,
  )
    .bind(
      names.full_name,
      names.first_name,
      names.last_name,
      mobile,
      normalizePhone(mobile),
      country,
      email,
      email,
      customer.email_normalized === email && customer.email_status === EMAIL_STATUS.VERIFIED
        ? EMAIL_STATUS.VERIFIED
        : EMAIL_STATUS.UNVERIFIED,
      MIGRATION_STATUS.CLAIMED,
      now,
      customer.id,
    )
    .run();
  const password_hash = await hashPassword(password);
  const auth = await getAuth(env, customer.id);
  if (auth) {
    await env.DB.prepare(
      `UPDATE customer_auth SET password_hash = ?, reset_token_hash = '', reset_expires_at = '', must_reset_password = 0
       WHERE customer_id = ?`,
    )
      .bind(password_hash, customer.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO customer_auth (id, customer_id, password_hash, reset_token_hash, reset_expires_at, must_reset_password, created_date)
       VALUES (?, ?, ?, '', '', 0, ?)`,
    )
      .bind(randomId(), customer.id, password_hash, now)
      .run();
  }
  await env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').bind(customer.id).run();
  const session_token = await createSession(env, customer.id);
  const fresh = await getCustomer(env, customer.id);
  return json({ success: true, session_token, customer: publicCustomer(fresh) });
}

async function applyApprovedRecovery(env, customer, requestedEmail) {
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
  await issueResetToken(env, { ...fresh, email: requestedEmail });
}

async function mergeLegacyAccount(env, legacy, target, admin) {
  const points = Math.max(0, Number(legacy.points) || 0);
  if (points > 0) {
    await creditPoints(env, {
      customer: target,
      amount: points,
      type: LEDGER_TYPE.MIGRATION_BALANCE,
      reason: `Merged from old account ${legacy.legacy_user_id || legacy.id}`,
      source: 'ACCOUNT_MERGE',
      idempotency_key: `ACCOUNT_MERGE:${legacy.id}`,
      created_by_admin_id: admin.id,
    });
    await creditPoints(env, {
      customer: legacy,
      amount: -points,
      type: LEDGER_TYPE.MIGRATION_BALANCE,
      reason: `Moved to account ${target.id}`,
      source: 'ACCOUNT_MERGE',
      idempotency_key: `ACCOUNT_MERGE_OUT:${legacy.id}`,
      created_by_admin_id: admin.id,
    });
  }
  const fresh = await getCustomer(env, target.id);
  const takeCard = legacy.card_number && (
    !fresh.card_number ||
    String(legacy.card_expiry_date || '') > String(fresh.card_expiry_date || '')
  );
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE customers SET
        legacy_user_id = CASE WHEN legacy_user_id = '' OR legacy_user_id IS NULL THEN ? ELSE legacy_user_id END,
        has_winwin_card = ?, card_number = ?, card_purchase_date = ?, card_expiry_date = ?,
        draw_entries = draw_entries + ?, wallet_balance = wallet_balance + ?,
        country = CASE WHEN country = '' OR country IS NULL THEN ? ELSE country END,
        updated_date = ?
       WHERE id = ?`,
    ).bind(
      legacy.legacy_user_id || '',
      takeCard ? (legacy.has_winwin_card ? 1 : 0) : (fresh.has_winwin_card ? 1 : 0),
      takeCard ? legacy.card_number : fresh.card_number || '',
      takeCard ? legacy.card_purchase_date || '' : fresh.card_purchase_date || '',
      takeCard ? legacy.card_expiry_date || '' : fresh.card_expiry_date || '',
      Math.max(0, Number(legacy.draw_entries) || 0),
      Math.max(0, Number(legacy.wallet_balance) || 0),
      legacy.country || '',
      nowIso(),
      target.id,
    ),
    env.DB.prepare(
      `UPDATE customers SET migration_status = ?, draw_entries = 0, wallet_balance = 0, has_winwin_card = 0, card_number = '',
        password_setup_required = 0, updated_date = ? WHERE id = ?`,
    ).bind(MIGRATION_STATUS.MERGED, nowIso(), legacy.id),
    env.DB.prepare('UPDATE loyalty_memberships SET customer_id = ? WHERE customer_id = ?').bind(target.id, legacy.id),
    env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').bind(legacy.id),
  ]);
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
  const mergeTarget = await findLoginEmail(env, row.requested_email).first();
  if (mergeTarget && mergeTarget.id !== customer.id) {
    // The customer already uses this email on another account (usually one
    // they signed up with again). Move the old balance and card onto it and
    // leave that account's password untouched.
    if (customer.migration_status === MIGRATION_STATUS.MERGED) {
      return json({ error: 'This old account was already merged' }, 409);
    }
    await mergeLegacyAccount(env, customer, mergeTarget, admin);
    await env.DB.prepare(
      'UPDATE recovery_requests SET status = ?, customer_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
    )
      .bind(RECOVERY_STATUS.COMPLETED, customerId, admin.id, nowIso(), id)
      .run();
    return json({ success: true, merged_into: mergeTarget.id });
  }
  if (customer.migration_status === MIGRATION_STATUS.CLAIMED && !customer.password_setup_required) {
    return json({ error: 'This account is already active' }, 409);
  }
  try {
    await applyApprovedRecovery(env, customer, row.requested_email);
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
  // Self-heal before reading: don't make admins wait for the next cron tick
  // to see an expired card's has_winwin_card flag flip off.
  await expireStaleMemberships(env);
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
  const is_ambassador = body.is_ambassador != null ? (body.is_ambassador ? 1 : 0) : (customer.is_ambassador ? 1 : 0);
  const draw_entries = body.draw_entries != null
    ? Math.max(0, Math.round(Number(body.draw_entries) || 0))
    : Number(customer.draw_entries) || 0;
  const wallet_balance = body.wallet_balance != null
    ? Math.max(0, Number(body.wallet_balance) || 0)
    : Number(customer.wallet_balance) || 0;
  await env.DB.prepare(
    `UPDATE customers SET full_name = ?, first_name = ?, last_name = ?, mobile = ?, mobile_normalized = ?,
      country = ?, ambassador_code = ?, card_number = ?, is_ambassador = ?, draw_entries = ?, wallet_balance = ?,
      updated_date = ? WHERE id = ?`,
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
      is_ambassador,
      draw_entries,
      wallet_balance,
      nowIso(),
      customer.id,
    )
    .run();
  const fresh = await getCustomer(env, customer.id);
  return json({ success: true, customer: publicCustomer(fresh) });
}

// Hard delete: removes the account and everything scoped to it (auth,
// sessions, points ledger, loyalty memberships, saved addresses, recovery
// requests). Irreversible. Store orders/transactions are left untouched —
// they're business records, not account data, and already carry a copy of
// the customer's name/email/phone so they stay readable after this.
async function deleteCustomer(env, body) {
  const customerId = String(body.customer_id || body.id || '');
  if (!customerId) return json({ error: 'Missing customer_id' }, 400);
  const customer = await getCustomer(env, customerId);
  if (!customer) return json({ error: 'Customer not found' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM customer_auth WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM points_ledger WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM loyalty_memberships WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM customer_addresses WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM recovery_requests WHERE customer_id = ?').bind(customerId),
    env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(customerId),
  ]);
  return json({ success: true });
}

async function importLegacyCustomers(env, body) {
  const records = (Array.isArray(body.customers) ? body.customers : [])
    .map(stripLegacySecrets)
    .filter((row) => String(row.is_sample || '').toUpperCase() !== 'TRUE');
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
      const created = mapped.created_date || nowIso();
      await env.DB.prepare(
        `INSERT INTO customers (
          id, legacy_user_id, full_name, first_name, last_name, email, email_normalized, mobile, mobile_normalized,
          country, points, has_winwin_card, card_number, card_purchase_date, card_expiry_date, draw_entries,
          last_signin_date, ambassador_code, is_ambassador, signup_bonus_granted, wallet_balance, account_source,
          migration_status, password_setup_required, profile_review_required, email_status, created_date, updated_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1, ?, 'migrated', ?, 1, 1, ?, ?, ?)`,
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
          mapped.draw_entries || 0,
          mapped.ambassador_code,
          mapped.is_ambassador ? 1 : 0,
          mapped.wallet_balance || 0,
          mapped.migration_status,
          mapped.email_status,
          created,
          nowIso(),
        )
        .run();
      await env.DB.prepare(
        `INSERT INTO customer_auth (id, customer_id, password_hash, reset_token_hash, reset_expires_at, must_reset_password, created_date)
         VALUES (?, ?, '', '', '', 1, ?)`,
      )
        .bind(randomId(), id, created)
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
  const issued = await issueResetToken(env, customer);
  return json({ success: true, setup_url: issued.link || '' });
}

function classifyMembership(latest, now = new Date()) {
  if (!latest) return { status: 'NONE', days_remaining: 0, active: false };
  if (String(latest.status || '').toUpperCase() === 'DEACTIVATED') {
    return { status: 'EXPIRED', days_remaining: 0, active: false };
  }
  const days_remaining = calendarDaysUntil(latest.expires_at, now);
  if (days_remaining == null) return { status: 'NONE', days_remaining: 0, active: false };
  if (days_remaining < 0) return { status: 'EXPIRED', days_remaining: 0, active: false };
  if (days_remaining <= EXPIRING_SOON_DAYS) {
    return { status: 'EXPIRING_SOON', days_remaining, active: true };
  }
  return { status: 'ACTIVE', days_remaining, active: true };
}

async function listMemberships(env, body) {
  await expireStaleMemberships(env);
  const now = new Date();
  const { results: customers } = await env.DB.prepare(
    'SELECT * FROM customers ORDER BY created_date DESC LIMIT 5000',
  ).all();
  const { results: memberships } = await env.DB.prepare('SELECT * FROM loyalty_memberships').all();
  const byCustomer = {};
  for (const membership of memberships || []) {
    if (!byCustomer[membership.customer_id]) byCustomer[membership.customer_id] = [];
    byCustomer[membership.customer_id].push(membership);
  }
  const rows = (customers || []).map((customer) => {
    const list = byCustomer[customer.id] || [];
    list.sort((a, b) => String(b.activated_at || '').localeCompare(String(a.activated_at || '')));
    let latest = list[0] || null;
    if (!latest && (customer.has_winwin_card || customer.card_expiry_date)) {
      latest = {
        id: '',
        customer_id: customer.id,
        status: customer.has_winwin_card ? 'ACTIVE' : 'EXPIRED',
        activated_at: customer.card_purchase_date || '',
        expires_at: customer.card_expiry_date || '',
        source: 'CUSTOMER',
      };
    }
    const classified = classifyMembership(latest, now);
    return {
      customer: publicCustomer(customer),
      membership: latest,
      status: classified.status,
      days_remaining: classified.active ? classified.days_remaining : 0,
      activated_at: latest?.activated_at || customer.card_purchase_date || null,
      expires_at: latest?.expires_at || customer.card_expiry_date || null,
    };
  });
  const filter = String(body.filter || 'all').toUpperCase();
  const filterStatus = filter === 'NO_MEMBERSHIP' ? 'NONE' : filter;
  const filtered = !filter || filter === 'ALL' ? rows : rows.filter((row) => row.status === filterStatus);
  return json({ success: true, server_today: todayStr(now), rows: filtered });
}

async function deactivateActiveMemberships(env, customerId) {
  await env.DB.prepare(
    `UPDATE loyalty_memberships SET status = 'DEACTIVATED' WHERE customer_id = ? AND status = 'ACTIVE'`,
  )
    .bind(customerId)
    .run();
}

async function activateMembership(env, body, admin) {
  const customer = await getCustomer(env, String(body.customer_id || ''));
  if (!customer) return json({ error: 'Customer not found' }, 404);
  const relatedTransactionId = String(body.related_transaction_id || '');
  if (relatedTransactionId) {
    const existing = await env.DB.prepare('SELECT * FROM loyalty_memberships WHERE related_transaction_id = ?')
      .bind(relatedTransactionId)
      .first();
    if (existing) {
      const purchaseDate = dateOnly(existing.activated_at) || existing.activated_at;
      const expiryDate = dateOnly(existing.expires_at) || existing.expires_at;
      await env.DB.prepare(
        `UPDATE customers SET has_winwin_card = 1, card_purchase_date = ?, card_expiry_date = ?,
         card_renewal_reminder_sent = 0, updated_date = ? WHERE id = ?`,
      )
        .bind(purchaseDate, expiryDate, nowIso(), customer.id)
        .run();
      const currentCustomer = await getCustomer(env, customer.id);
      const credited = await creditPoints(env, {
        customer: currentCustomer,
        amount: LOYALTY_BONUS_POINTS,
        type: LEDGER_TYPE.LOYALTY_CARD_BONUS,
        reason: 'WinWin loyalty card activation bonus',
        source: String(body.source || 'ORDER_APPROVAL'),
        idempotency_key: `LOYALTY_CARD_BONUS:${existing.id}`,
        related_transaction_id: relatedTransactionId,
        created_by_admin_id: admin?.id || '',
      });
      return json({
        success: true,
        already_activated: true,
        membership: existing,
        customer: publicCustomer(credited.customer),
      });
    }
  }
  const now = new Date();
  const expiryDay = membershipExpiryDay(now);
  const expiresAt = membershipExpiryIso(now);
  const membershipId = randomId();
  const source = String(body.source || 'MANUAL');
  await deactivateActiveMemberships(env, customer.id);
  await env.DB.prepare(
    `INSERT INTO loyalty_memberships (id, customer_id, status, activated_at, expires_at, source, approved_by, related_transaction_id)
     VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`,
  )
    .bind(membershipId, customer.id, now.toISOString(), expiresAt, source, admin?.id || '', relatedTransactionId)
    .run();
  await env.DB.prepare(
    `UPDATE customers SET has_winwin_card = 1, card_purchase_date = ?, card_expiry_date = ?,
     card_renewal_reminder_sent = 0, updated_date = ? WHERE id = ?`,
  )
    .bind(todayStr(now), expiryDay, nowIso(), customer.id)
    .run();
  const updated = await getCustomer(env, customer.id);
  let resultCustomer = updated;
  if (body.award_bonus !== false) {
    const credited = await creditPoints(env, {
      customer: updated,
      amount: LOYALTY_BONUS_POINTS,
      type: LEDGER_TYPE.LOYALTY_CARD_BONUS,
      reason: 'WinWin loyalty card activation bonus',
      source,
      idempotency_key: `LOYALTY_CARD_BONUS:${membershipId}`,
      related_transaction_id: relatedTransactionId || membershipId,
      created_by_admin_id: admin?.id || '',
    });
    resultCustomer = credited.customer;
  }
  const membership = await env.DB.prepare('SELECT * FROM loyalty_memberships WHERE id = ?').bind(membershipId).first();
  return json({ success: true, membership, customer: publicCustomer(resultCustomer) });
}

export async function activateMembershipForTransaction(env, transaction, admin) {
  return activateMembership(
    env,
    {
      customer_id: transaction.customer_id,
      related_transaction_id: transaction.id,
      source: 'ORDER_APPROVAL',
      award_bonus: true,
    },
    admin,
  );
}

async function deactivateMembership(env, body) {
  const customer = await getCustomer(env, String(body.customer_id || ''));
  if (!customer) return json({ error: 'Customer not found' }, 404);
  await deactivateActiveMemberships(env, customer.id);
  if (body.membership_id) {
    await env.DB.prepare('UPDATE loyalty_memberships SET status = ? WHERE id = ?')
      .bind('DEACTIVATED', String(body.membership_id))
      .run();
  }
  await env.DB.prepare('UPDATE customers SET has_winwin_card = 0, updated_date = ? WHERE id = ?')
    .bind(nowIso(), customer.id)
    .run();
  const updated = await getCustomer(env, customer.id);
  return json({ success: true, customer: publicCustomer(updated) });
}

async function updateMembershipExpiry(env, body) {
  const expiresAt = String(body.expires_at || '').trim();
  const activatedAt = String(body.activated_at || '').trim();
  if (!expiresAt) return json({ error: 'Missing expiry date' }, 400);
  let membership = body.membership_id
    ? await env.DB.prepare('SELECT * FROM loyalty_memberships WHERE id = ?').bind(String(body.membership_id)).first()
    : null;
  if (!membership && body.customer_id) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM loyalty_memberships WHERE customer_id = ? ORDER BY activated_at DESC',
    )
      .bind(String(body.customer_id))
      .all();
    membership = (results || []).find((row) => row.status === 'ACTIVE') || results?.[0] || null;
  }
  const expiryIso = expiresAt.length <= 10 ? `${expiresAt}T23:59:59.000Z` : expiresAt;
  const activatedIso = activatedAt
    ? (activatedAt.length <= 10 ? `${activatedAt}T00:00:00.000Z` : activatedAt)
    : membership?.activated_at || nowIso();
  const expired = new Date(expiryIso).getTime() <= Date.now();
  const status = expired ? 'EXPIRED' : 'ACTIVE';
  if (!membership) {
    const customerId = String(body.customer_id || '');
    if (!customerId) return json({ error: 'Membership not found' }, 404);
    const id = randomId();
    await env.DB.prepare(
      `INSERT INTO loyalty_memberships (id, customer_id, status, activated_at, expires_at, source, approved_by, related_transaction_id)
       VALUES (?, ?, ?, ?, ?, 'MANUAL', '', '')`,
    )
      .bind(id, customerId, status, activatedIso, expiryIso)
      .run();
    membership = await env.DB.prepare('SELECT * FROM loyalty_memberships WHERE id = ?').bind(id).first();
  } else {
    await env.DB.prepare('UPDATE loyalty_memberships SET expires_at = ?, activated_at = ?, status = ? WHERE id = ?')
      .bind(expiryIso, activatedIso, status, membership.id)
      .run();
    membership = await env.DB.prepare('SELECT * FROM loyalty_memberships WHERE id = ?').bind(membership.id).first();
  }
  await env.DB.prepare(
    `UPDATE customers SET has_winwin_card = ?, card_purchase_date = ?, card_expiry_date = ?,
     card_renewal_reminder_sent = 0, updated_date = ? WHERE id = ?`,
  )
    .bind(expired ? 0 : 1, dateOnly(activatedIso), dateOnly(expiryIso), nowIso(), membership.customer_id)
    .run();
  const customer = await getCustomer(env, membership.customer_id);
  return json({ success: true, membership, customer: publicCustomer(customer) });
}

// Daily cron safety net: flips the WinWin Card flag off for anyone whose
// expiry date has already passed, even if nobody ever called deactivateMembership
// (e.g. imported legacy rows, or admins editing dates without going through
// the membership endpoints). Without this the "has_winwin_card" switch can
// stay ON indefinitely after a card expires.
export async function expireStaleMemberships(env) {
  const today = todayStr();
  await env.DB.prepare(
    `UPDATE loyalty_memberships SET status = 'EXPIRED'
     WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at != '' AND substr(expires_at, 1, 10) < ?`,
  )
    .bind(today)
    .run();
  const result = await env.DB.prepare(
    `UPDATE customers SET has_winwin_card = 0, updated_date = ?
     WHERE has_winwin_card = 1 AND card_expiry_date IS NOT NULL AND card_expiry_date != '' AND substr(card_expiry_date, 1, 10) < ?`,
  )
    .bind(nowIso(), today)
    .run();
  return { expired: result?.meta?.changes || 0 };
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
  if (name === 'updateMarketingPreference') return updateMarketingPreference(env, body);
  if (name === 'recordMarketingPrompt') return recordMarketingPrompt(env, body);
  if (name === 'dailySignIn') return dailySignIn(env, body);
  if (name === 'reviewProfile') return reviewProfile(env, body);
  if (name === 'listAddresses') return listAddresses(env, body);
  if (name === 'saveAddress') return saveAddress(env, body);
  if (name === 'submitAccountRecovery') return submitRecovery(env, body, request);
  if (name === 'checkAccountClaim') return checkAccountClaim(env, body, request);
  if (name === 'claimAccount') return claimAccount(env, body, request);
  if (name === 'verifyEmail') return verifyEmail(env, body);
  if (name === 'listCustomers') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return listCustomers(env);
  }
  if (name === 'adminUpdateCustomer') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return adminUpdateCustomer(env, body);
  }
  if (name === 'deleteCustomer') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return deleteCustomer(env, body);
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
  if (name === 'listMemberships') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return listMemberships(env, body);
  }
  if (name === 'activateMembership') {
    const admin = await requireAdmin(env, body, request);
    if (!admin) return json({ error: 'unauthorized' }, 401);
    return activateMembership(env, body, admin);
  }
  if (name === 'deactivateMembership') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return deactivateMembership(env, body);
  }
  if (name === 'updateMembershipExpiry') {
    if (!(await requireAdmin(env, body, request))) return json({ error: 'unauthorized' }, 401);
    return updateMembershipExpiry(env, body);
  }
  return null;
}

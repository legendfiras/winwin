import { Resend } from 'resend';

const HARD_DAILY_LIMIT = 90;
const DEFAULT_INACTIVITY_DAYS = 3;
const EMAIL_TIMEOUT_MS = 8000;
const VALID_EMAIL_STATUSES = "('valid','unverified','verified')";

function nowIso() {
  return new Date().toISOString();
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function makeUnsubscribeToken(env, customerId, test = false) {
  const secret = String(env.MARKETING_UNSUBSCRIBE_SECRET || '').trim();
  if (!secret) throw new Error('MARKETING_UNSUBSCRIBE_SECRET_MISSING');
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ v: 1, customerId, test })));
  return `${payload}.${base64UrlEncode(await hmac(secret, payload))}`;
}

async function readUnsubscribeToken(env, token) {
  try {
    const secret = String(env.MARKETING_UNSUBSCRIBE_SECRET || '').trim();
    const [payload, signature, extra] = String(token || '').split('.');
    if (!secret || !payload || !signature || extra) return null;
    const expected = await hmac(secret, payload);
    const received = base64UrlDecode(signature);
    if (expected.length !== received.length) return null;
    let different = 0;
    for (let i = 0; i < expected.length; i += 1) different |= expected[i] ^ received[i];
    if (different !== 0) return null;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (parsed?.v !== 1 || (!parsed.customerId && !parsed.test)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function marketingCopy(customer, unsubscribeUrl) {
  const firstName = escapeHtml(customer.first_name || customer.full_name?.split(' ')[0] || 'there');
  const accountUrl = 'https://winwinleb.com/my-account';
  const useNewItemsCopy = Number(dateKey().replace(/-/g, '')) % 2 === 0;
  const subject = useNewItemsCopy ? 'Something new is waiting on WinWin' : 'Your WinWin points are waiting';
  const message = useNewItemsCopy
    ? 'New items have recently been added. Log in to see what is available and check your points.'
    : "You haven't visited WinWin in a few days. Log in to check your points and see what's new.";
  const cta = useNewItemsCopy ? "See what's new" : 'Open WinWin';
  return {
    subject,
    text: `Hi ${customer.first_name || 'there'},\n\n${message}\n\n${cta}: ${accountUrl}\n\nYou are receiving this because you asked for WinWin email updates. Unsubscribe: ${unsubscribeUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:#fff7f2;font-family:Arial,sans-serif;color:#351713"><div style="display:none;max-height:0;overflow:hidden">Your WinWin points and account updates are waiting.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f2;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #f0ded5"><tr><td align="center" style="background:#8f1d2c;padding:24px"><img src="https://winwinleb.com/logo_winwin.png" alt="WinWin" width="140" style="display:block;max-width:140px;height:auto"></td></tr><tr><td style="padding:34px"><h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#8f1d2c">Hi ${firstName},</h1><p style="margin:0;font-size:16px;line-height:1.65;color:#5d4a45">${escapeHtml(message)}</p><p style="margin:28px 0 8px;text-align:center"><a href="${accountUrl}" style="display:inline-block;background:#8f1d2c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px">${escapeHtml(cta)}</a></p></td></tr><tr><td style="padding:18px 34px;background:#fbf4f0;text-align:center;font-size:12px;line-height:1.6;color:#806d67">You asked to receive WinWin email updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8f1d2c">Unsubscribe</a>.<br>Password reset and required account emails are not affected.</td></tr></table></td></tr></table></body></html>`,
  };
}

function withTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('EMAIL_TIMEOUT')), EMAIL_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function safeFailure(error) {
  if (error?.message === 'EMAIL_TIMEOUT') return 'timeout';
  const code = String(error?.name || error?.code || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return code ? `provider_error:${code}` : 'provider_error';
}

async function sendMarketingEmail(env, { to, customer, unsubscribeUrl }) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.MARKETING_FROM_EMAIL || '').trim();
  if (!apiKey || !from) return { sent: false, reason: 'configuration_missing' };
  try {
    const result = await withTimeout(new Resend(apiKey).emails.send({
      from,
      to: [to],
      ...marketingCopy(customer, unsubscribeUrl),
    }));
    if (result?.error) return { sent: false, reason: safeFailure(result.error) };
    return { sent: true, id: String(result?.data?.id || '') };
  } catch (error) {
    return { sent: false, reason: safeFailure(error) };
  }
}

export async function ensureMarketingSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id TEXT PRIMARY KEY,
      campaign_date TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'created',
      eligible_count INTEGER NOT NULL DEFAULT 0,
      selected_count INTEGER NOT NULL DEFAULT 0,
      attempted_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_send_log (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      campaign_date TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'selected',
      attempted_at TEXT,
      sent_at TEXT,
      failure_reason TEXT,
      provider_message_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(campaign_id, customer_id)
    )`),
  ]);
  const alters = [
    "ALTER TABLE customers ADD COLUMN last_login_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'",
    'ALTER TABLE customers ADD COLUMN marketing_emails_enabled INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE customers ADD COLUMN marketing_prompt_shown_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_prompt_dismissed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_subscribed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN marketing_unsubscribed_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN last_marketing_email_sent_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN last_marketing_email_attempted_at TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of alters) {
    try { await env.DB.prepare(sql).run(); } catch { /* already added */ }
  }
  const initializedAt = nowIso();
  await env.DB.prepare("UPDATE customers SET last_login_at = ? WHERE last_login_at IS NULL OR last_login_at = ''")
    .bind(initializedAt)
    .run();
  await env.DB.prepare(
    "UPDATE customers SET marketing_subscribed_at = ? WHERE marketing_emails_enabled = 1 AND marketing_subscribed_at = ''",
  ).bind(initializedAt).run();
  await env.DB.batch([
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_marketing_eligible ON customers (marketing_emails_enabled, account_status, last_login_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_marketing_rotation ON customers (last_marketing_email_sent_at, id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_marketing_log_campaign ON marketing_send_log (campaign_id, status)'),
  ]);
}

function config(env) {
  return {
    enabled: enabled(env.MARKETING_EMAILS_ENABLED),
    dryRun: enabled(env.MARKETING_DRY_RUN),
    limit: clampInt(env.MARKETING_DAILY_SEND_LIMIT, HARD_DAILY_LIMIT, HARD_DAILY_LIMIT),
    inactivityDays: clampInt(env.MARKETING_INACTIVITY_DAYS, DEFAULT_INACTIVITY_DAYS, 365),
    testRecipient: String(env.MARKETING_TEST_RECIPIENT || '').trim().toLowerCase(),
  };
}

function cutoffIso(days, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

async function eligibleCount(env, cutoff) {
  return env.DB.prepare(
    `SELECT COUNT(*) AS n FROM customers
     WHERE account_status = 'active'
       AND marketing_emails_enabled = 1
       AND (marketing_unsubscribed_at IS NULL OR marketing_unsubscribed_at = '')
       AND email_normalized != ''
       AND email_status IN ${VALID_EMAIL_STATUSES}
       AND last_login_at != '' AND last_login_at <= ?`,
  ).bind(cutoff).first();
}

async function selectRecipients(env, cutoff, limit) {
  const { results } = await env.DB.prepare(
    `SELECT id, first_name, full_name, email, email_normalized, last_login_at,
            last_marketing_email_sent_at, last_marketing_email_attempted_at
     FROM customers
     WHERE account_status = 'active'
       AND marketing_emails_enabled = 1
       AND (marketing_unsubscribed_at IS NULL OR marketing_unsubscribed_at = '')
       AND email_normalized != ''
       AND email_status IN ${VALID_EMAIL_STATUSES}
       AND last_login_at != '' AND last_login_at <= ?
     ORDER BY
       CASE WHEN last_marketing_email_sent_at IS NULL OR last_marketing_email_sent_at = '' THEN 0 ELSE 1 END ASC,
       CASE WHEN last_marketing_email_sent_at IS NULL OR last_marketing_email_sent_at = ''
         THEN datetime(NULLIF(last_marketing_email_attempted_at, ''))
         ELSE datetime(last_marketing_email_sent_at)
       END ASC,
       id ASC
     LIMIT ?`,
  ).bind(cutoff, limit).all();
  return results || [];
}

async function runTestRecipient(env, cfg, cutoff) {
  const selected = await selectRecipients(env, cutoff, 1);
  const customer = selected[0] || { id: 'test', first_name: 'WinWin friend', full_name: 'WinWin friend' };
  const token = await makeUnsubscribeToken(env, 'test', true);
  const origin = String(env.APP_ORIGIN || 'https://winwinleb.com').replace(/\/$/, '');
  const delivery = await sendMarketingEmail(env, {
    to: cfg.testRecipient,
    customer,
    unsubscribeUrl: `${origin}/unsubscribe?token=${encodeURIComponent(token)}`,
  });
  console.log('[WinWin marketing] test send completed', { sent: delivery.sent, reason: delivery.reason || null });
  return { mode: 'test_recipient', recipient: cfg.testRecipient, sent: delivery.sent, failure_reason: delivery.reason || null };
}

export async function runMarketingCampaign(env) {
  await ensureMarketingSchema(env);
  const cfg = config(env);
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
  const now = new Date();
  const day = dateKey(now);
  const cutoff = cutoffIso(cfg.inactivityDays, now);
  const count = Number((await eligibleCount(env, cutoff))?.n || 0);

  if (cfg.testRecipient) return runTestRecipient(env, cfg, cutoff);
  const preview = await selectRecipients(env, cutoff, cfg.limit);
  if (cfg.dryRun) {
    const selected = preview.map((row) => ({ customer_id: row.id, email: row.email_normalized }));
    console.log('[WinWin marketing] dry run', { campaign_date: day, eligible: count, selected });
    return { mode: 'dry_run', campaign_date: day, eligible_count: count, selected_count: selected.length, selected };
  }
  if (!env.RESEND_API_KEY || !env.MARKETING_FROM_EMAIL || !env.MARKETING_UNSUBSCRIBE_SECRET) {
    return { skipped: true, reason: 'configuration_missing' };
  }

  const campaignId = `daily-${day}`;
  const createdAt = nowIso();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO marketing_campaigns
      (id, campaign_date, status, eligible_count, selected_count, attempted_count, sent_count, failed_count, created_at)
     VALUES (?, ?, 'created', ?, 0, 0, 0, 0, ?)`,
  ).bind(campaignId, day, count, createdAt).run();

  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM marketing_send_log WHERE campaign_id = ?')
    .bind(campaignId).first();
  if (Number(existing?.n || 0) === 0) {
    for (const customer of preview) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO marketing_send_log
          (id, campaign_id, campaign_date, customer_id, recipient_email, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'selected', ?)`,
      ).bind(randomId(), campaignId, day, customer.id, customer.email_normalized, createdAt).run();
    }
    await env.DB.prepare(
      `UPDATE marketing_campaigns SET status = 'running', eligible_count = ?, selected_count = ?, started_at = ? WHERE id = ?`,
    ).bind(count, preview.length, createdAt, campaignId).run();
  }

  const attemptedBefore = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM marketing_send_log
     WHERE campaign_id = ? AND status IN ('attempting','sent','failed')`,
  ).bind(campaignId).first();
  const remainingAttemptCapacity = Math.max(0, cfg.limit - Number(attemptedBefore?.n || 0));
  const { results: pending } = await env.DB.prepare(
    `SELECT l.id AS log_id, l.customer_id, l.recipient_email, c.first_name, c.full_name
     FROM marketing_send_log l JOIN customers c ON c.id = l.customer_id
     WHERE l.campaign_id = ? AND l.status = 'selected'
     ORDER BY l.created_at ASC, l.customer_id ASC LIMIT ?`,
  ).bind(campaignId, remainingAttemptCapacity).all();

  for (const recipient of pending || []) {
    const current = await env.DB.prepare(
      `SELECT id, first_name, full_name, email_normalized
       FROM customers
       WHERE id = ?
         AND account_status = 'active'
         AND marketing_emails_enabled = 1
         AND (marketing_unsubscribed_at IS NULL OR marketing_unsubscribed_at = '')
         AND email_normalized != ''
         AND email_status IN ${VALID_EMAIL_STATUSES}
         AND last_login_at != '' AND last_login_at <= ?`,
    ).bind(recipient.customer_id, cutoff).first();
    if (!current) {
      await env.DB.prepare(
        `UPDATE marketing_send_log SET status = 'skipped', failure_reason = 'no_longer_eligible'
         WHERE id = ? AND status = 'selected'`,
      ).bind(recipient.log_id).run();
      continue;
    }
    const attemptedAt = nowIso();
    const claimed = await env.DB.prepare(
      `UPDATE marketing_send_log SET status = 'attempting', attempted_at = ? WHERE id = ? AND status = 'selected'`,
    ).bind(attemptedAt, recipient.log_id).run();
    if (Number(claimed.meta?.changes || 0) !== 1) continue;
    await env.DB.prepare('UPDATE customers SET last_marketing_email_attempted_at = ? WHERE id = ?')
      .bind(attemptedAt, recipient.customer_id).run();

    let delivery;
    try {
      const token = await makeUnsubscribeToken(env, recipient.customer_id);
      const origin = String(env.APP_ORIGIN || 'https://winwinleb.com').replace(/\/$/, '');
      delivery = await sendMarketingEmail(env, {
        to: current.email_normalized,
        customer: current,
        unsubscribeUrl: `${origin}/unsubscribe?token=${encodeURIComponent(token)}`,
      });
    } catch (error) {
      delivery = { sent: false, reason: safeFailure(error) };
    }

    if (delivery.sent) {
      const sentAt = nowIso();
      await env.DB.batch([
        env.DB.prepare(`UPDATE marketing_send_log SET status = 'sent', sent_at = ?, failure_reason = '', provider_message_id = ? WHERE id = ?`)
          .bind(sentAt, delivery.id || '', recipient.log_id),
        env.DB.prepare('UPDATE customers SET last_marketing_email_sent_at = ? WHERE id = ?')
          .bind(sentAt, recipient.customer_id),
      ]);
    } else {
      await env.DB.prepare(`UPDATE marketing_send_log SET status = 'failed', failure_reason = ? WHERE id = ?`)
        .bind(delivery.reason || 'provider_error', recipient.log_id).run();
      console.error('[WinWin marketing] delivery failed', {
        campaign_date: day,
        customer_id: recipient.customer_id,
        reason: delivery.reason || 'provider_error',
      });
    }
  }

  const totals = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('attempting','sent','failed') THEN 1 ELSE 0 END) AS attempted,
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) AS remaining
     FROM marketing_send_log WHERE campaign_id = ?`,
  ).bind(campaignId).first();
  const completed = Number(totals?.remaining || 0) === 0;
  await env.DB.prepare(
    `UPDATE marketing_campaigns SET status = ?, attempted_count = ?, sent_count = ?, failed_count = ?, completed_at = ? WHERE id = ?`,
  ).bind(
    completed ? 'completed' : 'running',
    Number(totals?.attempted || 0),
    Number(totals?.sent || 0),
    Number(totals?.failed || 0),
    completed ? nowIso() : '',
    campaignId,
  ).run();
  return { campaign_id: campaignId, campaign_date: day, eligible_count: count, ...totals, completed };
}

export async function getMarketingStatus(env) {
  await ensureMarketingSchema(env);
  const cfg = config(env);
  const day = dateKey();
  const cutoff = cutoffIso(cfg.inactivityDays);
  const count = Number((await eligibleCount(env, cutoff))?.n || 0);
  const campaign = await env.DB.prepare('SELECT * FROM marketing_campaigns WHERE campaign_date = ?').bind(day).first();
  const { results: selected } = await env.DB.prepare(
    `SELECT customer_id, recipient_email, status, attempted_at, sent_at, failure_reason
     FROM marketing_send_log WHERE campaign_date = ? ORDER BY created_at ASC, customer_id ASC`,
  ).bind(day).all();
  const last = await env.DB.prepare('SELECT * FROM marketing_campaigns ORDER BY campaign_date DESC LIMIT 1').first();
  const next = await selectRecipients(env, cutoff, cfg.limit);
  return {
    config: { enabled: cfg.enabled, dry_run: cfg.dryRun, daily_limit: cfg.limit, inactivity_days: cfg.inactivityDays, test_mode: Boolean(cfg.testRecipient) },
    cutoff,
    inactive_eligible_count: count,
    today: campaign || null,
    today_selected: selected || [],
    last_campaign: last || null,
    remaining_for_future_days: Math.max(0, count - Number(campaign?.selected_count || 0)),
    next_rotation_preview: next.map((row) => ({ customer_id: row.id, email: row.email_normalized, last_attempted_at: row.last_marketing_email_attempted_at || '' })),
  };
}

export async function unsubscribeMarketing(env, token) {
  await ensureMarketingSchema(env);
  const payload = await readUnsubscribeToken(env, token);
  if (!payload) return { success: false, error: 'This unsubscribe link is invalid.' };
  if (payload.test) return { success: true, test: true };
  const result = await env.DB.prepare(
    `UPDATE customers SET marketing_emails_enabled = 0, marketing_unsubscribed_at = ? WHERE id = ?`,
  ).bind(nowIso(), payload.customerId).run();
  if (Number(result.meta?.changes || 0) !== 1) return { success: false, error: 'This unsubscribe link is invalid.' };
  return { success: true };
}

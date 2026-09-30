export const ACCOUNT_SOURCE = {
  NEW: 'new',
  MIGRATED: 'migrated',
};

export const MIGRATION_STATUS = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  NEEDS_RECOVERY: 'needs_recovery',
  MERGED: 'merged',
};

export const EMAIL_STATUS = {
  VALID: 'valid',
  MISSING: 'missing',
  INVALID: 'invalid',
  DUPLICATE: 'duplicate',
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
};

export const RECOVERY_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
};

export const LEDGER_TYPE = {
  MIGRATION_BALANCE: 'MIGRATION_BALANCE',
  SIGNUP_BONUS: 'SIGNUP_BONUS',
  DAILY_LOGIN: 'DAILY_LOGIN',
  PURCHASE_REWARD: 'PURCHASE_REWARD',
  MANUAL_ADMIN: 'MANUAL_ADMIN',
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^00/, '');
}

// Legacy rows store Lebanese numbers as 71758170, 071758170 or 96171758170.
// Return every stored form of the same number so lookups match all of them.
export function phoneVariants(value) {
  const digits = normalizePhone(value);
  if (!digits) return [];
  let local = digits;
  if (local.startsWith('961') && local.length >= 10) local = local.slice(3);
  local = local.replace(/^0+/, '');
  if (!local) return [digits];
  return [...new Set([digits, local, `0${local}`, `961${local}`])];
}

export function isUsablePhone(value) {
  return normalizePhone(value).length >= 8;
}

export function looksPlaceholderAmbassador(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return false;
  return c === 'base44.app' || c === 'base44' || c === '2011' || c === '1234' || c === 'admin' || /^[0-9]{1,4}$/.test(c);
}

export function normalizeLegacyCountry(raw) {
  const n = String(raw || '')
    .normalize('NFKC')
    .replace(/[\u200e\u200f]/g, '')
    .trim();
  if (!n) return '';
  const lower = n.toLowerCase();
  if (lower === 'lebanon' || n === 'لبنان' || lower === 'lebenon') return 'Lebanon';
  if (lower.startsWith('lebanon')) return 'Lebanon';
  if (
    /beirut|بيروت|aramoun|bshemoun|bshmon|بشامون|saida|nabatiyeh|nabtiyeh|tebnine|baissour|zayni|بقاع|غزه|غزة/i.test(n)
  ) {
    return 'Lebanon';
  }
  if (/zimbabwe/i.test(n)) return 'Zimbabwe';
  if (/otstrad|amer\s*hssein/i.test(n)) return '';
  return n;
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function splitName(fullName, firstName, lastName) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  if (first || last) {
    return {
      first_name: first,
      last_name: last,
      full_name: [first, last].filter(Boolean).join(' ').trim(),
    };
  }
  const full = String(fullName || '').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
    full_name: full,
  };
}

export function classifyLegacyEmail(rawEmail, emailCounts) {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return { email: '', email_status: EMAIL_STATUS.MISSING, migration_status: MIGRATION_STATUS.NEEDS_RECOVERY };
  }
  if (!isValidEmail(email)) {
    return { email, email_status: EMAIL_STATUS.INVALID, migration_status: MIGRATION_STATUS.NEEDS_RECOVERY };
  }
  const count = Number(emailCounts.get(email) || 0);
  if (count > 1) {
    return { email, email_status: EMAIL_STATUS.DUPLICATE, migration_status: MIGRATION_STATUS.NEEDS_RECOVERY };
  }
  return { email, email_status: EMAIL_STATUS.VALID, migration_status: MIGRATION_STATUS.PENDING };
}

export function countEmails(records, getEmail) {
  const counts = new Map();
  for (const record of records) {
    const email = normalizeEmail(getEmail(record));
    if (!email || !isValidEmail(email)) continue;
    counts.set(email, (counts.get(email) || 0) + 1);
  }
  return counts;
}

export function stripLegacySecrets(record) {
  if (!record || typeof record !== 'object') return {};
  const copy = { ...record };
  delete copy.password;
  delete copy.Password;
  delete copy.password_hash;
  delete copy.passwordHash;
  return copy;
}

export function pickLegacyField(record, keys) {
  for (const key of keys) {
    if (record[key] != null && String(record[key]).trim() !== '') return record[key];
  }
  return '';
}

export function mapLegacyRecord(record, emailCounts) {
  const legacyId = String(
    pickLegacyField(record, ['legacy_user_id', 'legacyUserId', 'legacy_id', 'id', 'customer_id', 'user_id']) || '',
  ).trim();
  const names = splitName(
    pickLegacyField(record, ['full_name', 'fullName', 'name']),
    pickLegacyField(record, ['first_name', 'firstName']),
    pickLegacyField(record, ['last_name', 'lastName']),
  );
  const classified = classifyLegacyEmail(
    pickLegacyField(record, ['email', 'email_address', 'Email']),
    emailCounts,
  );
  const points = Math.max(0, Math.round(Number(pickLegacyField(record, ['points', 'points_balance', 'balance'])) || 0));
  const cardExpiry = String(pickLegacyField(record, ['card_expiry_date', 'cardExpiryDate', 'expiry_date']) || '').trim();
  const hasCardRaw = pickLegacyField(record, ['has_winwin_card', 'hasWinWinCard', 'card_active']);
  const hasCard = hasCardRaw === true || hasCardRaw === 1 || String(hasCardRaw).toLowerCase() === 'true' || String(hasCardRaw) === '1';
  const ambassadorRaw = String(pickLegacyField(record, ['ambassador_code']) || '').trim();

  return {
    legacy_user_id: legacyId,
    ...names,
    email: classified.email,
    mobile: String(pickLegacyField(record, ['mobile', 'phone', 'phone_number', 'tel']) || '').trim(),
    country: normalizeLegacyCountry(pickLegacyField(record, ['country'])),
    points,
    has_winwin_card: hasCard,
    card_number: String(pickLegacyField(record, ['card_number', 'loyalty_card', 'cardNumber']) || '').trim(),
    card_purchase_date: String(pickLegacyField(record, ['card_purchase_date', 'cardPurchaseDate']) || '').trim(),
    card_expiry_date: cardExpiry,
    ambassador_code: looksPlaceholderAmbassador(ambassadorRaw) ? '' : ambassadorRaw,
    is_ambassador: (() => {
      const raw = pickLegacyField(record, ['is_ambassador']);
      return raw === true || raw === 1 || String(raw).toLowerCase() === 'true' || String(raw) === '1';
    })(),
    wallet_balance: Math.max(0, Number(pickLegacyField(record, ['wallet_balance'])) || 0),
    draw_entries: Math.max(0, Math.round(Number(pickLegacyField(record, ['draw_entries'])) || 0)),
    created_date: String(pickLegacyField(record, ['created_date', 'createdAt', 'created_at']) || '').trim(),
    account_source: ACCOUNT_SOURCE.MIGRATED,
    migration_status: classified.migration_status,
    password_setup_required: true,
    profile_review_required: true,
    email_status: classified.email_status,
    signup_bonus_granted: true,
  };
}

export function emptyMigrationReport() {
  return {
    total: 0,
    imported: 0,
    valid_unique_emails: 0,
    missing_emails: 0,
    invalid_emails: 0,
    duplicate_emails: 0,
    needs_recovery: 0,
    skipped: 0,
    errors: 0,
    error_ids: [],
  };
}

export function formatMigrationReport(report) {
  return [
    `Total legacy users: ${report.total}`,
    `Imported successfully: ${report.imported}`,
    `Valid unique emails: ${report.valid_unique_emails}`,
    `Missing emails: ${report.missing_emails}`,
    `Invalid emails: ${report.invalid_emails}`,
    `Duplicate emails: ${report.duplicate_emails}`,
    `Needs recovery: ${report.needs_recovery}`,
    `Already imported/skipped: ${report.skipped}`,
    `Errors: ${report.errors}`,
  ].join('\n');
}

export function tallyEmailStatus(report, emailStatus) {
  if (emailStatus === EMAIL_STATUS.VALID) report.valid_unique_emails += 1;
  if (emailStatus === EMAIL_STATUS.MISSING) report.missing_emails += 1;
  if (emailStatus === EMAIL_STATUS.INVALID) report.invalid_emails += 1;
  if (emailStatus === EMAIL_STATUS.DUPLICATE) report.duplicate_emails += 1;
  if (emailStatus !== EMAIL_STATUS.VALID) report.needs_recovery += 1;
}

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  points_price REAL NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  in_stock INTEGER NOT NULL DEFAULT 1,
  created_date TEXT,
  updated_date TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT,
  id TEXT
);

CREATE TABLE IF NOT EXISTS slides (
  id TEXT PRIMARY KEY,
  title TEXT,
  image_url TEXT,
  sort_order INTEGER,
  created_date TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  type TEXT NOT NULL DEFAULT 'PRODUCT_PURCHASE',
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount_usd REAL NOT NULL DEFAULT 0,
  discount_usd REAL NOT NULL DEFAULT 0,
  items_json TEXT,
  product_ids TEXT,
  product_summary TEXT,
  calculated_points INTEGER NOT NULL DEFAULT 0,
  submitted_by TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  reject_reason TEXT,
      ambassador_code TEXT,
      member_price_requested INTEGER NOT NULL DEFAULT 0,
      created_date TEXT,
      delivery_json TEXT
    );

CREATE INDEX IF NOT EXISTS idx_store_transactions_status ON store_transactions (status, created_date);

-- Customer accounts (also created at runtime by ensureCustomerSchema)
CREATE TABLE IF NOT EXISTS customers (
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
);

CREATE TABLE IF NOT EXISTS customer_auth (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  reset_token_hash TEXT,
  reset_expires_at TEXT,
  verify_token_hash TEXT,
  verify_expires_at TEXT,
  must_reset_password INTEGER NOT NULL DEFAULT 0,
  created_date TEXT
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS points_ledger (
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
);

CREATE TABLE IF NOT EXISTS loyalty_memberships (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT,
  source TEXT,
  approved_by TEXT,
  related_transaction_id TEXT
);

CREATE TABLE IF NOT EXISTS customer_addresses (
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
);

CREATE TABLE IF NOT EXISTS recovery_requests (
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
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_date TEXT
);

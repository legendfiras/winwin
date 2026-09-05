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

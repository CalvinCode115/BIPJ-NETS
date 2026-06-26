CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Bronze Tier',
  points INTEGER NOT NULL DEFAULT 0,
  email TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  label TEXT NOT NULL,
  card_number TEXT NOT NULL,
  masked_number TEXT,
  cardholder_name TEXT,
  expiry_date TEXT,
  balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  top_up_enabled INTEGER NOT NULL DEFAULT 0,
  bank_name TEXT,
  account_kind TEXT,
  is_default_receive INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_number ON cards(card_number);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  subtitle TEXT,
  amount REAL NOT NULL,
  txn_type TEXT NOT NULL,
  icon TEXT,
  icon_color TEXT,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(occurred_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

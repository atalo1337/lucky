CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS lottery_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_enabled INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER,
  scheduled_open_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  probability_percent REAL NOT NULL DEFAULT 0,
  win_message TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS prize_codes (
  id TEXT PRIMARY KEY,
  prize_id TEXT NOT NULL,
  code_value TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unused',
  import_batch TEXT NOT NULL,
  used_draw_id TEXT,
  created_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (prize_id) REFERENCES prizes(id)
);

CREATE TABLE IF NOT EXISTS draw_records (
  id TEXT PRIMARY KEY,
  participant_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  ua_hash TEXT NOT NULL,
  is_win INTEGER NOT NULL,
  prize_id TEXT,
  code_id TEXT,
  contact_email TEXT,
  email_status TEXT NOT NULL DEFAULT 'not_applicable',
  email_sent_at TEXT,
  email_error TEXT,
  shown_message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prize_id) REFERENCES prizes(id),
  FOREIGN KEY (code_id) REFERENCES prize_codes(id)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_prize_codes_prize_status
  ON prize_codes (prize_id, status);
CREATE INDEX IF NOT EXISTS idx_draw_records_participant
  ON draw_records (participant_hash);
CREATE INDEX IF NOT EXISTS idx_draw_records_fingerprint
  ON draw_records (ip_hash, ua_hash);
CREATE INDEX IF NOT EXISTS idx_draw_records_created_at
  ON draw_records (created_at DESC);
INSERT OR IGNORE INTO lottery_settings (id, is_enabled, updated_at)
VALUES (1, 0, CURRENT_TIMESTAMP);

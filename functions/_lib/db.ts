import type { AdminRecord, AppEnv } from './types'
import { hashPassword } from './security'

const SCHEMA_SQL = `
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
  updated_at TEXT NOT NULL
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
`

let schemaReady = false

export function nowIso(): string {
  return new Date().toISOString()
}

function getDatabase(env: AppEnv): D1Database {
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    throw new Error(
      '未检测到 Cloudflare D1 绑定。请在 Pages 项目的 Settings -> Bindings 中添加名称为 DB 的 D1 绑定，并重新部署。',
    )
  }

  return env.DB
}

export async function ensureDatabase(env: AppEnv) {
  if (schemaReady) {
    return
  }

  const db = getDatabase(env)

  await db.exec(SCHEMA_SQL)
  await db
    .prepare(
      `INSERT OR IGNORE INTO lottery_settings (id, is_enabled, updated_at)
       VALUES (1, 0, ?)`,
    )
    .bind(nowIso())
    .run()

  schemaReady = true
}

export async function ensureDefaultAdmin(env: AppEnv) {
  await ensureDatabase(env)

  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return
  }

  const db = getDatabase(env)
  const existing = await db.prepare('SELECT id FROM admins LIMIT 1').first<{ id: string }>()
  if (existing) {
    return
  }

  const now = nowIso()
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD)

  await db
    .prepare(
      `INSERT INTO admins (
        id, username, password_hash, must_change_password, created_at, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?)`,
    )
    .bind(crypto.randomUUID(), env.ADMIN_USERNAME, passwordHash, now, now)
    .run()
}

export async function getAdminById(
  env: AppEnv,
  adminId: string,
): Promise<AdminRecord | null> {
  await ensureDatabase(env)

  return (
    (await getDatabase(env)
      .prepare(
        `SELECT id, username, password_hash, must_change_password, created_at, updated_at, last_login_at
         FROM admins
         WHERE id = ?`,
      )
      .bind(adminId)
      .first<AdminRecord>()) ?? null
  )
}

export async function getAdminByUsername(
  env: AppEnv,
  username: string,
): Promise<AdminRecord | null> {
  await ensureDefaultAdmin(env)

  return (
    (await getDatabase(env)
      .prepare(
        `SELECT id, username, password_hash, must_change_password, created_at, updated_at, last_login_at
         FROM admins
         WHERE username = ?`,
      )
      .bind(username)
      .first<AdminRecord>()) ?? null
  )
}

export async function writeAuditLog(
  env: AppEnv,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  payload: unknown,
) {
  await ensureDatabase(env)

  await getDatabase(env)
    .prepare(
      `INSERT INTO admin_audit_logs (
        id, admin_id, action, target_type, target_id, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      adminId,
      action,
      targetType,
      targetId,
      JSON.stringify(payload ?? {}),
      nowIso(),
    )
    .run()
}

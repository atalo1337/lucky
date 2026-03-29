import type { AdminRecord, AppEnv } from './types'
import {
  hashPassword,
  isPasswordHashSupported,
} from './security'

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

async function ensureSchemaExists(db: D1Database) {
  const requiredTables = [
    'admins',
    'lottery_settings',
    'prizes',
    'prize_codes',
    'draw_records',
    'admin_audit_logs',
  ]

  const rows = await db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'`,
    )
    .all<{ name: string }>()

  const existing = new Set((rows.results ?? []).map((row) => row.name))
  const missing = requiredTables.filter((tableName) => !existing.has(tableName))

  if (missing.length > 0) {
    throw new Error(
      `数据库尚未初始化，缺少表：${missing.join(', ')}。请先执行 migrations/0001_init.sql 后再访问站点。`,
    )
  }
}

async function upgradeLegacyDefaultAdmin(env: AppEnv, db: D1Database) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return
  }

  const admin = await db
    .prepare(
      `SELECT id, username, password_hash
       FROM admins
       WHERE username = ?
       LIMIT 1`,
    )
    .bind(env.ADMIN_USERNAME)
    .first<{
      id: string
      username: string
      password_hash: string
    }>()

  if (!admin || isPasswordHashSupported(admin.password_hash)) {
    return
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD)
  await db
    .prepare(
      `UPDATE admins
       SET password_hash = ?, must_change_password = 1, updated_at = ?
       WHERE id = ?`,
    )
    .bind(passwordHash, nowIso(), admin.id)
    .run()
}

export async function ensureDatabase(env: AppEnv) {
  if (schemaReady) {
    return
  }

  const db = getDatabase(env)
  await ensureSchemaExists(db)
  await upgradeLegacyDefaultAdmin(env, db)
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

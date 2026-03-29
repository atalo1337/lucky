import { ensureDatabase, nowIso } from './db'
import type { AppEnv } from './types'

export interface PrizeInput {
  name: string
  probabilityPercent: number
  winMessage: string
  isActive: boolean
  sortOrder: number
}

export interface PrizeCodeRecord {
  id: string
  codeValue: string
  status: 'unused' | 'used'
  importBatch: string
  createdAt: string
  usedAt: string | null
}

export function validatePrizeInput(input: PrizeInput) {
  if (!input.name.trim()) {
    throw new Error('奖项名称不能为空。')
  }

  if (!input.winMessage.trim()) {
    throw new Error('中奖文案不能为空。')
  }

  if (!Number.isFinite(input.probabilityPercent) || input.probabilityPercent < 0) {
    throw new Error('中奖概率必须是不小于 0 的数字。')
  }

  if (input.probabilityPercent > 100) {
    throw new Error('单个奖项概率不能超过 100%。')
  }

  if (!Number.isInteger(input.sortOrder)) {
    throw new Error('排序必须是整数。')
  }
}

export async function ensureProbabilityWithinLimit(
  env: AppEnv,
  nextProbability: number,
  isActive: boolean,
  excludePrizeId?: string,
) {
  await ensureDatabase(env)

  const row = await env.DB
    .prepare(
      `SELECT COALESCE(SUM(probability_percent), 0) AS total
       FROM prizes
       WHERE is_active = 1 AND (? IS NULL OR id != ?)`,
    )
    .bind(excludePrizeId ?? null, excludePrizeId ?? null)
    .first<{ total: number }>()

  const total = Number(row?.total ?? 0) + (isActive ? nextProbability : 0)
  if (total > 100) {
    throw new Error('启用奖项的总概率不能超过 100%。')
  }
}

export async function listAdminPrizes(env: AppEnv) {
  await ensureDatabase(env)

  const rows = await env.DB
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.probability_percent AS probabilityPercent,
        p.win_message AS winMessage,
        p.is_active AS isActive,
        p.sort_order AS sortOrder,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        SUM(CASE WHEN pc.status = 'unused' THEN 1 ELSE 0 END) AS availableCodes,
        SUM(CASE WHEN pc.status = 'used' THEN 1 ELSE 0 END) AS usedCodes
      FROM prizes p
      LEFT JOIN prize_codes pc ON pc.prize_id = p.id
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.created_at ASC`,
    )
    .all<{
      id: string
      name: string
      probabilityPercent: number
      winMessage: string
      isActive: number
      sortOrder: number
      createdAt: string
      updatedAt: string
      availableCodes: number | null
      usedCodes: number | null
    }>()

  return (rows.results ?? []).map((row) => ({
    ...row,
    isActive: row.isActive === 1,
    availableCodes: Number(row.availableCodes ?? 0),
    usedCodes: Number(row.usedCodes ?? 0),
  }))
}

export async function createPrize(env: AppEnv, input: PrizeInput) {
  validatePrizeInput(input)
  await ensureProbabilityWithinLimit(
    env,
    input.probabilityPercent,
    input.isActive,
  )

  const now = nowIso()
  const id = crypto.randomUUID()
  await env.DB
    .prepare(
      `INSERT INTO prizes (
        id, name, probability_percent, win_message, is_active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.name.trim(),
      input.probabilityPercent,
      input.winMessage.trim(),
      input.isActive ? 1 : 0,
      input.sortOrder,
      now,
      now,
    )
    .run()

  return id
}

export async function updatePrize(env: AppEnv, prizeId: string, input: PrizeInput) {
  validatePrizeInput(input)
  await ensureProbabilityWithinLimit(
    env,
    input.probabilityPercent,
    input.isActive,
    prizeId,
  )

  const result = await env.DB
    .prepare(
      `UPDATE prizes
       SET name = ?, probability_percent = ?, win_message = ?, is_active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name.trim(),
      input.probabilityPercent,
      input.winMessage.trim(),
      input.isActive ? 1 : 0,
      input.sortOrder,
      nowIso(),
      prizeId,
    )
    .run()

  if ((result.meta?.changes ?? 0) === 0) {
    throw new Error('奖项不存在。')
  }
}

export async function deletePrize(env: AppEnv, prizeId: string) {
  await ensureDatabase(env)

  const [prize, drawCount, usedCodeCount] = await Promise.all([
    env.DB
      .prepare('SELECT id, name FROM prizes WHERE id = ?')
      .bind(prizeId)
      .first<{ id: string; name: string }>(),
    env.DB
      .prepare('SELECT COUNT(*) AS count FROM draw_records WHERE prize_id = ?')
      .bind(prizeId)
      .first<{ count: number }>(),
    env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM prize_codes
         WHERE prize_id = ? AND status = 'used'`,
      )
      .bind(prizeId)
      .first<{ count: number }>(),
  ])

  if (!prize) {
    throw new Error('奖项不存在。')
  }

  if (Number(drawCount?.count ?? 0) > 0 || Number(usedCodeCount?.count ?? 0) > 0) {
    throw new Error('该奖项已有抽奖记录或已发放卡密，不能直接删除，请先停用后保留历史数据。')
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM prize_codes WHERE prize_id = ?').bind(prizeId),
    env.DB.prepare('DELETE FROM prizes WHERE id = ?').bind(prizeId),
  ])

  return prize
}

export async function listPrizeCodes(
  env: AppEnv,
  prizeId: string,
  limit = 20,
): Promise<PrizeCodeRecord[]> {
  await ensureDatabase(env)

  const boundedLimit = Math.min(Math.max(limit, 1), 100)
  const rows = await env.DB
    .prepare(
      `SELECT
        id,
        code_value AS codeValue,
        status,
        import_batch AS importBatch,
        created_at AS createdAt,
        used_at AS usedAt
      FROM prize_codes
      WHERE prize_id = ?
      ORDER BY status ASC, created_at DESC
      LIMIT ?`,
    )
    .bind(prizeId, boundedLimit)
    .all<PrizeCodeRecord>()

  return (rows.results ?? []).map((row) => ({
    ...row,
    status: row.status === 'used' ? 'used' : 'unused',
  }))
}

export async function deletePrizeCode(
  env: AppEnv,
  prizeId: string,
  codeId: string,
): Promise<PrizeCodeRecord> {
  await ensureDatabase(env)

  const code = await env.DB
    .prepare(
      `SELECT
        id,
        code_value AS codeValue,
        status,
        import_batch AS importBatch,
        created_at AS createdAt,
        used_at AS usedAt
      FROM prize_codes
      WHERE id = ? AND prize_id = ?`,
    )
    .bind(codeId, prizeId)
    .first<PrizeCodeRecord>()

  if (!code) {
    throw new Error('卡密不存在。')
  }

  if (code.status === 'used') {
    throw new Error('已发放的卡密不能删除，以免影响中奖记录。')
  }

  const result = await env.DB
    .prepare('DELETE FROM prize_codes WHERE id = ? AND prize_id = ? AND status = \'unused\'')
    .bind(codeId, prizeId)
    .run()

  if ((result.meta?.changes ?? 0) === 0) {
    throw new Error('卡密删除失败，请刷新后重试。')
  }

  return {
    ...code,
    status: 'unused',
  }
}

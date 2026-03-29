import { ensureDatabase, nowIso } from './db'
import type { AppEnv } from './types'

export interface PrizeInput {
  name: string
  probabilityPercent: number
  winMessage: string
  isActive: boolean
  sortOrder: number
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

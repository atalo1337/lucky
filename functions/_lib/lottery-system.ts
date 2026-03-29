import { ensureDatabase, nowIso } from './db'
import { listAdminPrizes } from './prizes'
import type { AppEnv } from './types'

export interface LotterySettingsSnapshot {
  isEnabled: boolean
  maxParticipants: number | null
  scheduledOpenAt: string | null
  updatedAt: string
}

export interface LotteryDashboardData {
  isEnabled: boolean
  maxParticipants: number | null
  scheduledOpenAt: string | null
  participantCount: number
  winnerCount: number
  remainingParticipants: number | null
  prizeSummaries: Awaited<ReturnType<typeof listAdminPrizes>>
}

export interface RoundResetSummary {
  deletedDrawRecords: number
  resetPrizeCodes: number
}

function normalizeNullableInteger(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!Number.isFinite(value)) {
    throw new Error('人数上限必须是数字。')
  }

  if (value <= 0) {
    return null
  }

  return Math.floor(value)
}

export function normalizeScheduledOpenAt(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('自动开启时间格式不正确。')
  }

  return date.toISOString()
}

export async function getLotterySettings(
  env: AppEnv,
): Promise<LotterySettingsSnapshot> {
  await ensureDatabase(env)

  const row = await env.DB
    .prepare(
      `SELECT is_enabled, max_participants, scheduled_open_at, updated_at
       FROM lottery_settings
       WHERE id = 1`,
    )
    .first<{
      is_enabled: number
      max_participants: number | null
      scheduled_open_at: string | null
      updated_at: string
    }>()

  return {
    isEnabled: row?.is_enabled === 1,
    maxParticipants: row?.max_participants ?? null,
    scheduledOpenAt: row?.scheduled_open_at ?? null,
    updatedAt: row?.updated_at ?? nowIso(),
  }
}

export async function updateLotterySettings(
  env: AppEnv,
  input: {
    isEnabled?: boolean
    maxParticipants?: number | null
    scheduledOpenAt?: string | null
  },
) {
  await ensureDatabase(env)

  const current = await getLotterySettings(env)
  const next = {
    isEnabled: input.isEnabled ?? current.isEnabled,
    maxParticipants:
      input.maxParticipants !== undefined
        ? normalizeNullableInteger(input.maxParticipants)
        : current.maxParticipants,
    scheduledOpenAt:
      input.scheduledOpenAt !== undefined
        ? normalizeScheduledOpenAt(input.scheduledOpenAt)
        : current.scheduledOpenAt,
  }

  await env.DB
    .prepare(
      `UPDATE lottery_settings
       SET is_enabled = ?, max_participants = ?, scheduled_open_at = ?, updated_at = ?
       WHERE id = 1`,
    )
    .bind(
      next.isEnabled ? 1 : 0,
      next.maxParticipants,
      next.scheduledOpenAt,
      nowIso(),
    )
    .run()

  return getLotterySettings(env)
}

export async function resetLotteryRoundData(
  env: AppEnv,
): Promise<RoundResetSummary> {
  await ensureDatabase(env)

  const [drawCount, usedCodeCount] = await Promise.all([
    env.DB
      .prepare('SELECT COUNT(*) AS count FROM draw_records')
      .first<{ count: number }>(),
    env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM prize_codes pc
         INNER JOIN prizes p ON p.id = pc.prize_id
         WHERE pc.status = 'used' AND p.deleted_at IS NULL`,
      )
      .first<{ count: number }>(),
  ])

  await env.DB.batch([
    env.DB.prepare('DELETE FROM draw_records'),
    env.DB.prepare(
      `UPDATE prize_codes
       SET status = 'unused', used_draw_id = NULL, used_at = NULL
       WHERE status = 'used'
         AND prize_id IN (
           SELECT id FROM prizes WHERE deleted_at IS NULL
         )`,
    ),
  ])

  return {
    deletedDrawRecords: Number(drawCount?.count ?? 0),
    resetPrizeCodes: Number(usedCodeCount?.count ?? 0),
  }
}

export async function countParticipants(env: AppEnv) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM draw_records')
    .first<{ count: number }>()

  return Number(row?.count ?? 0)
}

export async function countWinners(env: AppEnv) {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM draw_records WHERE is_win = 1')
    .first<{ count: number }>()

  return Number(row?.count ?? 0)
}

export async function countSelectablePrizes(env: AppEnv) {
  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) AS count
       FROM prizes p
       WHERE p.deleted_at IS NULL
         AND p.is_active = 1
         AND p.probability_percent > 0
         AND EXISTS (
           SELECT 1
           FROM prize_codes pc
           WHERE pc.prize_id = p.id AND pc.status = 'unused'
         )`,
    )
    .first<{ count: number }>()

  return Number(row?.count ?? 0)
}

export async function closeLottery(env: AppEnv) {
  await env.DB
    .prepare(
      `UPDATE lottery_settings
       SET is_enabled = 0, updated_at = ?
       WHERE id = 1`,
    )
    .bind(nowIso())
    .run()
}

export async function maybeActivateScheduledLottery(env: AppEnv) {
  const settings = await getLotterySettings(env)

  if (settings.isEnabled || !settings.scheduledOpenAt) {
    return settings
  }

  const scheduledTime = new Date(settings.scheduledOpenAt).getTime()
  if (Number.isNaN(scheduledTime) || scheduledTime > Date.now()) {
    return settings
  }

  await resetLotteryRoundData(env)
  await updateLotterySettings(env, {
    isEnabled: true,
    scheduledOpenAt: null,
  })

  return getLotterySettings(env)
}

export async function getRemainingParticipants(
  env: AppEnv,
  maxParticipants: number | null,
) {
  if (maxParticipants === null) {
    return null
  }

  const current = await countParticipants(env)
  return Math.max(maxParticipants - current, 0)
}

export async function getLotteryDashboardData(
  env: AppEnv,
): Promise<LotteryDashboardData> {
  await ensureDatabase(env)
  const settings = await maybeActivateScheduledLottery(env)

  const [participantCount, winnerCount, prizeSummaries] = await Promise.all([
    countParticipants(env),
    countWinners(env),
    listAdminPrizes(env),
  ])

  return {
    isEnabled: settings.isEnabled,
    maxParticipants: settings.maxParticipants,
    scheduledOpenAt: settings.scheduledOpenAt,
    participantCount,
    winnerCount,
    remainingParticipants:
      settings.maxParticipants === null
        ? null
        : Math.max(settings.maxParticipants - participantCount, 0),
    prizeSummaries,
  }
}

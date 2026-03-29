import { DEFAULT_LOSE_MESSAGE } from './constants'
import { readSignedCookie } from './cookies'
import { ensureDatabase, nowIso } from './db'
import { requireSecret } from './env'
import {
  getClientIp,
  getRequestHashes,
  resolveParticipant,
} from './participants'
import { sha256 } from './security'
import { verifyTurnstile } from './turnstile'
import type { AppEnv } from './types'

interface RawDrawRecord {
  created_at: string
  is_win: number
  shown_message: string
  prize_id: string | null
  prize_name: string | null
  code_value: string | null
}

interface PrizeCandidate {
  id: string
  name: string
  probability_percent: number
  win_message: string
  available_codes: number | null
}

function mapDrawRecord(record: RawDrawRecord | null) {
  if (!record) {
    return null
  }

  return {
    isWin: record.is_win === 1,
    prizeId: record.prize_id,
    prizeName: record.prize_name,
    message: record.shown_message,
    codeValue: record.code_value,
    createdAt: record.created_at,
  }
}

async function getLatestResultByParticipant(env: AppEnv, participantHash: string) {
  const record =
    (await env.DB
      .prepare(
        `SELECT
          dr.created_at,
          dr.is_win,
          dr.shown_message,
          dr.prize_id,
          p.name AS prize_name,
          pc.code_value
        FROM draw_records dr
        LEFT JOIN prizes p ON p.id = dr.prize_id
        LEFT JOIN prize_codes pc ON pc.id = dr.code_id
        WHERE dr.participant_hash = ?
        ORDER BY dr.created_at DESC
        LIMIT 1`,
      )
      .bind(participantHash)
      .first<RawDrawRecord>()) ?? null

  return mapDrawRecord(record)
}

export async function getParticipantCount(env: AppEnv) {
  const count = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM draw_records')
    .first<{ count: number }>()

  return Number(count?.count ?? 0)
}

export async function getLotteryStatus(env: AppEnv, request: Request) {
  await ensureDatabase(env)

  const [settings, participantCountResult, publicPrizes] = await Promise.all([
    env.DB
      .prepare('SELECT is_enabled FROM lottery_settings WHERE id = 1')
      .first<{ is_enabled: number }>(),
    env.DB
      .prepare('SELECT COUNT(*) AS count FROM draw_records')
      .first<{ count: number }>(),
    env.DB
      .prepare(
        `SELECT
           p.id,
           p.name,
           (
             SELECT COUNT(*)
             FROM draw_records dr
             WHERE dr.prize_id = p.id AND dr.is_win = 1
           ) AS winnerCount
         FROM prizes p
         WHERE p.is_active = 1 AND p.deleted_at IS NULL
         ORDER BY p.sort_order ASC, p.created_at ASC`,
      )
      .all<{ id: string; name: string; winnerCount: number | null }>(),
  ])

  const participantId = await readSignedCookie(
    request,
    'lottery_participant',
    requireSecret(env, 'SESSION_SECRET'),
  )
  const participantHash = participantId ? await sha256(participantId) : null
  const lastResult = participantHash
    ? await getLatestResultByParticipant(env, participantHash)
    : null

  return {
    isEnabled: settings?.is_enabled === 1,
    participantCount: Number(participantCountResult?.count ?? 0),
    siteKey: env.TURNSTILE_SITE_KEY ?? '',
    hasParticipated: Boolean(lastResult),
    lastResult,
    publicPrizes: (publicPrizes.results ?? []).map((prize) => ({
      ...prize,
      winnerCount: Number(prize.winnerCount ?? 0),
    })),
  }
}

function nextPercentage(): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]
  return (value / 0xffffffff) * 100
}

async function selectPrize(env: AppEnv): Promise<PrizeCandidate | null> {
  const rows = await env.DB
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.probability_percent,
        p.win_message,
        SUM(CASE WHEN pc.status = 'unused' THEN 1 ELSE 0 END) AS available_codes
      FROM prizes p
      LEFT JOIN prize_codes pc ON pc.prize_id = p.id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.created_at ASC`,
    )
    .all<PrizeCandidate>()

  const candidates = (rows.results ?? []).filter(
    (prize) =>
      Number(prize.probability_percent) > 0 &&
      Number(prize.available_codes ?? 0) > 0,
  )

  const random = nextPercentage()
  let cursor = 0

  for (const prize of candidates) {
    cursor += Number(prize.probability_percent)
    if (random <= cursor) {
      return prize
    }
  }

  return null
}

async function reservePrizeCode(
  env: AppEnv,
  prizeId: string,
  drawId: string,
): Promise<{ codeId: string; codeValue: string } | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await env.DB
      .prepare(
        `SELECT id, code_value
         FROM prize_codes
         WHERE prize_id = ? AND status = 'unused'
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(prizeId)
      .first<{ id: string; code_value: string }>()

    if (!code) {
      return null
    }

    const update = await env.DB
      .prepare(
        `UPDATE prize_codes
         SET status = 'used', used_at = ?, used_draw_id = ?
         WHERE id = ? AND status = 'unused'`,
      )
      .bind(nowIso(), drawId, code.id)
      .run()

    if ((update.meta?.changes ?? 0) > 0) {
      return {
        codeId: code.id,
        codeValue: code.code_value,
      }
    }
  }

  return null
}

export async function executeDraw(env: AppEnv, request: Request, token: string) {
  await ensureDatabase(env)

  const settings = await env.DB
    .prepare('SELECT is_enabled FROM lottery_settings WHERE id = 1')
    .first<{ is_enabled: number }>()

  if (!settings || settings.is_enabled !== 1) {
    return {
      status: 403,
      participantCount: await getParticipantCount(env),
      message: '抽奖系统当前未开启。',
      result: null,
      participantCookieHeader: null,
    }
  }

  const { participantHash, participantCookieHeader } = await resolveParticipant(env, request)
  const { ipHash, uaHash } = await getRequestHashes(request)
  const existingByParticipant = await getLatestResultByParticipant(env, participantHash)

  if (existingByParticipant) {
    return {
      status: 409,
      participantCount: await getParticipantCount(env),
      message: '你已经参与过抽奖了。',
      result: existingByParticipant,
      participantCookieHeader,
    }
  }

  const existingByFingerprint = await env.DB
    .prepare(
      `SELECT id
       FROM draw_records
       WHERE ip_hash = ? AND ua_hash = ?
       LIMIT 1`,
    )
    .bind(ipHash, uaHash)
    .first<{ id: string }>()

  if (existingByFingerprint) {
    return {
      status: 409,
      participantCount: await getParticipantCount(env),
      message: '当前设备已经参与过抽奖了。',
      result: null,
      participantCookieHeader,
    }
  }

  const turnstilePassed = await verifyTurnstile(env, token, getClientIp(request))
  if (!turnstilePassed) {
    return {
      status: 400,
      participantCount: await getParticipantCount(env),
      message: '人机校验未通过，请刷新页面后重试。',
      result: null,
      participantCookieHeader: null,
    }
  }

  const drawId = crypto.randomUUID()
  const selectedPrize = await selectPrize(env)
  const createdAt = nowIso()
  let isWin = false
  let prizeId: string | null = null
  let prizeName: string | null = null
  let codeId: string | null = null
  let codeValue: string | null = null
  let shownMessage = DEFAULT_LOSE_MESSAGE

  if (selectedPrize) {
    const reservedCode = await reservePrizeCode(env, selectedPrize.id, drawId)
    if (reservedCode) {
      isWin = true
      prizeId = selectedPrize.id
      prizeName = selectedPrize.name
      codeId = reservedCode.codeId
      codeValue = reservedCode.codeValue
      shownMessage = selectedPrize.win_message
    }
  }

  try {
    await env.DB
      .prepare(
        `INSERT INTO draw_records (
          id, participant_hash, ip_hash, ua_hash, is_win, prize_id, code_id, shown_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        drawId,
        participantHash,
        ipHash,
        uaHash,
        isWin ? 1 : 0,
        prizeId,
        codeId,
        shownMessage,
        createdAt,
      )
      .run()
  } catch (error) {
    if (codeId) {
      await env.DB
        .prepare(
          `UPDATE prize_codes
           SET status = 'unused', used_at = NULL, used_draw_id = NULL
           WHERE id = ? AND used_draw_id = ?`,
        )
        .bind(codeId, drawId)
        .run()
    }

    throw error
  }

  return {
    status: 200,
    participantCount: await getParticipantCount(env),
    message: shownMessage,
    result: {
      isWin,
      prizeId,
      prizeName,
      message: shownMessage,
      codeValue,
      createdAt,
    },
    participantCookieHeader,
  }
}

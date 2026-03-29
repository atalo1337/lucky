import { fail, ok } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  try {
    const records = await context.env.DB
      .prepare(
        `SELECT
          dr.id,
          dr.created_at AS createdAt,
          dr.is_win AS isWin,
          dr.participant_hash AS participantHash,
          p.name AS prizeName,
          pc.code_value AS codeValue,
          dr.contact_email AS contactEmail,
          dr.email_status AS emailStatus,
          dr.shown_message AS shownMessage
        FROM draw_records dr
        LEFT JOIN prizes p ON p.id = dr.prize_id
        LEFT JOIN prize_codes pc ON pc.id = dr.code_id
        ORDER BY dr.created_at DESC
        LIMIT 50`,
      )
      .all<{
        id: string
        createdAt: string
        isWin: number
        participantHash: string
        prizeName: string | null
        codeValue: string | null
        contactEmail: string | null
        emailStatus: string | null
        shownMessage: string
      }>()

    return ok(
      (records.results ?? []).map((item) => ({
        ...item,
        isWin: item.isWin === 1,
        emailStatus: item.emailStatus ?? 'not_applicable',
      })),
    )
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取抽奖记录失败。',
      500,
      'DRAW_RECORDS_ERROR',
    )
  }
}

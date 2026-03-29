import { fail, ok } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  try {
    const [settings, participants, winners, prizeSummaries] = await Promise.all([
      context.env.DB
        .prepare('SELECT is_enabled FROM lottery_settings WHERE id = 1')
        .first<{ is_enabled: number }>(),
      context.env.DB
        .prepare('SELECT COUNT(*) AS count FROM draw_records')
        .first<{ count: number }>(),
      context.env.DB
        .prepare('SELECT COUNT(*) AS count FROM draw_records WHERE is_win = 1')
        .first<{ count: number }>(),
      context.env.DB
        .prepare(
          `SELECT
            p.id,
            p.name,
            p.probability_percent AS probabilityPercent,
            p.is_active AS isActive,
            p.sort_order AS sortOrder,
            SUM(CASE WHEN pc.status = 'unused' THEN 1 ELSE 0 END) AS availableCodes,
            SUM(CASE WHEN pc.status = 'used' THEN 1 ELSE 0 END) AS usedCodes
          FROM prizes p
          LEFT JOIN prize_codes pc ON pc.prize_id = p.id
          WHERE p.deleted_at IS NULL
          GROUP BY p.id
          ORDER BY p.sort_order ASC, p.created_at ASC`,
        )
        .all<{
          id: string
          name: string
          probabilityPercent: number
          isActive: number
          sortOrder: number
          availableCodes: number | null
          usedCodes: number | null
        }>(),
    ])

    return ok({
      isEnabled: settings?.is_enabled === 1,
      participantCount: Number(participants?.count ?? 0),
      winnerCount: Number(winners?.count ?? 0),
      prizeSummaries: (prizeSummaries.results ?? []).map((item) => ({
        ...item,
        isActive: item.isActive === 1,
        availableCodes: Number(item.availableCodes ?? 0),
        usedCodes: Number(item.usedCodes ?? 0),
      })),
    })
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取仪表盘失败。',
      500,
      'DASHBOARD_ERROR',
    )
  }
}

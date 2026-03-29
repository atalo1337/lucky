import { nowIso, writeAuditLog } from '../../_lib/db'
import { fail, ok, parseJson } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

interface SettingsBody {
  isEnabled?: boolean
}

export const onRequestPut: AppFunction = async (context) => {
  try {
    const body = await parseJson<SettingsBody>(context.request)

    if (typeof body.isEnabled !== 'boolean') {
      return fail('请提供 isEnabled 布尔值。', 400, 'INVALID_SETTINGS')
    }

    await context.env.DB
      .prepare(
        `UPDATE lottery_settings
         SET is_enabled = ?, updated_at = ?
         WHERE id = 1`,
      )
      .bind(body.isEnabled ? 1 : 0, nowIso())
      .run()

    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'toggle_lottery',
      'settings',
      '1',
      body,
    )

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
            SUM(CASE WHEN pc.status = 'used' THEN 1 ELSE 0 END) AS usedCodes,
            (
              SELECT COUNT(*)
              FROM draw_records dr
              WHERE dr.prize_id = p.id AND dr.is_win = 1
            ) AS winnerCount
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
          winnerCount: number | null
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
        winnerCount: Number(item.winnerCount ?? 0),
      })),
    })
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '更新系统开关失败。',
      500,
      'SETTINGS_ERROR',
    )
  }
}

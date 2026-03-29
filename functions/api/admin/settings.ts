import { writeAuditLog } from '../../_lib/db'
import { fail, ok, parseJson } from '../../_lib/http'
import {
  getLotteryDashboardData,
  getLotterySettings,
  resetLotteryRoundData,
  updateLotterySettings,
} from '../../_lib/lottery-system'
import type { AppFunction } from '../../_lib/types'

interface SettingsBody {
  isEnabled?: boolean
  maxParticipants?: number | null
  scheduledOpenAt?: string | null
}

export const onRequestPut: AppFunction = async (context) => {
  try {
    const body = await parseJson<SettingsBody>(context.request)
    const current = await getLotterySettings(context.env)

    const hasUpdatableField =
      typeof body.isEnabled === 'boolean'
      || body.maxParticipants !== undefined
      || body.scheduledOpenAt !== undefined

    if (!hasUpdatableField) {
      return fail('请至少提交一项设置。', 400, 'INVALID_SETTINGS')
    }

    let resetSummary = null

    if (body.isEnabled === true && !current.isEnabled) {
      resetSummary = await resetLotteryRoundData(context.env)
      await updateLotterySettings(context.env, {
        isEnabled: true,
        scheduledOpenAt: null,
      })
    } else if (body.isEnabled === false && current.isEnabled) {
      await updateLotterySettings(context.env, {
        isEnabled: false,
      })
    }

    const nextScheduledOpenAt =
      body.isEnabled === true ? undefined : body.scheduledOpenAt

    if (body.maxParticipants !== undefined || body.scheduledOpenAt !== undefined) {
      await updateLotterySettings(context.env, {
        maxParticipants: body.maxParticipants,
        scheduledOpenAt: nextScheduledOpenAt,
      })
    }

    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'update_settings',
      'settings',
      '1',
      {
        ...body,
        resetSummary,
      },
    )

    return ok(await getLotteryDashboardData(context.env))
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '更新抽奖设置失败。',
      500,
      'SETTINGS_ERROR',
    )
  }
}

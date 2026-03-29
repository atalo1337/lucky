import { getLotteryDashboardData } from '../../_lib/lottery-system'
import { fail, ok } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  try {
    return ok(await getLotteryDashboardData(context.env))
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取仪表盘失败。',
      500,
      'DASHBOARD_ERROR',
    )
  }
}

import { ensureDatabase } from '../../_lib/db'
import { fail, ok } from '../../_lib/http'
import { getLotteryStatus } from '../../_lib/lottery'
import type { AppFunction } from '../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  try {
    await ensureDatabase(context.env)
    const status = await getLotteryStatus(context.env, context.request)
    return ok(status)
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取抽奖状态失败。',
      500,
      'STATUS_ERROR',
    )
  }
}

import { writeAuditLog } from '../../../_lib/db'
import { fail, ok, parseJson } from '../../../_lib/http'
import {
  createPrize,
  listAdminPrizes,
  type PrizeInput,
} from '../../../_lib/prizes'
import type { AppFunction } from '../../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  try {
    return ok(await listAdminPrizes(context.env))
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取奖项列表失败。',
      500,
      'PRIZE_LIST_ERROR',
    )
  }
}

export const onRequestPost: AppFunction = async (context) => {
  try {
    const body = await parseJson<PrizeInput>(context.request)
    const prizeId = await createPrize(context.env, body)
    const prizes = await listAdminPrizes(context.env)
    const createdPrize = prizes.find((item) => item.id === prizeId)

    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'create_prize',
      'prize',
      prizeId,
      body,
    )

    if (!createdPrize) {
      return fail('奖项创建后读取失败。', 500, 'PRIZE_CREATE_READ_ERROR')
    }

    return ok(createdPrize)
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '创建奖项失败。',
      500,
      'PRIZE_CREATE_ERROR',
    )
  }
}

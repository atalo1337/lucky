import { writeAuditLog } from '../../../_lib/db'
import { fail, ok, parseJson } from '../../../_lib/http'
import {
  deletePrize,
  listAdminPrizes,
  type PrizeInput,
  updatePrize,
} from '../../../_lib/prizes'
import type { AppFunction } from '../../../_lib/types'

function getPrizeId(id: string | string[] | undefined): string | null {
  if (Array.isArray(id)) {
    return id[0] ?? null
  }

  return id ?? null
}

export const onRequestPut: AppFunction<'id'> = async (context) => {
  try {
    const prizeId = getPrizeId(context.params.id)
    if (!prizeId) {
      return fail('缺少奖项 ID。', 400, 'PRIZE_ID_REQUIRED')
    }

    const body = await parseJson<PrizeInput>(context.request)
    await updatePrize(context.env, prizeId, body)
    const prizes = await listAdminPrizes(context.env)
    const updatedPrize = prizes.find((item) => item.id === prizeId)

    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'update_prize',
      'prize',
      prizeId,
      body,
    )

    if (!updatedPrize) {
      return fail('奖项更新后读取失败。', 500, 'PRIZE_UPDATE_READ_ERROR')
    }

    return ok(updatedPrize)
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '更新奖项失败。',
      500,
      'PRIZE_UPDATE_ERROR',
    )
  }
}

export const onRequestDelete: AppFunction<'id'> = async (context) => {
  try {
    const prizeId = getPrizeId(context.params.id)
    if (!prizeId) {
      return fail('缺少奖项 ID。', 400, 'PRIZE_ID_REQUIRED')
    }

    const deletedPrize = await deletePrize(context.env, prizeId)
    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'delete_prize',
      'prize',
      prizeId,
      deletedPrize,
    )

    return ok({
      id: deletedPrize.id,
      name: deletedPrize.name,
    })
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '删除奖项失败。',
      500,
      'PRIZE_DELETE_ERROR',
    )
  }
}

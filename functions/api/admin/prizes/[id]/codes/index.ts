import { fail, ok } from '../../../../../_lib/http'
import { listPrizeCodes } from '../../../../../_lib/prizes'
import type { AppFunction } from '../../../../../_lib/types'

function getPrizeId(id: string | string[] | undefined): string | null {
  if (Array.isArray(id)) {
    return id[0] ?? null
  }

  return id ?? null
}

export const onRequestGet: AppFunction<'id'> = async (context) => {
  try {
    const prizeId = getPrizeId(context.params.id)
    if (!prizeId) {
      return fail('缺少奖项 ID。', 400, 'PRIZE_ID_REQUIRED')
    }

    const url = new URL(context.request.url)
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const codes = await listPrizeCodes(context.env, prizeId, limit)

    return ok(codes)
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '读取卡密列表失败。',
      500,
      'PRIZE_CODE_LIST_ERROR',
    )
  }
}

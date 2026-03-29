import { writeAuditLog } from '../../../../../_lib/db'
import { fail, ok } from '../../../../../_lib/http'
import { deletePrizeCode } from '../../../../../_lib/prizes'
import type { AppFunction } from '../../../../../_lib/types'

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export const onRequestDelete: AppFunction<'id' | 'codeId'> = async (context) => {
  try {
    const prizeId = getParam(context.params.id)
    const codeId = getParam(context.params.codeId)

    if (!prizeId || !codeId) {
      return fail('缺少奖项或卡密 ID。', 400, 'PRIZE_CODE_ID_REQUIRED')
    }

    const deletedCode = await deletePrizeCode(context.env, prizeId, codeId)
    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'delete_prize_code',
      'prize_code',
      codeId,
      {
        prizeId,
        codeValue: deletedCode.codeValue,
      },
    )

    return ok(deletedCode)
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '删除卡密失败。',
      500,
      'PRIZE_CODE_DELETE_ERROR',
    )
  }
}

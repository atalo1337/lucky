import { fail, ok, parseJson } from '../_lib/http'
import { executeDraw } from '../_lib/lottery'
import type { AppFunction } from '../_lib/types'

interface DrawRequestBody {
  token?: string
  email?: string
}

export const onRequestPost: AppFunction = async (context) => {
  try {
    const body = await parseJson<DrawRequestBody>(context.request)
    if (!body.token) {
      return fail('缺少人机校验令牌。', 400, 'TOKEN_REQUIRED')
    }

    if (!body.email) {
      return fail('缺少接收中奖卡密的邮箱地址。', 400, 'EMAIL_REQUIRED')
    }

    const execution = await executeDraw(
      context.env,
      context.request,
      body.token,
      body.email,
    )
    const headers = new Headers()

    if (execution.participantCookieHeader) {
      headers.append('Set-Cookie', execution.participantCookieHeader)
    }

    if (execution.status !== 200 || !execution.result) {
      return fail(
        execution.message,
        execution.status,
        execution.status === 409 ? 'ALREADY_PARTICIPATED' : 'DRAW_REJECTED',
        { headers },
      )
    }

    return ok(
      {
        participantCount: execution.participantCount,
        result: execution.result,
      },
      { headers },
    )
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '抽奖失败，请稍后重试。',
      500,
      'DRAW_ERROR',
    )
  }
}

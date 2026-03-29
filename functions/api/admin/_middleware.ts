import { ensureDatabase, getAdminById } from '../../_lib/db'
import { fail } from '../../_lib/http'
import { readSession } from '../../_lib/session'
import type { AppFunction } from '../../_lib/types'

export const onRequest: AppFunction = async (context) => {
  try {
    await ensureDatabase(context.env)

    const pathname = new URL(context.request.url).pathname
    if (pathname.endsWith('/login')) {
      return context.next()
    }

    const session = await readSession(context.env, context.request)
    if (!session) {
      return fail('管理员未登录。', 401, 'UNAUTHORIZED')
    }

    const admin = await getAdminById(context.env, session.adminId)
    if (!admin) {
      return fail('管理员会话已失效，请重新登录。', 401, 'SESSION_EXPIRED')
    }

    context.data.admin = admin
    return context.next()
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '管理员鉴权初始化失败。',
      500,
      'ADMIN_MIDDLEWARE_ERROR',
    )
  }
}

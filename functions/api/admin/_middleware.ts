import { ensureDatabase, getAdminById } from '../../_lib/db'
import { fail } from '../../_lib/http'
import { readSession } from '../../_lib/session'
import type { AppFunction } from '../../_lib/types'

export const onRequest: AppFunction = async (context) => {
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
}

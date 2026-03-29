import { SESSION_TTL_SECONDS } from '../../_lib/constants'
import {
  createAdminSessionCookie,
  shouldUseSecureCookies,
} from '../../_lib/cookies'
import {
  ensureDefaultAdmin,
  getAdminByUsername,
  nowIso,
} from '../../_lib/db'
import { fail, ok, parseJson } from '../../_lib/http'
import { createSessionValue } from '../../_lib/session'
import { verifyPassword } from '../../_lib/security'
import type { AppFunction } from '../../_lib/types'

interface LoginBody {
  username?: string
  password?: string
}

export const onRequestPost: AppFunction = async (context) => {
  try {
    await ensureDefaultAdmin(context.env)
    const body = await parseJson<LoginBody>(context.request)

    if (!body.username || !body.password) {
      return fail('请输入管理员账号和密码。', 400, 'INVALID_LOGIN')
    }

    const admin = await getAdminByUsername(context.env, body.username.trim())
    if (!admin) {
      return fail('管理员账号或密码错误。', 401, 'INVALID_LOGIN')
    }

    const verified = await verifyPassword(body.password, admin.password_hash)
    if (!verified) {
      return fail('管理员账号或密码错误。', 401, 'INVALID_LOGIN')
    }

    const session = await createSessionValue(context.env, admin.id, admin.username)
    const now = nowIso()
    await context.env.DB
      .prepare('UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, admin.id)
      .run()

    const headers = new Headers()
    headers.append(
      'Set-Cookie',
      createAdminSessionCookie(
        session,
        SESSION_TTL_SECONDS,
        shouldUseSecureCookies(context.request),
      ),
    )

    return ok(
      {
        username: admin.username,
        mustChangePassword: admin.must_change_password === 1,
        lastLoginAt: admin.last_login_at,
      },
      { headers },
    )
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '管理员登录失败。',
      500,
      'LOGIN_ERROR',
    )
  }
}

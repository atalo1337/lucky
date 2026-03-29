import { ok } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

export const onRequestGet: AppFunction = async (context) => {
  const admin = context.data.admin!

  return ok({
    username: admin.username,
    mustChangePassword: admin.must_change_password === 1,
    lastLoginAt: admin.last_login_at,
  })
}

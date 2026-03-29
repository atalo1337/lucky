import { getAdminById, nowIso, writeAuditLog } from '../../_lib/db'
import { fail, ok, parseJson } from '../../_lib/http'
import { hashPassword, verifyPassword } from '../../_lib/security'
import type { AppFunction } from '../../_lib/types'

interface PasswordBody {
  currentPassword?: string
  newPassword?: string
}

export const onRequestPost: AppFunction = async (context) => {
  try {
    const admin = context.data.admin!
    const body = await parseJson<PasswordBody>(context.request)

    if (!body.currentPassword || !body.newPassword) {
      return fail('请完整填写当前密码和新密码。', 400, 'INVALID_PASSWORD')
    }

    if (body.newPassword.length < 8) {
      return fail('新密码长度至少需要 8 位。', 400, 'INVALID_PASSWORD')
    }

    const latestAdmin = await getAdminById(context.env, admin.id)
    if (!latestAdmin) {
      return fail('管理员不存在。', 404, 'ADMIN_NOT_FOUND')
    }

    const matches = await verifyPassword(
      body.currentPassword,
      latestAdmin.password_hash,
    )
    if (!matches) {
      return fail('当前密码不正确。', 400, 'INVALID_PASSWORD')
    }

    const passwordHash = await hashPassword(body.newPassword)
    await context.env.DB
      .prepare(
        `UPDATE admins
         SET password_hash = ?, must_change_password = 0, updated_at = ?
         WHERE id = ?`,
      )
      .bind(passwordHash, nowIso(), admin.id)
      .run()

    await writeAuditLog(
      context.env,
      admin.id,
      'change_password',
      'admin',
      admin.id,
      {},
    )

    return ok({
      username: admin.username,
      mustChangePassword: false,
      lastLoginAt: latestAdmin.last_login_at,
    })
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '密码更新失败。',
      500,
      'PASSWORD_ERROR',
    )
  }
}

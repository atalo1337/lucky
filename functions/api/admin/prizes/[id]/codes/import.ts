import { ensureDatabase, nowIso, writeAuditLog } from '../../../../../_lib/db'
import { fail, ok } from '../../../../../_lib/http'
import type { AppFunction } from '../../../../../_lib/types'

function parseUploadedCodes(content: string) {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return []
  }

  const normalized = lines[0].toLowerCase() === 'code' ? lines.slice(1) : lines

  return normalized
    .map((line) => line.split(',')[0]?.trim() ?? '')
    .filter(Boolean)
}

export const onRequestPost: AppFunction<'id'> = async (context) => {
  try {
    await ensureDatabase(context.env)
    const prizeId = Array.isArray(context.params.id)
      ? context.params.id[0]
      : context.params.id

    if (!prizeId) {
      return fail('缺少奖项 ID。', 400, 'PRIZE_ID_REQUIRED')
    }

    const prize = await context.env.DB
      .prepare(
        `SELECT id
         FROM prizes
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(prizeId)
      .first<{ id: string }>()

    if (!prize) {
      return fail('奖项不存在或已删除。', 404, 'PRIZE_NOT_FOUND')
    }

    const formData = await context.request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return fail('请上传 txt 或 csv 文件。', 400, 'FILE_REQUIRED')
    }

    const content = await file.text()
    const codes = parseUploadedCodes(content)
    if (codes.length === 0) {
      return fail('上传文件中没有解析到任何卡密。', 400, 'NO_CODES')
    }

    const batchId = crypto.randomUUID()
    let imported = 0
    let ignored = 0

    for (const code of codes) {
      const result = await context.env.DB
        .prepare(
          `INSERT OR IGNORE INTO prize_codes (
            id, prize_id, code_value, status, import_batch, created_at
          ) VALUES (?, ?, ?, 'unused', ?, ?)`,
        )
        .bind(crypto.randomUUID(), prizeId, code, batchId, nowIso())
        .run()

      if ((result.meta?.changes ?? 0) > 0) {
        imported += 1
      } else {
        ignored += 1
      }
    }

    await writeAuditLog(
      context.env,
      context.data.admin!.id,
      'import_codes',
      'prize',
      prizeId,
      {
        imported,
        ignored,
        filename: file.name,
      },
    )

    return ok({ imported, ignored })
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : '导入卡密失败。',
      500,
      'CODE_IMPORT_ERROR',
    )
  }
}

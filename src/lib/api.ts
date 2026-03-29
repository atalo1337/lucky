import type { ApiEnvelope } from './types'

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!body || typeof body.ok !== 'boolean') {
    return {
      ok: false,
      error: '服务返回了无法识别的数据。',
    }
  }

  return body
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers,
  })

  const envelope = await parseEnvelope<T>(response)

  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error ?? '请求失败，请稍后重试。')
  }

  return envelope.data
}

export async function apiUpload<T>(
  input: RequestInfo | URL,
  body: FormData,
): Promise<T> {
  const response = await fetch(input, {
    method: 'POST',
    body,
    credentials: 'same-origin',
  })

  const envelope = await parseEnvelope<T>(response)

  if (!response.ok || !envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error ?? '上传失败，请稍后重试。')
  }

  return envelope.data
}

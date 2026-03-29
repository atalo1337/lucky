import type { ApiEnvelope } from './types'

export function json<T>(body: ApiEnvelope<T>, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return json<T>({ ok: true, data }, init)
}

export function fail(
  error: string,
  status = 400,
  code?: string,
  init?: ResponseInit,
): Response {
  return json<never>(
    {
      ok: false,
      error,
      code,
    },
    {
      ...init,
      status,
    },
  )
}

export async function parseJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

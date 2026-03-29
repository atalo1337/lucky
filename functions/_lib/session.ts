import { ADMIN_SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from './constants'
import { getCookie } from './cookies'
import { requireSecret } from './env'
import { fromBase64Url, toArrayBuffer, toBase64Url } from './encoding'
import { signValue, verifySignature } from './security'
import type { AppEnv } from './types'

interface SessionPayload {
  adminId: string
  username: string
  exp: number
}

export async function createSessionValue(
  env: AppEnv,
  adminId: string,
  username: string,
): Promise<string> {
  const payload: SessionPayload = {
    adminId,
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }

  const payloadText = toBase64Url(toArrayBuffer(JSON.stringify(payload)))
  const signature = await signValue(requireSecret(env, 'SESSION_SECRET'), payloadText)
  return `${payloadText}.${signature}`
}

export async function readSession(
  env: AppEnv,
  request: Request,
): Promise<SessionPayload | null> {
  const raw = getCookie(request, ADMIN_SESSION_COOKIE_NAME)
  if (!raw) {
    return null
  }

  const [payloadText, signature] = raw.split('.')
  if (!payloadText || !signature) {
    return null
  }

  const valid = await verifySignature(
    requireSecret(env, 'SESSION_SECRET'),
    payloadText,
    signature,
  )
  if (!valid) {
    return null
  }

  const payload = JSON.parse(
    new TextDecoder().decode(new Uint8Array(fromBase64Url(payloadText))),
  ) as SessionPayload

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  return payload
}

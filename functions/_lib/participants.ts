import {
  PARTICIPANT_COOKIE_NAME,
  PARTICIPANT_COOKIE_TTL_SECONDS,
} from './constants'
import {
  createParticipantCookie,
  createSignedCookieValue,
  readSignedCookie,
  shouldUseSecureCookies,
} from './cookies'
import { requireSecret } from './env'
import { sha256 } from './security'
import type { AppEnv } from './types'

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export async function getRequestHashes(request: Request): Promise<{
  ipHash: string
  uaHash: string
}> {
  return {
    ipHash: await sha256(getClientIp(request)),
    uaHash: await sha256(request.headers.get('User-Agent') ?? 'unknown'),
  }
}

export async function resolveParticipant(
  env: AppEnv,
  request: Request,
): Promise<{
  participantId: string
  participantHash: string
  participantCookieHeader: string | null
}> {
  const secret = requireSecret(env, 'SESSION_SECRET')
  const existing = await readSignedCookie(request, PARTICIPANT_COOKIE_NAME, secret)
  const participantId = existing ?? crypto.randomUUID()
  const participantHash = await sha256(participantId)

  if (existing) {
    return {
      participantId,
      participantHash,
      participantCookieHeader: null,
    }
  }

  const signed = await createSignedCookieValue(participantId, secret)
  return {
    participantId,
    participantHash,
    participantCookieHeader: createParticipantCookie(
      signed,
      PARTICIPANT_COOKIE_TTL_SECONDS,
      shouldUseSecureCookies(request),
    ),
  }
}

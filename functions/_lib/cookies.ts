import {
  ADMIN_SESSION_COOKIE_NAME,
  PARTICIPANT_COOKIE_NAME,
} from './constants'
import { signValue, verifySignature } from './security'

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name || rest.length === 0) {
      continue
    }

    cookies.set(name, decodeURIComponent(rest.join('=')))
  }

  return cookies
}

export function getCookie(request: Request, name: string): string | null {
  return parseCookieHeader(request.headers.get('cookie')).get(name) ?? null
}

export async function createSignedCookieValue(
  payload: string,
  secret: string,
): Promise<string> {
  const signature = await signValue(secret, payload)
  return `${payload}.${signature}`
}

export async function readSignedCookie(
  request: Request,
  name: string,
  secret: string,
): Promise<string | null> {
  const raw = getCookie(request, name)
  if (!raw) {
    return null
  }

  const [payload, signature] = raw.split('.')
  if (!payload || !signature) {
    return null
  }

  const valid = await verifySignature(secret, payload, signature)
  if (!valid) {
    return null
  }

  return payload
}

export function serializeCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${maxAge}`
}

export function clearCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=0`
}

export function shouldUseSecureCookies(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

export function createAdminSessionCookie(
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return serializeCookie(ADMIN_SESSION_COOKIE_NAME, value, maxAge, secure)
}

export function clearAdminSessionCookie(secure: boolean): string {
  return clearCookie(ADMIN_SESSION_COOKIE_NAME, secure)
}

export function createParticipantCookie(
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return serializeCookie(PARTICIPANT_COOKIE_NAME, value, maxAge, secure)
}

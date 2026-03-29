import {
  clearAdminSessionCookie,
  shouldUseSecureCookies,
} from '../../_lib/cookies'
import { ok } from '../../_lib/http'
import type { AppFunction } from '../../_lib/types'

export const onRequestPost: AppFunction = async (context) => {
  const headers = new Headers()
  headers.append(
    'Set-Cookie',
    clearAdminSessionCookie(shouldUseSecureCookies(context.request)),
  )
  return ok<null>(null, { headers })
}

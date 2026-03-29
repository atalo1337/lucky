import { requireSecret } from './env'
import type { AppEnv } from './types'

interface TurnstileVerifyResponse {
  success: boolean
}

export async function verifyTurnstile(
  env: AppEnv,
  token: string,
  remoteIp: string,
): Promise<boolean> {
  const formData = new URLSearchParams()
  formData.set('secret', requireSecret(env, 'TURNSTILE_SECRET_KEY'))
  formData.set('response', token)
  formData.set('remoteip', remoteIp)

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    return false
  }

  const data = (await response.json()) as TurnstileVerifyResponse
  return data.success
}

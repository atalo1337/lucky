import type { AppEnv } from './types'

export function requireSecret(env: AppEnv, key: keyof AppEnv): string {
  const value = env[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`缺少必要环境变量：${String(key)}`)
  }
  return value
}

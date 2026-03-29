export interface AppEnv {
  DB: D1Database
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_SITE_KEY?: string
}

export interface AdminRecord {
  id: string
  username: string
  password_hash: string
  must_change_password: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface AdminContextData {
  admin?: AdminRecord
  [key: string]: unknown
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

export type AppFunction<Params extends string = string> = PagesFunction<
  AppEnv,
  Params,
  AdminContextData
>

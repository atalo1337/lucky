import { fromBase64Url, toArrayBuffer, toBase64Url } from './encoding'

const PASSWORD_ITERATIONS = 120_000

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(value))
  return toBase64Url(hash)
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify'],
  )
}

export async function signValue(secret: string, payload: string): Promise<string> {
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(payload))
  return toBase64Url(signature)
}

export async function verifySignature(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const key = await importHmacKey(secret)
  return crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(signature),
    toArrayBuffer(payload),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength,
  ) as ArrayBuffer
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  return [String(PASSWORD_ITERATIONS), toBase64Url(salt), toBase64Url(bits)].join('$')
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [iterationText, saltText, expectedText] = storedHash.split('$')

  if (!iterationText || !saltText || !expectedText) {
    return false
  }

  const iterations = Number(iterationText)
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64Url(saltText),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  return toBase64Url(bits) === expectedText
}

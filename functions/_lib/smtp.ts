import { connect } from 'cloudflare:sockets'
import { nowIso } from './db'
import { requireSecret } from './env'
import type { AppEnv } from './types'

const DEFAULT_SMTP_HOST = 'smtp.qq.com'
const DEFAULT_SMTP_PORT = 465
const DEFAULT_FROM_NAME = 'southside legacy卡网'

interface WinnerEmailPayload {
  to: string
  prizeName: string
  codeValue: string
  drawTime: string
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${toBase64(value)}?=`
}

function chunkText(value: string, size: number) {
  const output: string[] = []

  for (let index = 0; index < value.length; index += size) {
    output.push(value.slice(index, index + size))
  }

  return output.join('\r\n')
}

function buildMessage(
  fromName: string,
  fromEmail: string,
  payload: WinnerEmailPayload,
) {
  const subject = `${fromName} ${payload.prizeName} 中奖卡密`
  const body = [
    '您好，',
    '',
    `恭喜您抽中奖项：${payload.prizeName}`,
    '您的中奖卡密如下：',
    payload.codeValue,
    '',
    `抽奖时间：${payload.drawTime}`,
    `发信时间：${nowIso()}`,
    '',
    '请妥善保存本邮件内容。',
  ].join('\r\n')

  const headers = [
    `From: ${encodeMimeWord(fromName)} <${fromEmail}>`,
    `To: <${payload.to}>`,
    `Subject: ${encodeMimeWord(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    chunkText(toBase64(body), 76),
  ]

  return `${headers.join('\r\n')}\r\n`
}

class SmtpSession {
  private buffer = ''

  private readonly reader: ReadableStreamDefaultReader<Uint8Array>

  private readonly writer: WritableStreamDefaultWriter<Uint8Array>

  constructor(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {
    this.reader = reader
    this.writer = writer
  }

  private extractResponse(): string | null {
    const lines = this.buffer.split('\r\n')

    if (lines.length < 2) {
      return null
    }

    const completeLines = lines.slice(0, -1)
    const lastLine = completeLines[completeLines.length - 1]

    if (!lastLine || !/^\d{3} /.test(lastLine)) {
      return null
    }

    this.buffer = lines[lines.length - 1] ?? ''
    return completeLines.join('\r\n')
  }

  async readResponse(expectedCodes: number[]) {
    while (true) {
      const extracted = this.extractResponse()
      if (extracted !== null) {
        const code = Number(extracted.slice(0, 3))
        if (!expectedCodes.includes(code)) {
          throw new Error(`SMTP 响应异常：${extracted}`)
        }

        return extracted
      }

      const { value, done } = await this.reader.read()
      if (done || !value) {
        throw new Error('SMTP 连接被远端提前关闭。')
      }

      this.buffer += new TextDecoder().decode(value)
    }
  }

  async send(command: string, expectedCodes: number[]) {
    await this.writer.write(new TextEncoder().encode(command))
    return this.readResponse(expectedCodes)
  }
}

export function validateEmailAddress(email: string) {
  const normalized = email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('请输入有效的邮箱地址。')
  }

  return normalized
}

export async function sendWinnerEmail(
  env: AppEnv,
  payload: WinnerEmailPayload,
) {
  const username = requireSecret(env, 'SMTP_USERNAME')
  const password = requireSecret(env, 'SMTP_PASSWORD')
  const fromEmail = (env.SMTP_FROM_EMAIL ?? username).trim()
  const fromName = (env.SMTP_FROM_NAME ?? DEFAULT_FROM_NAME).trim()
  const smtpHost = (env.SMTP_HOST ?? DEFAULT_SMTP_HOST).trim()
  const smtpPort = Number(env.SMTP_PORT ?? DEFAULT_SMTP_PORT)

  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    throw new Error('SMTP 端口配置不正确。')
  }

  const socket = connect(
    {
      hostname: smtpHost,
      port: smtpPort,
    },
    {
      secureTransport: 'on',
      allowHalfOpen: false,
    },
  )

  const reader = socket.readable.getReader()
  const writer = socket.writable.getWriter()
  const session = new SmtpSession(reader, writer)

  try {
    await socket.opened
    await session.readResponse([220])
    await session.send('EHLO cloudflare-pages\r\n', [250])
    await session.send('AUTH LOGIN\r\n', [334])
    await session.send(`${toBase64(username)}\r\n`, [334])
    await session.send(`${toBase64(password)}\r\n`, [235])
    await session.send(`MAIL FROM:<${fromEmail}>\r\n`, [250])
    await session.send(`RCPT TO:<${payload.to}>\r\n`, [250, 251])
    await session.send('DATA\r\n', [354])

    const message = buildMessage(fromName, fromEmail, payload)
    await session.send(`${message}\r\n.\r\n`, [250])
    await session.send('QUIT\r\n', [221])
  } finally {
    reader.releaseLock()
    writer.releaseLock()
    await socket.close()
  }
}

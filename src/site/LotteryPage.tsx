import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import type { DrawResult, LotteryStatusResponse } from '../lib/types'

const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript() {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT}"]`,
    )

    if (existing) {
      if (window.turnstile) {
        resolve()
        return
      }

      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Turnstile 脚本加载失败。')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('Turnstile 脚本加载失败。')),
      { once: true },
    )
    document.head.appendChild(script)
  })
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())
}

export function LotteryPage() {
  const [status, setStatus] = useState<LotteryStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<DrawResult | null>(null)
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const widgetRef = useRef<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void refreshStatus()
  }, [])

  useEffect(() => {
    if (!status?.siteKey || !status.isEnabled || status.hasParticipated) {
      return
    }

    let cancelled = false

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !turnstileContainerRef.current || !window.turnstile) {
          return
        }

        turnstileContainerRef.current.innerHTML = ''
        widgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: status.siteKey,
          theme: 'light',
          callback: (token) => {
            setTurnstileToken(token)
            setMessage(null)
          },
          'expired-callback': () => {
            setTurnstileToken(null)
          },
          'error-callback': () => {
            setTurnstileToken(null)
            setMessage('人机校验失败，请刷新后重试。')
          },
        })
        setTurnstileReady(true)
      })
      .catch((error: Error) => {
        setMessage(error.message)
      })

    return () => {
      cancelled = true
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current)
      }
      widgetRef.current = null
      setTurnstileReady(false)
      setTurnstileToken(null)
    }
  }, [status?.hasParticipated, status?.isEnabled, status?.siteKey])

  async function refreshStatus() {
    setLoading(true)

    try {
      const nextStatus = await apiRequest<LotteryStatusResponse>('/api/lottery/status')
      setStatus(nextStatus)
      setResult(nextStatus.lastResult)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态读取失败。')
    } finally {
      setLoading(false)
    }
  }

  async function handleDraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValidEmail(email)) {
      setMessage('请输入有效的邮箱地址，用于接收中奖卡密。')
      return
    }

    if (!turnstileToken) {
      setMessage('请先完成人机校验。')
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const draw = await apiRequest<{
        participantCount: number
        result: DrawResult
      }>('/api/draw', {
        method: 'POST',
        body: JSON.stringify({
          token: turnstileToken,
          email,
        }),
      })

      setResult(draw.result)
      setStatus((current) =>
        current
          ? {
              ...current,
              participantCount: draw.participantCount,
              remainingParticipants:
                current.maxParticipants === null
                  ? null
                  : Math.max(current.maxParticipants - draw.participantCount, 0),
              hasParticipated: true,
              lastResult: draw.result,
              publicPrizes: current.publicPrizes.map((prize) =>
                draw.result.isWin && draw.result.prizeId === prize.id
                  ? {
                      ...prize,
                      winnerCount: prize.winnerCount + 1,
                    }
                  : prize,
              ),
            }
          : current,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '抽奖失败，请稍后再试。')
      if (widgetRef.current && window.turnstile) {
        window.turnstile.reset(widgetRef.current)
        setTurnstileToken(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const drawButtonLabel = useMemo(() => {
    if (!status?.isEnabled) {
      return '活动未开启'
    }

    if (status.hasParticipated) {
      return '已参与'
    }

    if (submitting) {
      return '抽奖中...'
    }

    return '立即抽奖'
  }, [status?.hasParticipated, status?.isEnabled, submitting])

  const limitLabel = useMemo(() => {
    if (!status) {
      return '读取中'
    }

    if (status.maxParticipants === null) {
      return '不限人数'
    }

    return `剩余 ${status.remainingParticipants ?? 0}`
  }, [status])

  return (
    <main className="page shell">
      <section className="hero-panel lottery-hero">
        <div className="hero-copy">
          <span className="eyebrow">Cloudflare Pages 抽奖站</span>
          <h1>星火抽奖站</h1>
          <p className="lead">
            普通用户可以直接参与抽奖，查看各奖项中奖人数。中奖卡密不在页面回显，
            系统会自动发送到你填写的邮箱。
          </p>
          <div className="hero-stats">
            <div className="metric-card">
              <span className="metric-label">当前状态</span>
              <strong>{status?.isEnabled ? '进行中' : '已暂停'}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">真实参与人数</span>
              <strong>{status?.participantCount ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">人数限制</span>
              <strong>{limitLabel}</strong>
            </div>
          </div>
        </div>
        <div className="draw-card">
          <div className="card-header">
            <h2>立即参与</h2>
            <p>每轮每人限参与一次。若中奖，卡密会发送到你填写的邮箱。</p>
          </div>

          {loading ? (
            <div className="empty-block">正在读取活动状态...</div>
          ) : (
            <form className="draw-form" onSubmit={handleDraw}>
              <div className="status-banner">
                {status?.isEnabled
                  ? '活动已开启，填写邮箱并完成校验后即可参与抽奖。'
                  : '抽奖系统当前未开启，请稍后再来。'}
              </div>

              <label className="field">
                <span>接收中奖卡密的邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="请输入常用邮箱"
                />
              </label>

              {status?.siteKey ? (
                <div className="turnstile-block" ref={turnstileContainerRef} />
              ) : (
                <div className="empty-block">
                  站点尚未配置 Turnstile 公钥，暂时无法参与抽奖。
                </div>
              )}

              <button
                className="primary-button"
                disabled={
                  loading
                  || submitting
                  || !status?.isEnabled
                  || status.hasParticipated
                  || !status.siteKey
                  || !turnstileReady
                  || !turnstileToken
                }
                type="submit"
              >
                {drawButtonLabel}
              </button>

              {message ? <p className="inline-error">{message}</p> : null}
            </form>
          )}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="section-title">
            <h2>开放奖项</h2>
            <span>普通用户可以直接看到各奖项当前中奖人数</span>
          </div>
          <div className="prize-grid">
            {status?.publicPrizes.length ? (
              status.publicPrizes.map((prize) => (
                <div className="prize-chip" key={prize.id}>
                  {prize.name} · 已中奖 {prize.winnerCount} 人
                </div>
              ))
            ) : (
              <div className="empty-block">管理员尚未配置可用奖项。</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>我的抽奖结果</h2>
            <span>中奖后卡密会通过邮件发送，不在页面直接显示</span>
          </div>
          {result ? (
            <div className={`result-card ${result.isWin ? 'win' : 'lose'}`}>
              <div className="result-pill">{result.isWin ? '恭喜中奖' : '未中奖'}</div>
              <h3>{result.prizeName ?? '谢谢参与'}</h3>
              <p>{result.message}</p>
              {result.codeValue ? (
                <div className="code-box">
                  <span>中奖卡密</span>
                  <strong>{result.codeValue}</strong>
                </div>
              ) : null}
              <small>抽奖时间：{new Date(result.createdAt).toLocaleString('zh-CN')}</small>
            </div>
          ) : (
            <div className="empty-block">
              你还没有参与抽奖，填写邮箱并完成校验后就能试试手气。
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

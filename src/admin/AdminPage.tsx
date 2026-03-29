import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { apiRequest, apiUpload } from '../lib/api'
import type {
  AdminMeResponse,
  AdminPrize,
  DashboardResponse,
  DrawRecord,
} from '../lib/types'

interface LoginFormState {
  username: string
  password: string
}

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface PrizeDraft {
  id: string
  name: string
  probabilityPercent: string
  winMessage: string
  isActive: boolean
  sortOrder: string
  availableCodes: number
  usedCodes: number
}

const emptyLoginForm: LoginFormState = {
  username: '',
  password: '',
}

const emptyPasswordForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const emptyCreatePrizeForm = {
  name: '',
  probabilityPercent: '0',
  winMessage: '',
  isActive: true,
  sortOrder: '0',
}

function toPrizeDraft(prize: AdminPrize): PrizeDraft {
  return {
    id: prize.id,
    name: prize.name,
    probabilityPercent: String(prize.probabilityPercent),
    winMessage: prize.winMessage,
    isActive: prize.isActive,
    sortOrder: String(prize.sortOrder),
    availableCodes: prize.availableCodes,
    usedCodes: prize.usedCodes,
  }
}

export function AdminPage() {
  const [me, setMe] = useState<AdminMeResponse | null>(null)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [prizes, setPrizes] = useState<PrizeDraft[]>([])
  const [records, setRecords] = useState<DrawRecord[]>([])
  const [loginForm, setLoginForm] = useState<LoginFormState>(emptyLoginForm)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm)
  const [createPrizeForm, setCreatePrizeForm] = useState(emptyCreatePrizeForm)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setLoading(true)
      try {
        const admin = await apiRequest<AdminMeResponse>('/api/admin/me')
        if (!active) {
          return
        }

        setMe(admin)
        if (!admin.mustChangePassword) {
          await loadAdminData()
        }
        setError(null)
      } catch {
        if (!active) {
          return
        }

        setMe(null)
        setDashboard(null)
        setPrizes([])
        setRecords([])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  async function loadAdminData() {
    const [nextDashboard, nextPrizes, nextRecords] = await Promise.all([
      apiRequest<DashboardResponse>('/api/admin/dashboard'),
      apiRequest<AdminPrize[]>('/api/admin/prizes'),
      apiRequest<DrawRecord[]>('/api/admin/draw-records'),
    ])

    setDashboard(nextDashboard)
    setPrizes(nextPrizes.map(toPrizeDraft))
    setRecords(nextRecords)
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const admin = await apiRequest<AdminMeResponse>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      setMe(admin)
      setLoginForm(emptyLoginForm)
      if (!admin.mustChangePassword) {
        await loadAdminData()
      }
      setNotice('登录成功。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      await apiRequest<null>('/api/admin/logout', { method: 'POST' })
      setMe(null)
      setDashboard(null)
      setPrizes([])
      setRecords([])
      setNotice('已退出登录。')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '退出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的新密码不一致。')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const admin = await apiRequest<AdminMeResponse>('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      setMe(admin)
      setPasswordForm(emptyPasswordForm)
      await loadAdminData()
      setNotice('密码已更新。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '密码更新失败。')
    } finally {
      setBusy(false)
    }
  }

  async function refreshAdminData() {
    setBusy(true)
    setError(null)
    try {
      await loadAdminData()
      setNotice('数据已刷新。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '刷新失败。')
    } finally {
      setBusy(false)
    }
  }

  async function toggleLotterySystem() {
    if (!dashboard) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const updated = await apiRequest<DashboardResponse>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ isEnabled: !dashboard.isEnabled }),
      })
      setDashboard(updated)
      setNotice(updated.isEnabled ? '抽奖系统已开启。' : '抽奖系统已关闭。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '系统开关更新失败。')
    } finally {
      setBusy(false)
    }
  }

  async function createPrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await apiRequest<AdminPrize>('/api/admin/prizes', {
        method: 'POST',
        body: JSON.stringify({
          name: createPrizeForm.name,
          probabilityPercent: Number(createPrizeForm.probabilityPercent),
          winMessage: createPrizeForm.winMessage,
          isActive: createPrizeForm.isActive,
          sortOrder: Number(createPrizeForm.sortOrder),
        }),
      })
      setCreatePrizeForm(emptyCreatePrizeForm)
      await loadAdminData()
      setNotice('奖项已创建。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '奖项创建失败。')
    } finally {
      setBusy(false)
    }
  }

  async function savePrize(prize: PrizeDraft) {
    setBusy(true)
    setError(null)

    try {
      await apiRequest<AdminPrize>(`/api/admin/prizes/${prize.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: prize.name,
          probabilityPercent: Number(prize.probabilityPercent),
          winMessage: prize.winMessage,
          isActive: prize.isActive,
          sortOrder: Number(prize.sortOrder),
        }),
      })
      await loadAdminData()
      setNotice(`奖项「${prize.name}」已保存。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '奖项保存失败。')
    } finally {
      setBusy(false)
    }
  }

  async function uploadCodes(prizeId: string) {
    const file = selectedFiles[prizeId]
    if (!file) {
      setError('请先选择一个 txt 或 csv 文件。')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      await apiUpload<{ imported: number; ignored: number }>(
        `/api/admin/prizes/${prizeId}/codes/import`,
        form,
      )
      setSelectedFiles((current) => ({ ...current, [prizeId]: null }))
      await loadAdminData()
      setNotice('卡密上传完成。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '卡密上传失败。')
    } finally {
      setBusy(false)
    }
  }

  function updatePrizeField(
    prizeId: string,
    field: keyof PrizeDraft,
    value: string | boolean,
  ) {
    setPrizes((current) =>
      current.map((item) =>
        item.id === prizeId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

  const activeProbability = useMemo(() => {
    return prizes.reduce((sum, prize) => {
      if (!prize.isActive) {
        return sum
      }

      const value = Number(prize.probabilityPercent)
      return Number.isFinite(value) ? sum + value : sum
    }, 0)
  }, [prizes])

  if (loading) {
    return (
      <main className="page shell">
        <div className="empty-state large">正在加载管理员状态...</div>
      </main>
    )
  }

  if (!me) {
    return (
      <main className="page shell admin-shell">
        <section className="hero-panel admin-hero">
          <div className="hero-copy">
            <span className="eyebrow">/admin</span>
            <h1>管理员后台</h1>
            <p className="lead">
              这里负责抽奖系统开关、奖项概率、中奖卡密导入和中奖记录查询。普通用户无法使用这些能力。
            </p>
          </div>

          <form className="panel auth-panel" onSubmit={handleLogin}>
            <div className="section-title">
              <h2>管理员登录</h2>
              <span>首次部署请使用环境变量中的默认账号登录</span>
            </div>
            <label className="field">
              <span>账号</span>
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="请输入管理员账号"
                type="text"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="请输入管理员密码"
                type="password"
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? '登录中...' : '登录后台'}
            </button>
            {error ? <p className="inline-error">{error}</p> : null}
            {notice ? <p className="inline-note">{notice}</p> : null}
          </form>
        </section>
      </main>
    )
  }

  if (me.mustChangePassword) {
    return (
      <main className="page shell admin-shell">
        <section className="hero-panel admin-hero">
          <div className="hero-copy">
            <span className="eyebrow">首次登录安全步骤</span>
            <h1>请先修改默认管理员密码</h1>
            <p className="lead">
              默认账号仅用于首次进入后台。完成改密后，才允许继续管理抽奖系统。
            </p>
          </div>
          <form className="panel auth-panel" onSubmit={handlePasswordChange}>
            <div className="section-title">
              <h2>修改密码</h2>
              <span>当前登录账号：{me.username}</span>
            </div>
            <label className="field">
              <span>当前密码</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>新密码</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>确认新密码</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? '提交中...' : '保存新密码'}
            </button>
            {error ? <p className="inline-error">{error}</p> : null}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="page shell admin-shell">
      <section className="hero-panel admin-hero compact">
        <div className="hero-copy">
          <span className="eyebrow">欢迎回来，{me.username}</span>
          <h1>抽奖系统后台</h1>
          <p className="lead">
            在这里你可以开启或暂停抽奖活动，维护奖项概率，上传中奖卡密，并查看最新中奖记录。
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" disabled={busy} onClick={() => void refreshAdminData()}>
            刷新数据
          </button>
          <button className="secondary-button" disabled={busy} onClick={() => void handleLogout()}>
            退出登录
          </button>
        </div>
      </section>

      {error ? <p className="banner error">{error}</p> : null}
      {notice ? <p className="banner success">{notice}</p> : null}

      <section className="content-grid admin-grid">
        <article className="panel">
          <div className="section-title">
            <h2>系统总览</h2>
            <span>参与人数为真实累计值</span>
          </div>
          <div className="metric-row">
            <div className="metric-card">
              <span className="metric-label">系统状态</span>
              <strong>{dashboard?.isEnabled ? '已开启' : '已关闭'}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">参与人数</span>
              <strong>{dashboard?.participantCount ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">中奖人数</span>
              <strong>{dashboard?.winnerCount ?? 0}</strong>
            </div>
          </div>
          <button className="primary-button" disabled={busy} onClick={() => void toggleLotterySystem()}>
            {dashboard?.isEnabled ? '关闭抽奖系统' : '开启抽奖系统'}
          </button>
          <p className="inline-note">
            当前启用奖项的概率总和：{activeProbability.toFixed(2)}%
          </p>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>新增奖项</h2>
            <span>剩余概率自动视为未中奖</span>
          </div>
          <form className="stack-form" onSubmit={createPrize}>
            <label className="field">
              <span>奖项名称</span>
              <input
                value={createPrizeForm.name}
                onChange={(event) =>
                  setCreatePrizeForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                type="text"
              />
            </label>
            <label className="field">
              <span>中奖概率（%）</span>
              <input
                value={createPrizeForm.probabilityPercent}
                onChange={(event) =>
                  setCreatePrizeForm((current) => ({
                    ...current,
                    probabilityPercent: event.target.value,
                  }))
                }
                min="0"
                max="100"
                step="0.01"
                type="number"
              />
            </label>
            <label className="field">
              <span>中奖文案</span>
              <textarea
                value={createPrizeForm.winMessage}
                onChange={(event) =>
                  setCreatePrizeForm((current) => ({
                    ...current,
                    winMessage: event.target.value,
                  }))
                }
              />
            </label>
            <div className="inline-fields">
              <label className="field">
                <span>排序</span>
                <input
                  value={createPrizeForm.sortOrder}
                  onChange={(event) =>
                    setCreatePrizeForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  type="number"
                />
              </label>
              <label className="toggle-field">
                <input
                  checked={createPrizeForm.isActive}
                  onChange={(event) =>
                    setCreatePrizeForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>创建后立即启用</span>
              </label>
            </div>
            <button className="primary-button" disabled={busy} type="submit">
              创建奖项
            </button>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>奖项与卡密</h2>
          <span>每个奖项独立维护概率、文案和卡密池</span>
        </div>
        <div className="table-grid">
          <div className="table-head table-row">
            <span>奖项</span>
            <span>概率</span>
            <span>文案</span>
            <span>状态</span>
            <span>卡密</span>
            <span>操作</span>
          </div>
          {prizes.length ? (
            prizes.map((prize) => (
              <div className="table-row editable-row" key={prize.id}>
                <div className="cell-stack">
                  <input
                    value={prize.name}
                    onChange={(event) =>
                      updatePrizeField(prize.id, 'name', event.target.value)
                    }
                    type="text"
                  />
                  <small>排序：{prize.sortOrder}</small>
                </div>
                <input
                  value={prize.probabilityPercent}
                  onChange={(event) =>
                    updatePrizeField(prize.id, 'probabilityPercent', event.target.value)
                  }
                  max="100"
                  min="0"
                  step="0.01"
                  type="number"
                />
                <textarea
                  value={prize.winMessage}
                  onChange={(event) =>
                    updatePrizeField(prize.id, 'winMessage', event.target.value)
                  }
                />
                <div className="cell-stack">
                  <label className="toggle-field">
                    <input
                      checked={prize.isActive}
                      onChange={(event) =>
                        updatePrizeField(prize.id, 'isActive', event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>{prize.isActive ? '启用中' : '已停用'}</span>
                  </label>
                  <input
                    value={prize.sortOrder}
                    onChange={(event) =>
                      updatePrizeField(prize.id, 'sortOrder', event.target.value)
                    }
                    type="number"
                  />
                </div>
                <div className="cell-stack">
                  <strong>剩余 {prize.availableCodes}</strong>
                  <small>已发放 {prize.usedCodes}</small>
                  <input
                    accept=".txt,.csv,text/plain,text/csv"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const file = event.target.files?.[0] ?? null
                      setSelectedFiles((current) => ({
                        ...current,
                        [prize.id]: file,
                      }))
                    }}
                    type="file"
                  />
                </div>
                <div className="cell-stack">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void savePrize(prize)}
                    type="button"
                  >
                    保存奖项
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void uploadCodes(prize.id)}
                    type="button"
                  >
                    上传卡密
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-block">还没有配置任何奖项。</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>最新抽奖记录</h2>
          <span>仅管理员可查看中奖卡密与结果详情</span>
        </div>
        <div className="table-grid records-grid">
          <div className="table-head table-row">
            <span>时间</span>
            <span>结果</span>
            <span>奖项</span>
            <span>卡密</span>
            <span>参与标识</span>
            <span>展示文案</span>
          </div>
          {records.length ? (
            records.map((record) => (
              <div className="table-row" key={record.id}>
                <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                <span>{record.isWin ? '中奖' : '未中奖'}</span>
                <span>{record.prizeName ?? '谢谢参与'}</span>
                <span>{record.codeValue ?? '-'}</span>
                <span className="mono">{record.participantHash.slice(0, 12)}...</span>
                <span>{record.shownMessage}</span>
              </div>
            ))
          ) : (
            <div className="empty-block">暂时还没有抽奖记录。</div>
          )}
        </div>
      </section>
    </main>
  )
}

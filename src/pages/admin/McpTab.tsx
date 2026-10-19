// ТЗ-185 Задача 4: таба «МСП» в админке — реестр MCP-токенов платформы.
// Сводка (активные/запросы/отзывы за 30 дней/истекающие), таблица с
// серверным поиском/фильтром/сортировкой (состояние — в query-параметрах,
// чтобы шарить ссылку), принудительный отзыв токена через модалку подтверждения.
// Значение токена бэкенд не отдаёт — виден только prefix.
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { adminApi } from '@/lib/api'
import { RefreshCw, Search, X, KeyRound, Trash2 } from 'lucide-react'

interface McpToken {
  token_id: string
  user: { id: string; username: string; email: string }
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  requests_count: number
  status: 'active' | 'revoked' | 'expired'
}

type SortKey = 'created_at' | 'last_used_at' | 'requests_count'
type Dir = 'asc' | 'desc'

const SORT_KEYS: SortKey[] = ['created_at', 'last_used_at', 'requests_count']
const STATUS_OPTIONS = ['active', 'revoked', 'expired'] as const

const STATUS_STYLE: Record<McpToken['status'], { color: string; bg: string; label: string }> = {
  active: { color: '#34D399', bg: '#34D39922', label: 'active' },
  expired: { color: '#9CA3AF', bg: '#9CA3AF22', label: 'expired' },
  revoked: { color: '#EF4444', bg: '#EF444422', label: 'revoked' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function McpTab() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') || ''
  const statusParam = searchParams.get('status') || ''
  const status = (STATUS_OPTIONS as readonly string[]).includes(statusParam) ? statusParam : ''
  const sortParam = searchParams.get('sort') || 'created_at'
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortParam) ? (sortParam as SortKey) : 'created_at'
  const dir: Dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  const [tokens, setTokens] = useState<McpToken[]>([])
  // Нефильтрованная выдача для сводки: фильтры таблицы не должны искажать
  // счётчики сверху (эндпоинт сводки отдельный не предусмотрен — ТЗ-185).
  const [summaryTokens, setSummaryTokens] = useState<McpToken[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Модалка подтверждения отзыва
  const [confirmToken, setConfirmToken] = useState<McpToken | null>(null)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      params.set('sort', sort)
      params.set('dir', dir)
      const data = await adminApi.get(`/api/admin/mcp/tokens?${params.toString()}`)
      setTokens(data.tokens || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('MCP tokens load error:', err)
    } finally {
      setLoading(false)
    }
  }, [q, status, sort, dir])

  const loadSummary = useCallback(async () => {
    try {
      const data = await adminApi.get('/api/admin/mcp/tokens')
      setSummaryTokens(data.tokens || [])
    } catch (err) {
      console.error('MCP tokens summary load error:', err)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const patchToken = (tokenId: string, patch: Partial<McpToken>) => {
    setTokens(prev => prev.map(t => t.token_id === tokenId ? { ...t, ...patch } : t))
    setSummaryTokens(prev => prev.map(t => t.token_id === tokenId ? { ...t, ...patch } : t))
  }

  const handleRevoke = async () => {
    if (!confirmToken) return
    setRevoking(true)
    try {
      const data = await adminApi.post(`/api/admin/mcp/tokens/${confirmToken.token_id}/revoke`, {})
      // Идемпотентен на бэке: повторный revoke тоже 200 — локально просто помечаем.
      patchToken(confirmToken.token_id, {
        status: 'revoked',
        revoked_at: data?.token?.revoked_at || new Date().toISOString(),
        revoked_by: data?.token?.revoked_by || '',
      })
      setConfirmToken(null)
    } catch (err: any) {
      alert(err.message || 'Не удалось отозвать токен')
    } finally {
      setRevoking(false)
    }
  }

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setSearchParams(next)
  }

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      updateParams({ dir: dir === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: key, dir: 'desc' })
    }
  }

  // ── Сводка (считается на клиенте из нефильтрованной выдачи) ──────────
  const activeTokens = summaryTokens.filter(t => t.status === 'active')
  const totalActive = activeTokens.length
  const totalRequests = activeTokens.reduce((s, t) => s + t.requests_count, 0)
  const now = Date.now()
  const revoked30d = summaryTokens.filter(
    t => t.revoked_at && now - new Date(t.revoked_at).getTime() < 30 * 86400000,
  ).length
  const expiring7d = activeTokens.filter(t => {
    if (!t.expires_at) return false
    const exp = new Date(t.expires_at).getTime()
    return exp > now && exp - now < 7 * 86400000
  }).length

  const summaryTiles = [
    { label: 'Активных токенов', value: totalActive, color: '#34D399' },
    { label: 'Запросов (активные)', value: totalRequests, color: '#00D4FF' },
    { label: 'Отозвано за 30 дней', value: revoked30d, color: '#EF4444' },
    { label: 'Истекает за 7 дней', value: expiring7d, color: '#F59E0B' },
  ]

  const hasFilters = Boolean(q) || Boolean(status)

  const sortHeader = (label: string, key: SortKey, right = false) => (
    <button
      onClick={() => handleSort(key)}
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider w-full inline-flex items-center gap-1 transition-colors hover:text-[#9CA3AF] ${right ? 'justify-end' : ''}`}
      style={{ color: sort === key ? '#00D4FF' : '#6B7280' }}
    >
      {label}
      {sort === key && <span>{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )

  if (loading && tokens.length === 0 && summaryTokens.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
        <span className="text-sm" style={{ color: '#9CA3AF' }}>Загрузка MCP-токенов...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Описание табы */}
      <p className="text-sm mb-4" style={{ color: '#9CA3AF' }}>
        Реестр MCP-токенов платформы: метрики использования и принудительный отзыв доступа.
        Значение токена не хранится и не отображается — только префикс.
      </p>

      {/* ─── Сводка ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryTiles.map(tile => (
          <div
            key={tile.label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: '#0a0a0a', borderColor: '#222222' }}
          >
            <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{tile.label}</p>
            <p className="text-2xl font-semibold font-mono" style={{ color: tile.color }}>{tile.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Поиск + фильтр + обновление ────────────────────────── */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7280' }} />
          <input
            type="text"
            placeholder="Поиск: username, email или имя токена..."
            value={q}
            onChange={e => updateParams({ q: e.target.value })}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:border-[#444444]"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#FFFFFF' }}
          />
          {q && (
            <button
              onClick={() => updateParams({ q: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[#222222]"
              style={{ color: '#6B7280' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={e => updateParams({ status: e.target.value })}
          className="px-3 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:border-[#444444]"
          style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#E5E7EB' }}
          aria-label="Фильтр по статусу"
        >
          <option value="">Все статусы</option>
          <option value="active">active</option>
          <option value="revoked">revoked</option>
          <option value="expired">expired</option>
        </select>
        <div className="flex items-center gap-3 ml-auto">
          {lastRefresh && (
            <span className="text-xs" style={{ color: '#6B7280' }}>
              Обновлено: {formatDate(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={() => { load(); loadSummary() }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {/* ─── Таблица ────────────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Токен</th>
                <th>{sortHeader('Выпущен', 'created_at')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Истекает</th>
                <th>{sortHeader('Последнее обращение', 'last_used_at')}</th>
                <th>{sortHeader('Запросов', 'requests_count', true)}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    {!hasFilters
                      ? 'Токенов пока нет'
                      : q
                        ? `Ничего не найдено по запросу «${q}»`
                        : status === 'active'
                          ? 'Нет активных токенов'
                          : `Нет токенов со статусом «${status}»`}
                  </td>
                </tr>
              )}
              {tokens.map((t) => {
                const st = STATUS_STYLE[t.status]
                return (
                  <tr key={t.token_id} className="transition-colors hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{t.user.username}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{t.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm" style={{ color: '#E5E7EB' }}>{t.name}</p>
                      <p className="text-xs font-mono" style={{ color: '#6B7280' }}>{t.prefix}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(t.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(t.expires_at)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(t.last_used_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>{t.requests_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        data-status={t.status}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === 'active' ? (
                        <button
                          onClick={() => setConfirmToken(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:border-[#EF4444]"
                          style={{ backgroundColor: '#111111', borderColor: '#EF444433', color: '#EF4444' }}
                        >
                          <Trash2 size={12} />
                          Отозвать
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: '#6B7280' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Модалка подтверждения отзыва ───────────────────────── */}
      {confirmToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => !revoking && setConfirmToken(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border p-6"
            style={{ backgroundColor: '#0a0a0a', borderColor: '#222222' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF444422' }}>
                <KeyRound size={18} style={{ color: '#EF4444' }} />
              </div>
              <h3 className="text-base font-semibold" style={{ color: '#FFFFFF' }}>Отозвать токен?</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
              Отозвать токен «{confirmToken.name}» у {confirmToken.user.email}?
              Клиент с этим токеном сразу потеряет доступ.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmToken(null)}
                disabled={revoking}
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#444444] disabled:opacity-50"
                style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
              >
                Отмена
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
              >
                {revoking ? 'Отзываем...' : 'Отозвать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import GlassCard from '@/components/GlassCard'
import { Key, Plus, Copy, Terminal, AlertTriangle, Shield, Check } from 'lucide-react'

/* =============================================================================
   ТЗ-183 Задача 4 — секция «API / MCP» в личном кабинете.
   Управление MCP-токенами: список, выпуск (единоразовый показ токена),
   отзыв, инструкция подключения MCP-клиента (Claude Desktop / Cursor).
   ============================================================================= */

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface McpToken {
  id: string
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
  status: 'active' | 'revoked' | 'expired'
}

interface McpTokensData {
  tokens: McpToken[]
  max_active: number
  ttl_days: number
}

// Готовый сниппет конфига MCP-клиента (ТЗ-183, блок «Подключение»).
const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "pulse": {
      "url": "https://pulse.inside-trade.ru/mcp",
      "headers": {
        "Authorization": "Bearer <ВАШ_ТОКЕН>"
      }
    }
  }
}`

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

// Истёкшим считаем и токен с просроченным expires_at (бэк мог ещё не перевести статус).
function isTokenExpired(t: McpToken): boolean {
  return t.status === 'expired' || (!!t.expires_at && new Date(t.expires_at).getTime() < Date.now())
}

// ТЗ-183: активные — первыми, затем истёкшие, отозванные — внизу списка.
function sortTokens(tokens: McpToken[]): McpToken[] {
  const rank = (t: McpToken) => (t.status === 'revoked' ? 2 : isTokenExpired(t) ? 1 : 0)
  return [...tokens].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Активен', color: '#34D399' },
  expired: { label: 'Истёк', color: '#F59E0B' },
  revoked: { label: 'Отозван', color: '#6B7280' },
}

export default function McpTokensTab() {
  const { user } = useAuth()
  const [data, setData] = useState<McpTokensData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // Полный токен бэк отдаёт один раз (ТЗ-183) — храним только до закрытия модалки.
  const [created, setCreated] = useState<{ name: string; token: string; expires_at: string } | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  const loadTokens = useCallback(async () => {
    try {
      const d = await api.get('/user/mcp-tokens')
      setData(d)
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err.message || 'Не удалось загрузить токены')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  const activeCount = (data?.tokens ?? []).filter(t => t.status === 'active' && !isTokenExpired(t)).length
  const maxActive = data?.max_active ?? 5
  const ttlDays = data?.ttl_days ?? 180

  const openCreateModal = () => {
    setCreated(null)
    setName('')
    setCreateError(null)
    setCopiedToken(false)
    setShowCreate(true)
  }

  const closeCreateModal = () => {
    setShowCreate(false)
    setCreated(null)
    setCreateError(null)
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 64) {
      setCreateError('Название должно быть от 1 до 64 символов')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const d = await api.post('/user/mcp-tokens', { name: trimmed })
      // ТЗ-183: полный токен показываем ЕДИНСТВЕННЫЙ раз — здесь и нигде больше.
      setCreated({ name: d.name, token: d.token, expires_at: d.expires_at })
      await loadTokens()
    } catch (err: any) {
      // 409 «превышен лимит активных токенов» и прочие ошибки — текст из поля error бэка.
      setCreateError(err.message || 'Не удалось создать токен')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    setRevoking(true)
    try {
      await api.delete(`/user/mcp-tokens/${id}`)
      setConfirmRevokeId(null)
      await loadTokens()
    } catch (err: any) {
      setLoadError(err.message || 'Не удалось отозвать токен')
    } finally {
      setRevoking(false)
    }
  }

  const copyText = (text: string, done: () => void) => {
    if (!navigator.clipboard?.writeText) return
    navigator.clipboard.writeText(text).then(done).catch(() => {})
  }

  return (
    <motion.div
      key="mcp"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: easeOutExpo }}
      className="space-y-6"
    >
      {/* ТЗ-183, пункт 4: оговорка для администраторов (scopes выдаются автоматически). */}
      {user?.isAdmin && (
        <div
          className="rounded-xl p-4 flex items-start gap-3 text-[12px] leading-relaxed"
          style={{ background: 'rgba(167, 139, 250, 0.05)', border: '1px solid rgba(167, 139, 250, 0.2)', color: '#9CA3AF' }}
        >
          <Shield size={16} className="shrink-0 mt-0.5" style={{ color: '#A78BFA' }} />
          <span>
            Администраторские инструменты (статистика образования, метрики) доступны по этому токену
            автоматически; управляющие функции появятся позже.
          </span>
        </div>
      )}

      {/* ====== Список токенов ====== */}
      <GlassCard accentColor="#00D4FF">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.15)' }}
          >
            <Key size={18} style={{ color: '#00D4FF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">MCP-токены</h3>
            <p className="text-xs text-[#6B7280]">Доступ ИИ-агентов к данным PULSE</p>
          </div>
          <span className="text-xs text-[#6B7280]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {activeCount} / {maxActive} активных
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse mb-5">
            <div className="h-16 rounded-xl bg-white/5" />
            <div className="h-16 rounded-xl bg-white/5" />
          </div>
        ) : loadError && !data ? (
          <div className="text-center py-6 mb-5">
            <p className="text-[#9CA3AF] text-sm mb-3">{loadError}</p>
            <button
              onClick={() => { setLoading(true); loadTokens() }}
              className="h-9 px-4 rounded-xl text-xs font-medium text-[#9CA3AF] border border-[#222] hover:bg-[#222] transition-colors"
            >
              Повторить
            </button>
          </div>
        ) : !data || data.tokens.length === 0 ? (
          <p className="text-[#6B7280] text-sm mb-5">Токенов нет. Создайте первый токен, чтобы подключить ИИ-агента.</p>
        ) : (
          <div className="space-y-2.5 mb-5">
            {sortTokens(data.tokens).map(t => {
              const meta = STATUS_META[t.status] ?? STATUS_META.active
              const active = t.status === 'active' && !isTokenExpired(t)
              return (
                <div
                  key={t.id}
                  className="px-4 py-3.5 rounded-xl transition-colors hover:border-[#2a2a2a]"
                  style={{
                    background: '#0A0A0A',
                    border: '1px solid #1a1a1a',
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-center flex-wrap gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-white">{t.name}</span>
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: meta.color,
                            background: `${meta.color}1A`,
                            border: `1px solid ${meta.color}44`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#6B7280] mt-1 space-x-2">
                        <code className="font-mono text-[#9CA3AF]">{t.prefix}…</code>
                        <span>· создан {fmtDate(t.created_at)}</span>
                        {/* ТЗ-183, ИБ-1: срок действия токена всегда виден в списке. */}
                        <span>· истекает {fmtDate(t.expires_at)}</span>
                        <span>· использовался: {t.last_used_at ? fmtDate(t.last_used_at) : 'никогда'}</span>
                      </div>
                    </div>
                    {active && (
                      <button
                        onClick={() => setConfirmRevokeId(t.id)}
                        className="h-8 px-3 rounded-lg border border-[#222] text-xs text-[#9CA3AF] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                      >
                        Отозвать
                      </button>
                    )}
                  </div>

                  {/* Подтверждение отзыва — инлайн-паттерн DeleteKeyConfirm (ТЗ-183). */}
                  {confirmRevokeId === t.id && (
                    <div
                      className="flex items-center flex-wrap gap-3 w-full mt-3 px-3 py-2.5 rounded-[10px] text-[12px]"
                      style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5' }}
                    >
                      <span className="flex-1">Отозвать токен «{t.name}»? Действие необратимо — агент с этим токеном сразу потеряет доступ.</span>
                      <button
                        onClick={() => handleRevoke(t.id)}
                        disabled={revoking}
                        className="h-7 px-3 rounded-lg text-[11px] font-bold text-white bg-[#EF4444] hover:bg-[#f87171] transition-colors disabled:opacity-50"
                      >
                        {revoking ? 'Отзыв…' : 'Отозвать токен'}
                      </button>
                      <button
                        onClick={() => setConfirmRevokeId(null)}
                        className="h-7 px-3 rounded-lg text-[11px] font-bold text-[#9CA3AF] bg-[#222] hover:bg-[#333] transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
        >
          <Plus size={16} />
          Создать токен
        </button>
        <p className="text-[10px] text-[#6B7280] mt-3">
          Максимум {maxActive} активных токенов · срок жизни {ttlDays} дней.
        </p>
      </GlassCard>

      {/* ====== Инструкция подключения ====== */}
      <GlassCard accentColor="#34D399">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}
          >
            <Terminal size={18} style={{ color: '#34D399' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Подключение MCP-клиента</h3>
            <p className="text-xs text-[#6B7280]">Claude Desktop / Cursor — добавьте блок в конфиг</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <pre
            className="flex-1 rounded-xl px-3 py-2.5 text-[12px] text-[#9CA3AF] font-mono overflow-x-auto m-0"
            style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          >
{MCP_CONFIG_SNIPPET}
          </pre>
          <button
            onClick={() => copyText(MCP_CONFIG_SNIPPET, () => {
              setCopiedSnippet(true)
              setTimeout(() => setCopiedSnippet(false), 2000)
            })}
            className="h-10 px-3 rounded-xl text-xs text-[#9CA3AF] hover:text-white transition-colors shrink-0 self-start"
            style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
          >
            {copiedSnippet ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {/* ТЗ-183, ИБ-6: предупреждение об обращении с токеном. */}
        <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Токен — это ключ к вашим данным. Не коммитьте его в репозитории, не пересылайте и не
            публикуйте. При утечке отзовите токен и создайте новый.
          </span>
        </div>
      </GlassCard>

      {/* ====== Модалка создания токена ====== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70">
          <div className="w-full max-w-md rounded-2xl border border-[#222] bg-[#111] p-6">
            {!created ? (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Создать MCP-токен</h3>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  Назовите токен, чтобы отличать его от других (например, «Claude Desktop»).
                </p>
                <label className="text-[#9CA3AF] text-sm mb-2 block">Название</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !creating) handleCreate() }}
                  placeholder="Мой агент"
                  maxLength={64}
                  autoFocus
                  className="w-full rounded-xl px-4 py-2.5 mb-1 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#00D4FF]"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                />
                <p className="text-[10px] text-[#6B7280] mb-3">От 1 до 64 символов</p>

                {createError && (
                  <p className="text-xs rounded-xl p-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5' }}>
                    {createError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeCreateModal}
                    className="flex-1 h-11 rounded-xl border border-[#222] text-sm font-medium text-[#9CA3AF] hover:bg-[#222] transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                  >
                    {creating ? 'Создание…' : 'Создать'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Токен «{created.name}» создан</h3>

                {/* ТЗ-183: единственный показ полного токена + честное предупреждение. */}
                <div className="flex items-start gap-2 text-xs rounded-xl p-3 mb-4" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Сохраните токен сейчас — после закрытия этого окна он больше не отобразится.</span>
                </div>

                <div className="flex gap-2 mb-3">
                  <code className="flex-1 rounded-xl px-3 py-2.5 text-[12px] text-[#9CA3AF] font-mono break-all" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    {created.token}
                  </code>
                  <button
                    onClick={() => copyText(created.token, () => {
                      setCopiedToken(true)
                      setTimeout(() => setCopiedToken(false), 2000)
                    })}
                    className="h-10 px-3 rounded-xl text-xs text-[#9CA3AF] hover:text-white transition-colors shrink-0 self-start inline-flex items-center gap-1"
                    style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                  >
                    {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                    Копировать
                  </button>
                </div>

                <p className="text-xs text-[#6B7280] mb-4">
                  Срок жизни токена — {ttlDays} дней (до {fmtDate(created.expires_at)}).
                </p>

                <button
                  onClick={closeCreateModal}
                  className="w-full h-11 rounded-xl text-sm font-semibold transition-all hover:brightness-115"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                >
                  Готово
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

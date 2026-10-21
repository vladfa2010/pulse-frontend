import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Loader2, MoreVertical, Plus, RefreshCw, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import GlassModal, { GradientButton, ModalActions, ModalInput } from '@/components/GlassModal'
import PremiumPromptModal from '@/components/PremiumPromptModal'
import SentimentBar from '@/components/adviser/SentimentBar'
import { useAdvisorEvents } from '@/components/adviser/useAdvisorEvents'
import {
  ALLOWED_SLOTS,
  LIGHT_SLOTS,
  TAG_TYPE_COLORS,
  formatEventDate,
  formatEventDistance,
  formatMskTime,
  parseClientsResponse,
  parseSummariesResponse,
  type AdvisorClient,
  type AdvisorEventItem,
  type AdvisorSchedule,
  type AdvisorSummaryEntry,
} from '@/components/adviser/adviserTypes'

// Анти-спам зеркало серверного rate limit 1 запрос / 5 минут на клиента (ТЗ-182 v4)
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000
const REFRESH_HINT = 'не чаще 1 раза в 5 минут'

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #222222',
  borderRadius: 16,
}

// ─── Модал «Расписание обновлений» ──────────────────────────────────────────
function ScheduleModal({
  open,
  onClose,
  schedule,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  schedule: AdvisorSchedule | null
  onSaved: (schedule: AdvisorSchedule) => void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelected(schedule?.slots ?? [])
      setError(null)
    }
  }, [open, schedule])

  const toggle = (h: number) => {
    setSelected(prev =>
      prev.includes(h) ? prev.filter(v => v !== h) : prev.length >= 2 ? [...prev.slice(1), h] : [...prev, h],
    )
  }

  const save = async () => {
    if (!selected.length || saving) return
    setSaving(true)
    setError(null)
    try {
      const data = await api.patch('/advisor/summaries/schedule', { slots: [...selected].sort((a, b) => a - b) })
      // Оптимистичное обновление стрипа: сервер вернёт schedule, при расхождении формы —
      // используем отправленные слоты, следующий refetch выровняет остальное.
      const s = data?.schedule && typeof data.schedule === 'object' ? data.schedule : data
      onSaved({
        slots: [...selected].sort((a, b) => a - b),
        last_run_at: typeof s?.last_run_at === 'string' ? s.last_run_at : schedule?.last_run_at ?? null,
        next_run_at: typeof s?.next_run_at === 'string' ? s.next_run_at : schedule?.next_run_at ?? null,
      })
      onClose()
    } catch (err: any) {
      if (err?.status === 400 && err?.data?.error === 'invalid_slots') {
        setError('Выберите 1–2 различных часа из разрешённого набора.')
      } else {
        setError(err?.message || 'Не удалось сохранить расписание.')
      }
    } finally {
      setSaving(false)
    }
  }

  const rowDay = ALLOWED_SLOTS.filter(h => h <= 13)
  const rowEvening = ALLOWED_SLOTS.filter(h => h >= 17)

  const chip = (h: number) => (
    <button
      key={h}
      onClick={() => toggle(h)}
      className="focusable relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors"
      style={{
        backgroundColor: selected.includes(h) ? 'rgba(0,212,255,0.15)' : '#161616',
        border: `1px solid ${selected.includes(h) ? '#00D4FF' : '#222222'}`,
        color: selected.includes(h) ? '#00D4FF' : '#9CA3AF',
      }}
    >
      {/* Зелёная точка — статичный список менее загруженных часов (LIGHT_SLOTS, см. adviserTypes) */}
      {LIGHT_SLOTS.includes(h) && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} title="Менее загруженный час" />
      )}
      {String(h).padStart(2, '0')}:00
    </button>
  )

  return (
    <GlassModal open={open} onClose={onClose} title="Расписание обновлений">
      <p className="text-[12px] leading-relaxed mb-4" style={{ color: '#6B7280' }}>
        Саммари считаются в фоне 2 раза в день, время московское. Выберите 1–2 часа.
        Зелёная точка — менее загруженные часы.
      </p>
      <div className="flex flex-wrap gap-2 mb-2">{rowDay.map(chip)}</div>
      <div className="flex flex-wrap gap-2 mb-4">{rowEvening.map(chip)}</div>
      {error && <p className="text-[12px] mb-3" style={{ color: '#EF4444' }}>{error}</p>}
      <ModalActions>
        <GradientButton onClick={save} disabled={!selected.length || saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </GradientButton>
      </ModalActions>
    </GlassModal>
  )
}

// ─── Модал «Новый клиент» ───────────────────────────────────────────────────
function NewClientModal({
  open,
  onClose,
  existingNames,
  nextRunAt,
  onCreated,
  onLimitReached,
}: {
  open: boolean
  onClose: () => void
  existingNames: string[]
  nextRunAt: string | null
  onCreated: (id: number) => void
  onLimitReached: () => void
}) {
  const [name, setName] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [suggestions, setSuggestions] = useState<{ name: string; type: string | null }[]>([])
  const [addedTags, setAddedTags] = useState<{ name: string; type: string | null }[]>([])
  const [creating, setCreating] = useState(false)
  const [tagLimit, setTagLimit] = useState<number | null>(null)
  const [tagError, setTagError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setTagInput('')
      setSuggestions([])
      setAddedTags([])
      setTagLimit(null)
      setTagError(null)
      setError(null)
      setCreating(false)
    }
  }, [open])

  // Автоподсказки тегов — существующий эндпоинт реестра (read-only)
  useEffect(() => {
    const q = tagInput.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/tags/search?q=${encodeURIComponent(q)}`)
        const tags = Array.isArray(data?.tags) ? data.tags : []
        setSuggestions(
          tags
            .map((t: any) => ({ name: String(t.tag_name ?? ''), type: (t.tag_type as string | null) ?? null }))
            .filter((t: { name: string }) => t.name && !addedTags.some(a => a.name.toLowerCase() === t.name.toLowerCase()))
            .slice(0, 6),
        )
      } catch {
        setSuggestions([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [tagInput, addedTags])

  const trimmed = name.trim()
  const nameValid = trimmed.length >= 1 && trimmed.length <= 100
  const isDuplicate = nameValid && existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())

  const addTag = (tag: { name: string; type: string | null }) => {
    const t = tag.name.trim()
    if (!t) return
    if (addedTags.some(a => a.name.toLowerCase() === t.toLowerCase())) return
    setAddedTags(prev => [...prev, { name: t, type: tag.type }])
    setTagInput('')
    setSuggestions([])
  }

  const create = async () => {
    if (!nameValid || creating) return
    setCreating(true)
    setError(null)
    try {
      const data = await api.post('/advisor/clients', { name: trimmed })
      const clientId = typeof data?.id === 'number' ? data.id : typeof data?.client?.id === 'number' ? data.client.id : null
      if (clientId === null) throw new Error('Бэкенд не вернул id клиента')
      // Стартовые теги — последовательно, эндпоинтом тегов модуля
      for (const tag of addedTags) {
        try {
          await api.post(`/advisor/clients/${clientId}/tags`, { tag_name: tag.name })
        } catch (err: any) {
          if (err?.status === 403 && err?.data?.error === 'tag_limit_reached') {
            setTagLimit(typeof err.data.limit === 'number' ? err.data.limit : null)
            setTagError('Достигнут лимит тегов на клиента — остальные теги не добавлены.')
            break
          }
          setTagError(`Не удалось добавить тег «${tag.name}»`)
        }
      }
      onCreated(clientId)
      onClose()
    } catch (err: any) {
      if (err?.status === 403 && err?.data?.error === 'advisor_limit_reached') {
        onLimitReached()
        onClose()
        return
      }
      setError(err?.message || 'Не удалось создать клиента.')
    } finally {
      setCreating(false)
    }
  }

  const nextRunText = formatMskTime(nextRunAt)

  return (
    <GlassModal open={open} onClose={onClose} title="Новый клиент">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">Имя клиента</label>
      <ModalInput value={name} onChange={setName} placeholder="Например: Иван Петров" />
      {isDuplicate && (
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#FBBF24' }}>
          Клиент с таким именем уже есть — дубли пока допустимы, жёсткая уникальность в backlog (ТЗ-182 §6).
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280]">Теги (можно пропустить)</label>
          <span className="text-[10px]" style={{ color: '#6B7280' }}>
            Тегов: {addedTags.length}{tagLimit !== null ? ` из ${tagLimit}` : ''}
          </span>
        </div>
        <ModalInput
          value={tagInput}
          onChange={setTagInput}
          placeholder="Найти или добавить тег… Enter — произвольный"
        />
        {suggestions.length > 0 && (
          <div
            className="mt-1.5 rounded-[10px] overflow-hidden"
            style={{ background: '#161616', border: '1px solid #222' }}
          >
            {suggestions.map(s => (
              <button
                key={s.name}
                onClick={() => addTag(s)}
                className="focusable w-full text-left px-3 py-2 text-[13px] text-[#D1D5DB] hover:bg-white/5 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {addedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {addedTags.map(t => (
              <button
                key={t.name}
                onClick={() => setAddedTags(prev => prev.filter(a => a !== t))}
                className="focusable px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{
                  backgroundColor: `${TAG_TYPE_COLORS[t.type ?? ''] ?? '#6B7280'}15`,
                  border: `1px solid ${TAG_TYPE_COLORS[t.type ?? ''] ?? '#6B7280'}40`,
                  color: TAG_TYPE_COLORS[t.type ?? ''] ?? '#9CA3AF',
                }}
                title="Нажмите, чтобы убрать"
              >
                {t.name} ×
              </button>
            ))}
          </div>
        )}
        {tagError && <p className="text-[11px] mt-1.5" style={{ color: '#FBBF24' }}>{tagError}</p>}
      </div>

      <p className="text-[11px] mt-4 leading-relaxed" style={{ color: '#6B7280' }}>
        Первое саммари появится после ближайшего обновления{nextRunText ? ` в ${nextRunText}` : ''} (мск)
        {' '}— или сразу по кнопке «Обновить».
      </p>
      {error && <p className="text-[12px] mt-2" style={{ color: '#EF4444' }}>{error}</p>}
      <ModalActions>
        <GradientButton onClick={create} disabled={!nameValid || creating}>
          {creating ? 'Создаём…' : 'Создать'}
        </GradientButton>
      </ModalActions>
    </GlassModal>
  )
}

// ─── Карточка клиента ───────────────────────────────────────────────────────
function ClientCard({
  client,
  summary,
  events,
  isNew,
  refreshing,
  cooldownLeftSec,
  justUpdated,
  kebabOpen,
  onToggleKebab,
  onOpen,
  onRefresh,
  onRename,
  onArchive,
  onRestore,
}: {
  client: AdvisorClient
  summary: AdvisorSummaryEntry | undefined
  events: AdvisorEventItem[]
  isNew: boolean
  refreshing: boolean
  cooldownLeftSec: number
  justUpdated: boolean
  kebabOpen: boolean
  onToggleKebab: () => void
  onOpen: () => void
  onRefresh: () => void
  onRename: () => void
  onArchive: () => void
  onRestore: () => void
}) {
  const archived = client.is_archived
  const articlesCount = summary?.articles_count ?? 0

  const summaryText = archived
    ? 'Клиент в архиве: саммари и события по нему остановлены, данные сохранены.'
    : articlesCount === 0 && summary
      ? 'Значимых событий не зафиксировано.'
      : summary?.summary
        ? null // рендерим ниже полным текстом
        : 'Саммари появится после ближайшего обновления — или по кнопке «Обновить».'

  return (
    <div
      className={`relative p-5 transition-colors ${archived ? 'opacity-60' : 'cursor-pointer hover:border-[#3a3a3a]'}`}
      style={glassCard}
      onClick={archived ? undefined : onOpen}
    >
      {/* Имя + kebab */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[16px] font-semibold text-white truncate">{client.name}</h3>
          {isNew && (
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(0,212,255,0.12)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              новый
            </span>
          )}
          {archived && (
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(156,163,175,0.12)', color: '#9CA3AF', border: '1px solid rgba(156,163,175,0.3)' }}
            >
              архив
            </span>
          )}
        </div>
        {!archived && (
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleKebab() }}
              className="focusable p-1.5 rounded-lg text-[#6B7280] hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Действия с клиентом"
            >
              <MoreVertical size={16} />
            </button>
            {kebabOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onToggleKebab() }} />
                <div
                  className="absolute right-0 top-8 z-50 w-44 rounded-xl py-1"
                  style={{ background: '#0E0E0E', border: '1px solid #222', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onRename() }}
                    className="focusable w-full text-left px-3.5 py-2 text-[13px] text-[#D1D5DB] hover:bg-white/5 transition-colors"
                  >
                    Переименовать
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchive() }}
                    className="focusable w-full text-left px-3.5 py-2 text-[13px] text-[#EF4444] hover:bg-white/5 transition-colors"
                  >
                    Архивировать
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Counts + sentiment */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-[11px]" style={{ color: '#6B7280' }}>
          {client.active_tags} {client.active_tags === 1 ? 'тег' : client.active_tags >= 2 && client.active_tags <= 4 ? 'тега' : 'тегов'}
          {' · '}{articlesCount} {articlesCount === 1 ? 'статья' : articlesCount >= 2 && articlesCount <= 4 ? 'статьи' : 'статей'}
        </span>
        {justUpdated && !refreshing && (
          <span className="text-[10px]" style={{ color: '#34D399' }}>обновлено только что</span>
        )}
      </div>
      <div className="mb-3">
        {refreshing ? (
          <div className="h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(0,212,255,0.2)' }} />
        ) : (
          <SentimentBar mix={summary?.sentiment_mix} />
        )}
      </div>

      {/* Текст саммари / скелетон «Обновляется» */}
      {refreshing ? (
        <div className="space-y-2 mb-3">
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)', width: '92%' }} />
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)', width: '78%' }} />
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)', width: '55%' }} />
        </div>
      ) : summaryText ? (
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#9CA3AF' }}>{summaryText}</p>
      ) : (
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#D1D5DB' }}>{summary?.summary}</p>
      )}

      {/* Чипы тегов (снимок из саммари) */}
      {!archived && summary?.tags_snapshot && summary.tags_snapshot.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {summary.tags_snapshot.map(t => (
            <span
              key={t.name}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: `${TAG_TYPE_COLORS[t.type ?? ''] ?? '#6B7280'}15`,
                border: `1px solid ${TAG_TYPE_COLORS[t.type ?? ''] ?? '#6B7280'}40`,
                color: TAG_TYPE_COLORS[t.type ?? ''] ?? '#9CA3AF',
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* До 2 ближайших событий клиента */}
      {!archived && events.length > 0 && (
        <div className="mb-3 space-y-1">
          {events.slice(0, 2).map(ev => (
            <div key={ev.id} className="text-[12px]" style={{ color: '#9CA3AF' }}>
              <span style={{ color: '#00D4FF' }}>{formatEventDate(ev.date)}</span>
              {' · '}{ev.title}
              {ev.tag_name ? ` · ${ev.tag_name}` : ''}
              {formatEventDistance(ev.date) ? ` · ${formatEventDistance(ev.date)}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Футер карточки */}
      <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {archived ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRestore() }}
            className="focusable text-[13px] font-medium transition-colors"
            style={{ color: '#00D4FF' }}
          >
            Восстановить
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: '#00D4FF' }}>
              Открыть ленту <ArrowRight size={14} />
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh() }}
              disabled={refreshing || cooldownLeftSec > 0}
              title={cooldownLeftSec > 0 ? REFRESH_HINT : undefined}
              className="focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Обновляется' : cooldownLeftSec > 0 ? 'Обновить' : 'Обновить'}
            </button>
          </>
        )}
      </div>
      {cooldownLeftSec > 0 && !archived && (
        <p className="text-[10px] mt-1.5 text-right" style={{ color: '#6B7280' }}>{REFRESH_HINT}</p>
      )}
    </div>
  )
}

// ─── Страница «Adviser» ─────────────────────────────────────────────────────
export default function AdviserPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  const [clients, setClients] = useState<AdvisorClient[] | null>(null)
  const [limit, setLimit] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<AdvisorSummaryEntry[]>([])
  const [schedule, setSchedule] = useState<AdvisorSchedule | null>(null)
  const [loadError, setLoadError] = useState<'paywall' | 'error' | null>(null)

  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set())
  const [cooldowns, setCooldowns] = useState<Record<number, number>>({})
  const [justUpdated, setJustUpdated] = useState<Record<number, number>>({})
  const [refreshAllRunning, setRefreshAllRunning] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [createdId, setCreatedId] = useState<number | null>(null)

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<AdvisorClient | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<AdvisorClient | null>(null)
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [kebabOpenId, setKebabOpenId] = useState<number | null>(null)

  // Тикер для кулдауна кнопки «Обновить»
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(t)
  }, [])

  // Пилот (ТЗ-182 v10): страница только для админа; прямой URL не-админа → на главную
  useEffect(() => {
    if (!isLoading && !user?.isAdmin) navigate('/')
  }, [isLoading, user, navigate])

  const loadSummaries = useCallback(async () => {
    try {
      const data = await api.get('/advisor/summaries?hours=12')
      const parsed = parseSummariesResponse(data)
      setSummaries(parsed.clients)
      setSchedule(prev => parsed.schedule ?? prev)
    } catch {
      // Саммари-эндпоинт ещё не выкачен / недоступен — список клиентов работает и без него
      setSummaries([])
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      const data = await api.get('/advisor/clients')
      const parsed = parseClientsResponse(data)
      setClients(parsed.clients)
      if (parsed.limit !== null) setLimit(parsed.limit)
      setLoadError(null)
    } catch (err: any) {
      // 403 feature_not_available / advisor_limit_reached — нет энтитлмента multi_portfolio
      setLoadError(err?.status === 403 ? 'paywall' : 'error')
      setClients([])
    }
  }, [])

  const loadData = useCallback(() => {
    loadClients()
    loadSummaries()
  }, [loadClients, loadSummaries])

  useEffect(() => {
    if (user?.isAdmin) loadData()
  }, [user, loadData])

  const groups = useAdvisorEvents(14)

  const summaryByClient = useMemo(
    () => new Map(summaries.map(s => [s.client_id, s])),
    [summaries],
  )
  const eventsByClient = useMemo(() => {
    const m = new Map<number, AdvisorEventItem[]>()
    groups?.forEach(g => m.set(g.client_id, g.events))
    return m
  }, [groups])

  // Активные — по sort_order, архивные в конец
  const orderedClients = useMemo(() => {
    if (!clients) return []
    const active = clients.filter(c => !c.is_archived).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    const archived = clients.filter(c => c.is_archived).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    return [...active, ...archived]
  }, [clients])

  const activeCount = useMemo(() => clients?.filter(c => !c.is_archived).length ?? 0, [clients])

  const refreshClient = useCallback(async (id: number) => {
    if (refreshingIds.has(id)) return
    if ((cooldowns[id] ?? 0) > Date.now()) return
    setRefreshingIds(prev => new Set(prev).add(id))
    try {
      await api.post('/advisor/summaries/refresh', { client_id: id })
      setCooldowns(prev => ({ ...prev, [id]: Date.now() + REFRESH_COOLDOWN_MS }))
      await loadSummaries()
      setJustUpdated(prev => ({ ...prev, [id]: Date.now() }))
    } catch (err: any) {
      // Серверный 429 (1/5 мин) — зеркалим кулдауном, чтобы кнопка отдыхала
      if (err?.status === 429) {
        setCooldowns(prev => ({ ...prev, [id]: Date.now() + REFRESH_COOLDOWN_MS }))
      }
    } finally {
      setRefreshingIds(prev => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }, [refreshingIds, cooldowns, loadSummaries])

  // «Обновить всё» — последовательный прогон с паузой 300–500 мс, не лавина
  const refreshAll = useCallback(async () => {
    if (refreshAllRunning || !clients) return
    setRefreshAllRunning(true)
    try {
      for (const c of clients.filter(c => !c.is_archived)) {
        await refreshClient(c.id)
        await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
      }
    } finally {
      setRefreshAllRunning(false)
    }
  }, [refreshAllRunning, clients, refreshClient])

  const patchClient = useCallback(async (id: number, body: Record<string, unknown>) => {
    await api.patch(`/advisor/clients/${id}`, body)
    await loadClients()
    await loadSummaries()
  }, [loadClients, loadSummaries])

  const doRename = async () => {
    const name = renameValue.trim()
    if (!renameTarget || !name || name.length > 100 || renameSaving) return
    setRenameSaving(true)
    try {
      await patchClient(renameTarget.id, { name })
      setRenameTarget(null)
    } catch {
      // не удалось — модал остаётся открытым, пользователь повторит
    } finally {
      setRenameSaving(false)
    }
  }

  const doArchive = async () => {
    if (!archiveTarget || archiveSaving) return
    setArchiveSaving(true)
    try {
      await patchClient(archiveTarget.id, { is_archived: true })
      setArchiveTarget(null)
    } finally {
      setArchiveSaving(false)
    }
  }

  if (isLoading || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <Loader2 size={28} style={{ color: '#00D4FF' }} className="animate-spin" />
      </div>
    )
  }

  // Paywall: API-гейт multi_portfolio (админ без энтитлмента получает 403)
  if (loadError === 'paywall') {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-6">
        <div className="max-w-[420px] w-full text-center rounded-2xl p-8" style={glassCard}>
          <div
            className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
          >
            <Users size={28} style={{ color: '#00D4FF' }} />
          </div>
          <h1 className="text-xl font-bold mb-2">Adviser — не доступен на вашем тарифе</h1>
          <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
            Клиентские портфели доступны на тарифах с опцией нескольких портфелей.
            Перейдите на подходящий тариф, чтобы вести клиентов.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
          >
            Смотреть тарифы <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  const lastRunText = formatMskTime(schedule?.last_run_at ?? null)
  const nextRunText = formatMskTime(schedule?.next_run_at ?? null)

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Шапка */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold">Adviser</h1>
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF' }}
          >
            {activeCount}{limit !== null ? ` из ${limit}` : ''} клиентов
          </span>
          <div className="ml-auto">
            <button
              onClick={() => {
                if (limit !== null && activeCount >= limit) {
                  setPaywallOpen(true)
                } else {
                  setCreateOpen(true)
                }
              }}
              className="focusable inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              <Plus size={16} /> Новый клиент
            </button>
          </div>
        </div>

        {/* Статус-стрип расписания */}
        {schedule && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 mb-6 rounded-xl"
            style={{ ...glassCard, borderRadius: 12 }}
          >
            <span className="text-[12px]" style={{ color: '#9CA3AF' }}>
              {lastRunText
                ? <>Обзор обновлён в <span className="text-white font-medium">{lastRunText}</span></>
                : 'Обзор ещё ни разу не обновлялся'}
              {nextRunText && <> · следующее обновление в <span className="text-white font-medium">{nextRunText}</span> (мск)</>}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setScheduleOpen(true)}
                className="focusable px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                style={{ background: 'transparent', border: '1px solid #222', color: '#9CA3AF' }}
              >
                Изменить
              </button>
              <button
                onClick={refreshAll}
                disabled={refreshAllRunning || activeCount === 0}
                className="focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF' }}
              >
                <RefreshCw size={13} className={refreshAllRunning ? 'animate-spin' : ''} />
                {refreshAllRunning ? 'Обновляем…' : 'Обновить всё'}
              </button>
            </div>
          </div>
        )}

        {loadError === 'error' && (
          <div className="text-center py-12 text-text-muted">
            <p className="mb-4">Не удалось загрузить клиентов</p>
            <button onClick={loadData} className="text-[#00D4FF] hover:underline">Повторить</button>
          </div>
        )}

        {loadError === null && clients === null && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} style={{ color: '#00D4FF' }} className="animate-spin" />
          </div>
        )}

        {loadError === null && clients !== null && clients.length === 0 && (
          <div className="text-center py-16 rounded-2xl" style={glassCard}>
            <Users size={36} className="mx-auto mb-4" style={{ color: '#374151' }} />
            <h2 className="text-lg font-semibold mb-2">Добавьте первого клиента</h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Клиентский портфель — именованный набор тегов со своим саммари и событиями.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="focusable inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              <Plus size={16} /> Новый клиент
            </button>
          </div>
        )}

        {/* События по клиентам — блок целиком не рендерится, если эндпоинт
            не ответил (404/ошибка) или событий нет ни у одного клиента */}
        {groups && groups.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#D1D5DB' }}>
              События по клиентам · ближайшие 14 дней
            </h2>
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="space-y-5">
                {groups.map(g => (
                  <div key={g.client_id}>
                    <Link
                      to={`/adviser/${g.client_id}`}
                      className="focusable text-[13px] font-semibold hover:underline"
                      style={{ color: '#00D4FF' }}
                    >
                      {g.name}
                    </Link>
                    <div className="mt-1.5 space-y-1">
                      {g.events.map(ev => (
                        <div key={ev.id} className="text-[12px]" style={{ color: '#9CA3AF' }}>
                          <span style={{ color: '#00D4FF' }}>{formatEventDate(ev.date)}</span>
                          {' · '}{ev.title}
                          {ev.tag_name ? ` · ${ev.tag_name}` : ''}
                          {formatEventDistance(ev.date) ? ` · ${formatEventDistance(ev.date)}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Link to="/#calendar" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: '#00D4FF' }}>
                  Открыть календарь <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Лента карточек клиентов */}
        {loadError === null && orderedClients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderedClients.map(c => (
              <ClientCard
                key={c.id}
                client={c}
                summary={summaryByClient.get(c.id)}
                events={eventsByClient.get(c.id) ?? []}
                isNew={createdId === c.id}
                refreshing={refreshingIds.has(c.id)}
                cooldownLeftSec={Math.max(0, Math.ceil(((cooldowns[c.id] ?? 0) - now) / 1000))}
                justUpdated={!!justUpdated[c.id] && Date.now() - justUpdated[c.id] < 120_000}
                kebabOpen={kebabOpenId === c.id}
                onToggleKebab={() => setKebabOpenId(prev => (prev === c.id ? null : c.id))}
                onOpen={() => navigate(`/adviser/${c.id}`)}
                onRefresh={() => refreshClient(c.id)}
                onRename={() => { setRenameTarget(c); setRenameValue(c.name) }}
                onArchive={() => setArchiveTarget(c)}
                onRestore={() => patchClient(c.id, { is_archived: false }).catch(() => {})}
              />
            ))}
          </div>
        )}
      </div>

      {/* Модалы */}
      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} schedule={schedule} onSaved={setSchedule} />
      <NewClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingNames={clients?.map(c => c.name) ?? []}
        nextRunAt={schedule?.next_run_at ?? null}
        onCreated={(id) => { setCreatedId(id); loadData() }}
        onLimitReached={() => setPaywallOpen(true)}
      />
      <PremiumPromptModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title="Лимит клиентов достигнут"
        description={
          limit !== null
            ? `На вашем тарифе можно вести до ${limit} клиентских портфелей. Перейдите на тариф с большим лимитом, чтобы добавить ещё.`
            : 'На вашем тарифе исчерпан лимит клиентских портфелей. Перейдите на тариф с большим лимитом, чтобы добавить ещё.'
        }
        cta="Смотреть тарифы"
        to="/pricing"
      />

      <GlassModal open={renameTarget !== null} onClose={() => setRenameTarget(null)} title="Переименовать клиента">
        <ModalInput value={renameValue} onChange={setRenameValue} placeholder="Имя клиента" />
        <ModalActions>
          <GradientButton onClick={doRename} disabled={!renameValue.trim() || renameValue.trim().length > 100 || renameSaving}>
            {renameSaving ? 'Сохраняем…' : 'Сохранить'}
          </GradientButton>
        </ModalActions>
      </GlassModal>

      <GlassModal open={archiveTarget !== null} onClose={() => setArchiveTarget(null)} title="Архивировать клиента">
        <p className="text-[13px] leading-relaxed" style={{ color: '#9CA3AF' }}>
          Саммари и подписки клиента «{archiveTarget?.name}» остановятся, данные сохранятся.
          Восстановление — вручную, кнопкой «Восстановить» в архивной карточке.
        </p>
        <ModalActions>
          <GradientButton onClick={doArchive} disabled={archiveSaving}>
            {archiveSaving ? 'Архивируем…' : 'Архивировать'}
          </GradientButton>
        </ModalActions>
      </GlassModal>
    </div>
  )
}

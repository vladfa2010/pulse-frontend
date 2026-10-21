import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Check, Loader2, Newspaper, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import SentimentBar from '@/components/adviser/SentimentBar'
import AdvisorTaskItem from '@/components/adviser/AdvisorTaskItem'
import { AdvisorCopyButton, AdvisorNoteButton } from '@/components/adviser/AdvisorHeaderActions'
import { useAdvisorEvents } from '@/components/adviser/useAdvisorEvents'
import {
  TAG_TYPE_COLORS,
  buildCopyText,
  formatEventDate,
  formatEventDistance,
  formatFullDate,
  isStubSummary,
  parseClientDetail,
  parseNewsResponse,
  parseSummariesResponse,
  parseTasksResponse,
  parseTelegramStatus,
  taskTitleFromEvent,
  type AdvisorClient,
  type AdvisorClientTag,
  type AdvisorEventItem,
  type AdvisorSummaryEntry,
  type AdvisorTask,
} from '@/components/adviser/adviserTypes'
import type { NewsArticle } from '@/types/news'

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #222222',
  borderRadius: 16,
}

function timeAgo(publishedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 60000)
  if (Number.isNaN(minutes) || minutes < 0) return ''
  if (minutes < 60) return `${minutes} мин`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ч`
  return `${Math.floor(minutes / 1440)} д`
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#34D399',
  negative: '#EF4444',
  neutral: '#9CA3AF',
}

export default function AdviserClientPage() {
  const { id } = useParams<{ id: string }>()
  const clientId = Number(id)
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [client, setClient] = useState<AdvisorClient | null>(null)
  const [tags, setTags] = useState<AdvisorClientTag[]>([])
  const [summary, setSummary] = useState<AdvisorSummaryEntry | null>(null)
  const [articles, setArticles] = useState<NewsArticle[] | null>(null)
  const [error, setError] = useState<{ code: string | null; status: number | null } | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [restoring, setRestoring] = useState(false)

  // ─── ТЗ-183: открытые задачи клиента, Telegram-статус ───
  const [tasks, setTasks] = useState<AdvisorTask[] | null>(null)
  const [tgLinked, setTgLinked] = useState<boolean | null>(null)
  const [addedEventKeys, setAddedEventKeys] = useState<Set<string>>(new Set())
  const [addingEventKeys, setAddingEventKeys] = useState<Set<string>>(new Set())
  const [eventErrors, setEventErrors] = useState<Record<string, string>>({})

  // ─── Редактирование тегов клиента: существующие эндпоинты модуля
  // POST /advisor/clients/:id/tags (идемпотентно, 403 tag_limit_reached),
  // DELETE /advisor/clients/:id/tags/:tagId. Архивному клиенту бэкенд шлёт
  // 403 advisor_client_archived — UI для него скрыт. ───
  const [tagInput, setTagInput] = useState('')
  const [suggestions, setSuggestions] = useState<{ name: string; type: string | null }[]>([])
  const [tagBusy, setTagBusy] = useState(false)
  const [tagEditError, setTagEditError] = useState<string | null>(null)

  useEffect(() => {
    const q = tagInput.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/tags/search?q=${encodeURIComponent(q)}`)
        const found = Array.isArray(data?.tags) ? data.tags : []
        setSuggestions(
          found
            .map((t: any) => ({ name: String(t.tag_name ?? ''), type: (t.tag_type as string | null) ?? null }))
            .filter((t: { name: string }) => t.name && !tags.some(x => x.tag_name.toLowerCase() === t.name.toLowerCase()))
            .slice(0, 6),
        )
      } catch {
        setSuggestions([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [tagInput, tags])

  const addTag = async (rawName: string) => {
    const name = rawName.trim()
    if (!name || tagBusy || !clientId) return
    setTagBusy(true)
    setTagEditError(null)
    try {
      await api.post(`/advisor/clients/${clientId}/tags`, { tag_name: name })
      setTagInput('')
      setSuggestions([])
      await load() // теги + лента новостей клиента зависят от списка тегов
    } catch (err: any) {
      if (err?.status === 403 && err?.data?.error === 'tag_limit_reached') {
        setTagEditError(`Достигнут лимит тегов на клиента${typeof err.data.limit === 'number' ? ` (${err.data.limit})` : ''}.`)
      } else {
        setTagEditError(`Не удалось добавить тег «${name}»`)
      }
    } finally {
      setTagBusy(false)
    }
  }

  const removeTag = async (tag: AdvisorClientTag) => {
    if (tagBusy || !clientId) return
    setTagBusy(true)
    setTagEditError(null)
    try {
      await api.delete(`/advisor/clients/${clientId}/tags/${tag.id}`)
      await load()
    } catch {
      setTagEditError(`Не удалось удалить тег «${tag.tag_name}»`)
    } finally {
      setTagBusy(false)
    }
  }

  const loadTasks = useCallback(async () => {
    if (!clientId) return
    try {
      const data = await api.get(`/advisor/clients/${clientId}/tasks`)
      const parsed = parseTasksResponse(data)
      setTasks(parsed)
      setAddedEventKeys(prev => {
        const next = new Set(prev)
        parsed.forEach(t => {
          if (t.source_event_id) next.add(String(t.source_event_id))
        })
        return next
      })
    } catch {
      setTasks([])
    }
  }, [clientId])

  useEffect(() => {
    if (user?.isAdmin) {
      loadTasks()
      api.get('/advisor/telegram/status')
        .then(data => setTgLinked(parseTelegramStatus(data)))
        .catch(() => setTgLinked(false))
    }
  }, [user, loadTasks])

  const saveNote = async (notes: string) => {
    if (!clientId) return
    await api.patch(`/advisor/clients/${clientId}`, { notes: notes.slice(0, 2000) })
    await load()
  }

  const addTaskFromEvent = useCallback(async (ev: AdvisorEventItem) => {
    const key = ev.id
    if (addingEventKeys.has(key) || addedEventKeys.has(key) || !clientId) return
    setAddingEventKeys(prev => new Set(prev).add(key))
    setEventErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      await api.post(`/advisor/clients/${clientId}/tasks`, {
        title: taskTitleFromEvent(ev),
        due_date: ev.date,
        source_event_id: ev.id,
      })
      // Повтор того же source_event_id — 200 с существующей задачей: не дубль, не ошибка
      setAddedEventKeys(prev => new Set(prev).add(key))
      await loadTasks()
    } catch {
      setEventErrors(prev => ({ ...prev, [key]: 'Не удалось добавить — попробуйте ещё раз' }))
    } finally {
      setAddingEventKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [clientId, addingEventKeys, addedEventKeys, loadTasks])

  // Пилот (ТЗ-182 v10): экран только для админа
  useEffect(() => {
    if (!isLoading && !user?.isAdmin) navigate('/')
  }, [isLoading, user, navigate])

  const load = useCallback(async () => {
    if (!clientId) return
    setError(null)
    try {
      const detail = await api.get(`/advisor/clients/${clientId}`)
      const parsed = parseClientDetail(detail)
      if (!parsed.client) throw Object.assign(new Error('Клиент не найден'), { status: 404, data: { error: 'advisor_client_forbidden' } })
      setClient(parsed.client)
      setTags(parsed.tags)
    } catch (err: any) {
      setError({ code: err?.data?.error ?? null, status: err?.status ?? null })
      setClient(null)
      return
    }
    // Саммари — read-only; при недоступности эндпоинта блок покажет заглушку
    try {
      const data = await api.get('/advisor/summaries?hours=12')
      const parsed = parseSummariesResponse(data)
      setSummary(parsed.clients.find(c => c.client_id === clientId) ?? null)
    } catch {
      setSummary(null)
    }
    // Новости по тегам клиента
    try {
      const data = await api.get(`/advisor/clients/${clientId}/news?limit=30`)
      setArticles(parseNewsResponse(data))
    } catch {
      setArticles([])
    }
  }, [clientId])

  useEffect(() => {
    if (user?.isAdmin && clientId) load()
  }, [user, clientId, load])

  // Ближайшие события этого клиента — блок tolerant к отсутствию эндпоинта
  const groups = useAdvisorEvents(14)
  const clientEvents = useMemo(
    () => groups?.find(g => g.client_id === clientId)?.events ?? [],
    [groups, clientId],
  )

  // Отметка прочитанного — существующим эндпоинтом ядра по news id (без изменений ядра)
  const openArticle = (article: NewsArticle) => {
    api.post(`/news/${article.id}/read`, {}).catch(() => {})
    setReadIds(prev => new Set(prev).add(article.id))
    if (article.slug) {
      navigate(`/news/${article.slug}`, { state: { background: location } })
    }
  }

  const restore = async () => {
    if (!client || restoring) return
    setRestoring(true)
    try {
      await api.patch(`/advisor/clients/${client.id}`, { is_archived: false })
      await load()
    } catch {
      // повтор — кнопкой
    } finally {
      setRestoring(false)
    }
  }

  if (isLoading || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <Loader2 size={28} style={{ color: '#00D4FF' }} className="animate-spin" />
      </div>
    )
  }

  if (error) {
    const isArchivedError = error.code === 'advisor_client_archived'
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-6">
        <div className="max-w-[420px] w-full text-center rounded-2xl p-8" style={glassCard}>
          <h1 className="text-xl font-bold mb-2">
            {isArchivedError ? 'Клиент в архиве' : 'Клиент не найден'}
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
            {isArchivedError
              ? 'Этот клиент архивирован. Данные сохранены — можно восстановить.'
              : 'Такого клиента нет среди ваших — возможно, ссылка устарела.'}
          </p>
          {isArchivedError && client && (
            <button
              onClick={restore}
              disabled={restoring}
              className="focusable inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50 mb-3"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              {restoring ? 'Восстанавливаем…' : 'Восстановить'}
            </button>
          )}
          <div>
            <Link to="/adviser" className="text-sm" style={{ color: '#00D4FF' }}>
              ← Ко всем клиентам
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <Loader2 size={28} style={{ color: '#00D4FF' }} className="animate-spin" />
      </div>
    )
  }

  const archived = client.is_archived

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-[860px] mx-auto px-4 py-8">
        {/* Шапка */}
        <Link
          to="/adviser"
          className="focusable inline-flex items-center gap-2 text-sm mb-5 transition-colors"
          style={{ color: '#9CA3AF' }}
        >
          <ArrowLeft size={16} /> Ко всем клиентам
        </Link>
        <div className="flex flex-wrap items-center gap-3 mb-7">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {archived && (
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: 'rgba(156,163,175,0.12)', border: '1px solid rgba(156,163,175,0.3)', color: '#9CA3AF' }}
            >
              в архиве
            </span>
          )}
          {/* ТЗ-183 Задачи 7–8: те же иконки, что в шапке карточки */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <AdvisorNoteButton
              initial={client.notes}
              hasNote={!!client.notes}
              onSave={saveNote}
            />
            <AdvisorCopyButton
              disabled={isStubSummary(summary)}
              getText={() =>
                buildCopyText({
                  name: client.name,
                  dateLabel: formatFullDate(summary?.generated_at) || formatFullDate(new Date().toISOString()),
                  summary: summary?.summary ?? '',
                  tags: tags.map(t => t.tag_name),
                  events: clientEvents.slice(0, 4).map(ev => ({ date: ev.date, title: ev.title })),
                })
              }
            />
          </div>
        </div>

        {/* Заметка (ТЗ-183 Задача 7) — приватна, в «Копировать» не попадает */}
        {client.notes && (
          <div
            className="mb-6 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' }}
          >
            <p className="text-[13px] italic leading-relaxed" style={{ color: '#A78BFA' }}>Заметка: {client.notes}</p>
          </div>
        )}

        {/* Задачи (ТЗ-183 Задача 6): чек-лист открытых задач клиента */}
        {!archived && tasks !== null && tasks.length > 0 && (
          <section className="p-5 mb-6" style={glassCard}>
            <h2 className="text-[15px] font-semibold mb-2" style={{ color: '#D1D5DB' }}>Задачи</h2>
            {tasks.map(t => (
              <AdvisorTaskItem
                key={t.id}
                task={t}
                telegramLinked={tgLinked === true}
                onChanged={loadTasks}
              />
            ))}
          </section>
        )}

        {/* Обзор за 12 часов */}
        <section className={`p-5 mb-6 ${archived ? 'opacity-60' : ''}`} style={glassCard}>
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#D1D5DB' }}>Обзор за 12 часов</h2>
          <div className="mb-3"><SentimentBar mix={summary?.sentiment_mix} /></div>
          {summary && summary.articles_count > 0 && summary.summary ? (
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#D1D5DB' }}>{summary.summary}</p>
          ) : summary && summary.articles_count === 0 ? (
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#9CA3AF' }}>Значимых событий не зафиксировано.</p>
          ) : (
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#9CA3AF' }}>
              Саммари появится после ближайшего обновления — или по кнопке «Обновить» на странице Adviser.
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => {
                const color = TAG_TYPE_COLORS[t.tag_type ?? ''] ?? '#6B7280'
                const style = {
                  backgroundColor: `${color}15`,
                  border: `1px solid ${color}40`,
                  color: color,
                }
                return archived ? (
                  <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={style}>
                    {t.tag_name}
                  </span>
                ) : (
                  <button
                    key={t.id}
                    onClick={() => removeTag(t)}
                    disabled={tagBusy}
                    className="focusable px-2 py-0.5 rounded-full text-[10px] font-medium disabled:opacity-50"
                    style={style}
                    title="Нажмите, чтобы убрать"
                  >
                    {t.tag_name} ×
                  </button>
                )
              })}
            </div>
          )}
          {tags.length === 0 && (
            <p className="text-[11px] mb-2" style={{ color: '#6B7280' }}>
              Теги не заданы — новости клиента пусты.{archived ? '' : ' Добавьте теги ниже.'}
            </p>
          )}
          {!archived && (
            <div className="mt-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="Найти или добавить тег… Enter — произвольный"
                autoComplete="off"
                className="focusable w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors"
              />
              {suggestions.length > 0 && (
                <div
                  className="mt-1.5 rounded-[10px] overflow-hidden"
                  style={{ background: '#161616', border: '1px solid #222' }}
                >
                  {suggestions.map(s => (
                    <button
                      key={s.name}
                      onClick={() => addTag(s.name)}
                      className="focusable w-full text-left px-3 py-2 text-[13px] text-[#D1D5DB] hover:bg-white/5 transition-colors"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {tagEditError && <p className="text-[11px] mt-1.5" style={{ color: '#FBBF24' }}>{tagEditError}</p>}
        </section>

        {/* Ближайшие события — рендерится только когда эндпоинт ответил
            и у клиента есть события в окне */}
        {!archived && clientEvents.length > 0 && (
          <section className="p-5 mb-6" style={glassCard}>
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#D1D5DB' }}>Ближайшие события</h2>
            <div className="space-y-1.5">
              {clientEvents.map(ev => {
                const added = addedEventKeys.has(ev.id)
                const adding = addingEventKeys.has(ev.id)
                return (
                  <div key={ev.id} className="flex items-center gap-2 text-[13px]" style={{ color: '#9CA3AF' }}>
                    <span className="min-w-0">
                      <span style={{ color: '#00D4FF' }}>{formatEventDate(ev.date)}</span>
                      {' · '}{ev.title}
                      {ev.tag_name ? ` · ${ev.tag_name}` : ''}
                      {formatEventDistance(ev.date) ? ` · ${formatEventDistance(ev.date)}` : ''}
                    </span>
                    <span className="ml-auto shrink-0 flex items-center gap-2">
                      {eventErrors[ev.id] && (
                        <span className="text-[10px]" style={{ color: '#FBBF24' }}>{eventErrors[ev.id]}</span>
                      )}
                      {/* ТЗ-183 Задача 6: событие → задача «позвонить до даты» */}
                      <button
                        onClick={() => addTaskFromEvent(ev)}
                        disabled={added || adding}
                        title={added ? 'Задача уже в чек-листе' : 'Создать задачу «позвонить до даты»'}
                        className="focusable inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors disabled:cursor-default"
                        style={
                          added
                            ? { background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }
                            : {
                                background: 'rgba(0,212,255,0.08)',
                                color: '#00D4FF',
                                border: '1px solid rgba(0,212,255,0.2)',
                                opacity: adding ? 0.6 : 1,
                              }
                        }
                      >
                        {added ? (<><Check size={11} /> в задачах</>) : adding ? 'Добавляем…' : (<><Plus size={11} /> в задачи</>)}
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Лента новостей по тегам клиента */}
        <section className="p-5" style={glassCard}>
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#D1D5DB' }}>Лента новостей</h2>
          {articles === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} style={{ color: '#00D4FF' }} className="animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#6B7280' }}>
              <Newspaper size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-[13px]">Новостей по тегам клиента пока нет</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {articles.map(a => {
                const read = readIds.has(a.id)
                const sentimentColor = SENTIMENT_COLORS[a.sentiment || 'neutral'] ?? '#9CA3AF'
                return (
                  <button
                    key={a.id}
                    onClick={() => openArticle(a)}
                    className="focusable w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                    style={{ opacity: read ? 0.5 : 1 }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                        style={{ backgroundColor: sentimentColor }}
                        title={a.sentiment || 'neutral'}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug" style={{ color: read ? '#6B7280' : '#E5E7EB' }}>
                          {a.title_ru || a.title_original || '(без заголовка)'}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: '#6B7280' }}>
                          {a.source}{a.published_at ? ` · ${timeAgo(a.published_at)}` : ''}
                          {read && ' · прочитано'}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

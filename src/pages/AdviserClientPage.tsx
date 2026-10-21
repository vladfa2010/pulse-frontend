import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Loader2, Newspaper } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import SentimentBar from '@/components/adviser/SentimentBar'
import { useAdvisorEvents } from '@/components/adviser/useAdvisorEvents'
import {
  TAG_TYPE_COLORS,
  formatEventDate,
  formatEventDistance,
  parseClientDetail,
  parseNewsResponse,
  parseSummariesResponse,
  type AdvisorClient,
  type AdvisorClientTag,
  type AdvisorSummaryEntry,
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
        </div>

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
              {tags.map(t => (
                <span
                  key={t.id}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: `${TAG_TYPE_COLORS[t.tag_type ?? ''] ?? '#6B7280'}15`,
                    border: `1px solid ${TAG_TYPE_COLORS[t.tag_type ?? ''] ?? '#6B7280'}40`,
                    color: TAG_TYPE_COLORS[t.tag_type ?? ''] ?? '#9CA3AF',
                  }}
                >
                  {t.tag_name}
                </span>
              ))}
            </div>
          )}
          {tags.length === 0 && (
            <p className="text-[11px]" style={{ color: '#6B7280' }}>Теги не заданы — новости клиента пусты.</p>
          )}
        </section>

        {/* Ближайшие события — рендерится только когда эндпоинт ответил
            и у клиента есть события в окне */}
        {!archived && clientEvents.length > 0 && (
          <section className="p-5 mb-6" style={glassCard}>
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: '#D1D5DB' }}>Ближайшие события</h2>
            <div className="space-y-1.5">
              {clientEvents.map(ev => (
                <div key={ev.id} className="text-[13px]" style={{ color: '#9CA3AF' }}>
                  <span style={{ color: '#00D4FF' }}>{formatEventDate(ev.date)}</span>
                  {' · '}{ev.title}
                  {ev.tag_name ? ` · ${ev.tag_name}` : ''}
                  {formatEventDistance(ev.date) ? ` · ${formatEventDistance(ev.date)}` : ''}
                </div>
              ))}
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

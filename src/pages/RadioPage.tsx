/**
 * =============================================================================
 * PULSE — Страница радио (ТЗ-43)
 * =============================================================================
 *
 * Каркас страницы /radio: роутинг/данные/SSE/прочитанность. Финальный визуал
 * и голос — ТЗ-44 (компоненты переносятся на эти данные как есть).
 *
 * Что здесь:
 *   - лента непрочитанных по тегам (GET /api/news) + live-подписка по SSE
 *     (новости по тегам юзера — сверху с подсветкой 4 с; не по тегам — игнор);
 *   - карточка: score-чип цветом (≥8.5 красный, ≥7 жёлтый, иначе серый; при
 *     score=0 — ни чипа), перепечатка ×N, блок «Что это значит»
 *     (sentiment_reasoning + строки влияния по тегам; пустые поля не рендерятся);
 *   - «начатая карточка = прочитана» (onEntryStart → POST /api/news/:id/read,
 *     оптимистично) — осознанное решение v1, без opt-out (RADIO.md §3.1);
 *   - юзер без тегов: заглушка «Радио молчит» + CTA в настройки тегов +
 *     «послушать общее саммари» (GET /api/user/summary-global).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { useRadioConfig } from '@/hooks/useRadioConfig'
import { useRadioSse } from '@/hooks/useRadioSse'
import { fetchUserTags, buildTagMap, type TagMap } from '@/lib/radio/tagMap'
import { adaptPulseToNewsItem, buildImpactLines } from '@/lib/radio/newsAdapter'
import { adaptCalendarToday } from '@/lib/radio/calendarAdapter'
import { getCalendar } from '@/lib/calendarApi'
import type { NewsArticle } from '@/types/news'
import type { RadioNewsItem, RadioCalendarEvent } from '@/types/radio'

const FRESH_HIGHLIGHT_MS = 4000
const MAX_FEED = 40

/** Цвет score-чипа (RADIO.md: ≥8.5 красный, ≥7 жёлтый, иначе серый) */
function scoreColor(score: number): string {
  if (score >= 8.5) return 'text-red-400 border-red-400/40 bg-red-400/10'
  if (score >= 7) return 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10'
  return 'text-zinc-400 border-zinc-600/40 bg-zinc-600/10'
}

/** «Оценка N из десяти» — число прописью для голоса (ТЗ-44 переиспользует) */
export function scorePhrase(score: number): string | null {
  if (score <= 0) return null // нет оценки — фразу не выдумываем
  return `Оценка ${String(score).replace('.', ' и ')} из десяти`
}

function RadioCard({
  item,
  userTagIds,
  tagMap,
  isFresh,
  onEntryStart,
}: {
  item: RadioNewsItem
  userTagIds: ReadonlySet<string>
  tagMap: TagMap
  isFresh: boolean
  onEntryStart: (id: string) => void
}) {
  const impactLines = buildImpactLines(item, userTagIds, tagMap)
  const reasoningParagraphs = item.sentimentReasoning
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${
        isFresh
          ? 'border-cyan-400/50 bg-cyan-400/5'
          : 'border-zinc-800 bg-zinc-900/40'
      }`}
      data-testid="radio-card"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="text-cyan-400 font-medium">{item.source}</span>
        <span>·</span>
        <span>
          {item.time ? new Date(item.time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
        {item.score > 0 && (
          <span className={`rounded-full border px-2 py-0.5 font-medium ${scoreColor(item.score)}`}>
            {item.score}
          </span>
        )}
        {item.reprint && (
          <span className="rounded-full border border-zinc-600/40 px-2 py-0.5 text-zinc-400">
            ПЕРЕПЕЧАТКА ×{item.sources.length}
          </span>
        )}
      </div>

      <h3 className="mt-2 text-base font-semibold text-zinc-100">
        <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
          {item.title}
        </a>
      </h3>
      {item.text && <p className="mt-1 text-sm text-zinc-400 line-clamp-3">{item.text}</p>}

      {(reasoningParagraphs.length > 0 || impactLines.length > 0) && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Что это значит
          </div>
          {reasoningParagraphs.map((p, i) => (
            <p key={i} className="mt-2 text-sm text-zinc-300">
              {p}
            </p>
          ))}
          {impactLines.map((l, i) => (
            <p key={`imp-${i}`} className="mt-2 text-sm">
              <span className="text-cyan-400">{l.name}</span>
              <span className={l.score >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                {' '}
                {l.score >= 0 ? '+' : ''}
                {l.score}
              </span>
              <span className="text-zinc-400"> — {l.reasoning}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-400">
              {t}
            </span>
          ))}
        </div>
        {/* Заглушка плеера: ТЗ-44 заменит на запуск голосового движка */}
        <button
          onClick={() => onEntryStart(item.id)}
          className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-400/10"
        >
          ▶ слушать
        </button>
      </div>
    </article>
  )
}

export default function RadioPage() {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  useRadioConfig() // прогрев кэша флагов; значения заберёт движок ТЗ-44

  // ─── Теги юзера → tagMap + id-set (стабильные ссылки для SSE) ───
  const { data: userTags = [], isSuccess: tagsLoaded } = useQuery({
    queryKey: ['radio', 'tags'],
    queryFn: fetchUserTags,
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000,
  })
  const tagMap = useMemo(() => buildTagMap(userTags), [userTags])
  const userTagIds = useMemo(() => new Set(userTags.map((t) => t.tag_id)), [userTags])

  // ─── Лента: непрочитанные по тегам (GET /api/news) ───
  const { data: feedResponse } = useQuery({
    queryKey: ['radio', 'feed'],
    queryFn: async (): Promise<{ articles: NewsArticle[] }> =>
      (await api.get('/news')) as { articles: NewsArticle[] },
    enabled: isLoggedIn && userTags.length > 0,
    staleTime: 2 * 60 * 1000,
  })
  const rawArticles = feedResponse?.articles ?? []
  const baseFeed = useMemo(
    () => rawArticles.map((a) => adaptPulseToNewsItem(a, userTagIds, tagMap)),
    [rawArticles, userTagIds, tagMap]
  )

  // ─── Календарь сегодня ───
  const { data: calendar } = useQuery({
    queryKey: ['radio', 'calendar'],
    queryFn: getCalendar,
    enabled: isLoggedIn,
    retry: 0,
    staleTime: 30 * 60 * 1000,
  })
  const calendarEvents: RadioCalendarEvent[] = useMemo(
    () => (calendar ? adaptCalendarToday(calendar) : []),
    [calendar]
  )

  // ─── Локальный стейт ленты (ТЗ-43 задача 4) ───
  const [liveItems, setLiveItems] = useState<RadioNewsItem[]>([])
  const [freshIds, setFreshIds] = useState<Record<string, number>>({})
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set())
  const seenIdsRef = useMemo(() => new Set<string>(), [])
  const [globalSummary, setGlobalSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const handleSseNews = useCallback(
    (item: RadioNewsItem) => {
      if (seenIdsRef.has(item.id)) return // дедуп (StrictMode dev / повторы)
      seenIdsRef.add(item.id)
      setLiveItems((prev) => [item, ...prev].slice(0, MAX_FEED))
      setFreshIds((prev) => ({ ...prev, [item.id]: Date.now() }))
    },
    [seenIdsRef]
  )

  useRadioSse({ enabled: isLoggedIn && userTags.length > 0, userTagIds, tagMap, onNews: handleSseNews })

  // Подсветка fresh 4 с — периодическая чистка
  useEffect(() => {
    const t = setInterval(() => {
      setFreshIds((prev) => {
        const now = Date.now()
        const next = Object.fromEntries(Object.entries(prev).filter(([, ts]) => now - ts < FRESH_HIGHLIGHT_MS))
        return Object.keys(next).length === Object.keys(prev).length ? prev : next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // ─── Прочитанность: начатая карточка (в т.ч. скип после старта — v1 без opt-out) ───
  const handleEntryStart = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    api.post(`/news/${id}/read`, {}).catch(() => {
      setReadIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    })
  }, [])

  const feed = useMemo(() => {
    const liveIds = new Set(liveItems.map((i) => i.id))
    return [...liveItems, ...baseFeed.filter((i) => !liveIds.has(i.id))]
      .filter((i) => !readIds.has(i.id))
      .slice(0, MAX_FEED)
  }, [liveItems, baseFeed, readIds])

  // Счётчик свежих для порога саммари (перепечатки не считаются, ТЗ-44)
  const freshCount = useMemo(
    () => feed.filter((i) => freshIds[i.id] && !i.reprint).length,
    [feed, freshIds]
  )

  const handleGlobalSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const data = (await api.get('/user/summary-global')) as { summary?: string }
      setGlobalSummary(data.summary ?? 'Саммари пока готовится — загляните чуть позже.')
    } catch {
      setGlobalSummary('Не удалось загрузить общее саммари. Попробуйте позже.')
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // ─── Гость ───
  if (!isLoggedIn) {
    return (
      <div className="min-h-dvh bg-[#060606] text-zinc-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-cyan-400 text-sm font-semibold tracking-widest">РАДИО</div>
          <h1 className="mt-2 text-2xl font-bold">Персональное радио инвестора</h1>
          <p className="mt-3 text-zinc-400">
            Озвучивает ваши непрочитанные новости, объясняет инвестсмысл по вашим темам
            и ведёт через календарь дня. Войдите, чтобы эфир знал ваши интересы.
          </p>
          <button
            onClick={() => openAuthModal('login', { returnUrl: '/radio' })}
            className="mt-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-6 py-2 text-cyan-200 hover:bg-cyan-500/30"
          >
            Войти и слушать
          </button>
        </div>
      </div>
    )
  }

  // ─── Пустой профиль: без тегов эфир молчит ───
  if (tagsLoaded && userTags.length === 0) {
    return (
      <div className="min-h-dvh bg-[#060606] text-zinc-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-cyan-400 text-sm font-semibold tracking-widest">РАДИО</div>
          <h1 className="mt-2 text-2xl font-bold">Радио молчит</h1>
          <p className="mt-3 text-zinc-400">
            Потому что не знает ваших интересов. Задайте темы в портфеле — и эфир начнёт
            собирать новости по ним.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              to="/portfolio"
              className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-6 py-2 text-cyan-200 hover:bg-cyan-500/30"
            >
              Задать интересы
            </Link>
            <button
              onClick={handleGlobalSummary}
              disabled={summaryLoading}
              className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200 disabled:opacity-50"
            >
              {summaryLoading ? 'Гружу…' : 'А пока послушать общее саммари рынка'}
            </button>
          </div>
          {globalSummary && (
            <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left text-sm text-zinc-300">
              {globalSummary}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#060606] text-zinc-100 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-cyan-400 text-sm font-semibold tracking-widest">РАДИО</div>
            <h1 className="mt-1 text-2xl font-bold">Эфир</h1>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>непрочитанных: {feed.length}</div>
            {freshCount > 0 && <div className="text-cyan-400">свежих: +{freshCount}</div>}
          </div>
        </header>

        {calendarEvents.length > 0 && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Повестка дня
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {calendarEvents.slice(0, 4).map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 text-cyan-400">{e.time ?? '—'}</span>
                  <span className="text-zinc-300">
                    {e.title} <span className="text-zinc-500">· {e.kind}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Каркас панели эфира/плеера — ТЗ-44 */}
        <section className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500">
          Плеер эфира — в ТЗ-44: запуск по приветствию, очередь по оценке, режимы текст /
          мысли / подкаст
        </section>

        <section className="mt-6 space-y-3">
          {feed.map((item) => (
            <RadioCard
              key={item.id}
              item={item}
              userTagIds={userTagIds}
              tagMap={tagMap}
              isFresh={Boolean(freshIds[item.id])}
              onEntryStart={handleEntryStart}
            />
          ))}
          {feed.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Непрочитанных по вашим темам нет — эфир всё озвучил. Загляните позже.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

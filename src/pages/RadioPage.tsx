/**
 * =============================================================================
 * PULSE — Страница радио (ТЗ-43 каркас + ТЗ-44 UI и голос)
 * =============================================================================
 *
 * Эфир поверх данных ТЗ-43 (лента непрочитанных по тегам + SSE + календарь):
 *   - гость → CTA в модалку логина; юзер без тегов → заглушка «Радио молчит»
 *     + общее саммари (воронка в /portfolio);
 *   - консоль эфира — 10 компонентов components/radio/ (ТЗ-44, порт
 *     прототипа radio-app на тему Pulse);
 *   - запуск эфира: приветствие (время суток, день, настроение, счётчик) →
 *     ближайшее событие календаря → непрочитанные по убыванию score
 *     (лимит 5/8/12 из локального конфига), label «эфир · N из M»;
 *   - фон: SSE-новость → подсветка 4 с + пилик (score ≥ 8.5 — тройной) →
 *     авточтение при blocks.autoRead (юзерская настройка, ТЗ-46; серверного
 *     флага авточтения больше нет — серверный kill-switch радио целиком
 *     radio_service_enabled → заглушка «Радио временно отключено»);
 *   - саммари: «Моё» → /api/user/summary?hours=12, «Рынка» →
 *     /api/user/summary-global (кэш 6 ч, повтор без refresh=1; клиентские
 *     buildPersonalSummary/buildMarketSummary — фолбэк при недоступности LLM);
 *   - прочитанность: начатая карточка = прочитана (включая скип после старта)
 *     через useSpeech.onEntryStart → POST /api/news/:id/read (ТЗ-43).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { useRadioConfig } from '@/hooks/useRadioConfig'
import { useRadioSse } from '@/hooks/useRadioSse'
import { useSpeech } from '@/hooks/useSpeech'
import { useMarket } from '@/hooks/useMarket'
import { useRadioLocalConfig } from '@/hooks/useRadioLocalConfig'
import { fetchUserTags, buildTagMap } from '@/lib/radio/tagMap'
import { adaptPulseToNewsItem } from '@/lib/radio/newsAdapter'
import { adaptCalendarToday, buildCalendarSegments, nextEventLine } from '@/lib/radio/calendarAdapter'
import { getCalendar } from '@/lib/calendarApi'
import { buildGreeting } from '@/lib/radio/greeting'
import { beep, beepCritical, unlockAudio } from '@/lib/radio/sound'
import {
  buildPersonalSummary,
  buildMarketSummary,
  buildQuotesSegments,
  type MarketSummary,
} from '@/lib/radio/summary'
import { Header } from '@/components/radio/Header'
import { TickerBar } from '@/components/radio/TickerBar'
import { Watchlist } from '@/components/radio/Watchlist'
import { NewsFeed } from '@/components/radio/NewsFeed'
import { QueuePanel } from '@/components/radio/QueuePanel'
import { CalendarPanel } from '@/components/radio/CalendarPanel'
import { SummaryBar } from '@/components/radio/SummaryBar'
import { PlayerBar } from '@/components/radio/PlayerBar'
import { SettingsPanel } from '@/components/radio/SettingsPanel'
import { AdminPanel } from '@/components/radio/AdminPanel'
import type { NewsArticle } from '@/types/news'
import type { RadioNewsItem, RadioCalendarEvent, RadioReadMode } from '@/types/radio'

const FRESH_HIGHLIGHT_MS = 4000
const MAX_FEED = 40

function validMode(v: unknown): RadioReadMode {
  return v === 'text' || v === 'reflect' || v === 'podcast' ? v : 'reflect'
}

export default function RadioPage() {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const serverConfig = useRadioConfig()
  const queryClient = useQueryClient()
  const { config, update, toggleBlock, reset } = useRadioLocalConfig()
  const { quotes, live } = useMarket()

  // ─── Теги юзера → tagMap + id-set (стабильные ссылки для SSE) ───
  const { data: userTags = [], isSuccess: tagsLoaded } = useQuery({
    queryKey: ['radio', 'tags'],
    queryFn: fetchUserTags,
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000,
  })
  const tagMap = useMemo(() => buildTagMap(userTags), [userTags])
  const userTagIds = useMemo(() => new Set(userTags.map((t) => t.tag_id)), [userTags])
  const userTagNames = useMemo(() => userTags.map((t) => t.tag_name), [userTags])

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

  // ─── Локальный стейт ленты (ТЗ-43) ───
  const [liveItems, setLiveItems] = useState<RadioNewsItem[]>([])
  const [freshIds, setFreshIds] = useState<Record<string, number>>({})
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set())
  const seenIdsRef = useMemo(() => new Set<string>(), [])
  const [globalSummary, setGlobalSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // ─── Режим эфира на сессию (дефолт — серверный флаг radio_default_mode) ───
  const [modeTouched, setModeTouched] = useState(false)
  const [readMode, setReadModeState] = useState<RadioReadMode>('reflect')
  useEffect(() => {
    if (!modeTouched) setReadModeState(validMode(serverConfig.radio_default_mode))
  }, [serverConfig, modeTouched])
  const setReadMode = useCallback((m: RadioReadMode) => {
    setModeTouched(true)
    setReadModeState(m)
  }, [])
  const [soundOn, setSoundOn] = useState(true)
  const [adminOpen, setAdminOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ─── Саммари рынка (накопление свежих → /api/user/summary-global) ───
  const [freshAcc, setFreshAcc] = useState(0)
  const [market, setMarket] = useState<MarketSummary | null>(null)

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

  const speech = useSpeech({
    onEntryStart: (item) => handleEntryStart(item.id),
    // ТЗ-46: kill-switch сработал на 503 → инвалидируем конфиг, страница
    // перечитает флаги и покажет заглушку «Радио временно отключено»
    onServiceDisabled: () => {
      queryClient.invalidateQueries({ queryKey: ['radio', 'config'] })
    },
    provider: serverConfig.radio_voice_provider,
    minimaxHostVoice: serverConfig.radio_minimax_host_voice,
    minimaxGuestVoice: serverConfig.radio_minimax_guest_voice,
    userTagIds,
    tagMap,
  })

  // свежие настройки для SSE-колбэка (ref-ы, не переподписка)
  const cfgRef = useRef(config)
  cfgRef.current = config
  const serverCfgRef = useRef(serverConfig)
  serverCfgRef.current = serverConfig
  const readModeRef = useRef(readMode)
  readModeRef.current = readMode
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const speechRef = useRef(speech)
  speechRef.current = speech
  const feedRef = useRef<RadioNewsItem[]>([])
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes

  // аудиоконтекст просыпается по первому жесту пользователя
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // ─── SSE: новость по тегам → подсветка + пилик + авточтение (RADIO.md сценарий 2) ───
  const handleSseNews = useCallback(
    (item: RadioNewsItem) => {
      if (seenIdsRef.has(item.id)) return // дедуп (StrictMode dev / повторы)
      seenIdsRef.add(item.id)
      setLiveItems((prev) => [item, ...prev].slice(0, MAX_FEED))
      setFreshIds((prev) => ({ ...prev, [item.id]: Date.now() }))

      if (cfgRef.current.blocks.beep && soundRef.current) {
        if (item.score >= 8.5) beepCritical()
        else beep()
      }

      // свежими считаем только новые сюжеты — перепечатки свежести не добавляют
      if (!item.reprint) setFreshAcc((c) => c + 1)

      // все или ничего: фильтра важности при авточтении нет (осознанное v1)
      // серверный флаг больше не участвует: авточтение — чисто юзерская настройка
      // (blocks.autoRead); серверный kill-switch — radio_service_enabled, ТЗ-46
      if (cfgRef.current.blocks.autoRead) {
        speechRef.current.enqueue(item, 'автоэфир', readModeRef.current)
      }
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

  // ─── Лента: live сверху, дедуп, без прочитанных ───
  const feed = useMemo(() => {
    const liveIds = new Set(liveItems.map((i) => i.id))
    return [...liveItems, ...baseFeed.filter((i) => !liveIds.has(i.id))]
      .filter((i) => !readIds.has(i.id))
      .slice(0, MAX_FEED)
  }, [liveItems, baseFeed, readIds])
  feedRef.current = feed

  // ─── Запуск эфира: приветствие → календарь → непрочитанные по score ───
  const startBroadcast = useCallback(() => {
    unlockAudio()
    speech.stopAll()
    const unread = [...feedRef.current]
      .sort((a, b) => b.score - a.score)
      .slice(0, cfgRef.current.broadcastLimit)
    const calLine = cfgRef.current.blocks.calendar ? nextEventLine(calendarEvents) : ''
    speech.speakCustom('Приветствие', [
      { role: 'single', text: buildGreeting(unread.length) + (calLine ? ` ${calLine}` : '') },
    ])
    unread.forEach((n, i) =>
      speech.enqueue(n, `эфир · ${i + 1} из ${unread.length}`, readModeRef.current)
    )
  }, [speech, calendarEvents])

  // ─── Саммари-кнопки (сценарий 3/5): API первичен, клиентский билдер — фолбэк ───
  const readPersonalSummary = useCallback(() => {
    unlockAudio()
    ;(async () => {
      try {
        const data = (await api.get('/user/summary?hours=12')) as { summary?: string }
        if (data.summary) {
          speech.speakCustom('Персональное саммари', [{ role: 'single', text: data.summary }])
          return
        }
        throw new Error('empty')
      } catch {
        const segs = buildPersonalSummary(
          feedRef.current,
          readIds,
          quotesRef.current,
          cfgRef.current.summaryTopN,
          userTagNames
        )
        speech.speakCustom('Персональное саммари', segs)
      }
    })()
  }, [speech, readIds, userTagNames])

  const readCalendar = useCallback(() => {
    unlockAudio()
    speech.speakCustom('Повестка дня', buildCalendarSegments(calendarEvents))
  }, [speech, calendarEvents])

  const readQuotes = useCallback(() => {
    unlockAudio()
    speech.speakCustom('Котировки наблюдения', buildQuotesSegments(quotesRef.current))
  }, [speech])

  const readMarketSummary = useCallback(() => {
    unlockAudio()
    if (market) {
      speech.speakCustom('Саммари рынка', market.segments)
      return
    }
    ;(async () => {
      try {
        const data = (await api.get('/user/summary-global')) as { summary?: string }
        const next: MarketSummary = {
          id: `ms-${Date.now()}`,
          text: data.summary ?? '',
          segments: data.summary ? [{ role: 'single', text: data.summary }] : [],
          createdAt: Date.now(),
          freshCount: freshAcc,
        }
        setMarket(next)
        if (next.segments.length > 0) speech.speakCustom('Саммари рынка', next.segments)
      } catch {
        // фолбэк: клиентское саммари из ленты (LLM-эндпоинт недоступен)
        const fallback = buildMarketSummary(
          feedRef.current,
          quotesRef.current,
          freshAcc,
          cfgRef.current.threshold
        )
        setMarket(fallback)
        speech.speakCustom('Саммари рынка', fallback.segments)
      }
    })()
  }, [speech, market, freshAcc])

  // порог свежих накоплен → формируем саммари рынка (сброс счётчика, как в прототипе)
  const thresholdMetRef = useRef(false)
  useEffect(() => {
    if (market || freshAcc < config.threshold || thresholdMetRef.current) return
    thresholdMetRef.current = true
    const t = setTimeout(() => {
      readMarketSummary()
      setFreshAcc(0)
      thresholdMetRef.current = false
    }, 300)
    return () => clearTimeout(t)
  }, [freshAcc, market, config.threshold, readMarketSummary])

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

  const freshIdSet = useMemo(() => new Set(Object.keys(freshIds)), [freshIds])
  const queuedIds = useMemo(() => new Set(speech.queue.map((q) => q.item.id)), [speech.queue])

  // ─── Сервис радио выключен админом (kill-switch, ТЗ-46) — ДО веток логина/тегов ───
  if (!serverConfig.radio_service_enabled) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#060606] px-6 text-zinc-100">
        <div className="max-w-md text-center">
          <div className="text-sm font-semibold tracking-widest text-cyan-400">РАДИО</div>
          <h1 className="mt-2 text-2xl font-bold">Радио временно отключено</h1>
          <p className="mt-3 text-zinc-400">
            Мы выключаем эфир на технические работы. Вернёмся в ближайшее время.
          </p>
        </div>
      </div>
    )
  }

  // ─── Гость ───
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#060606] px-6 text-zinc-100">
        <div className="max-w-md text-center">
          <div className="text-sm font-semibold tracking-widest text-cyan-400">РАДИО</div>
          <h1 className="mt-2 text-2xl font-bold">Персональное радио инвестора</h1>
          <p className="mt-3 text-zinc-400">
            Озвучивает ваши непрочитанные новости, объясняет инвестсмысл по вашим темам
            и ведёт через календарь дня. Войдите, чтобы эфир знал ваши интересы.
          </p>
          <button
            onClick={() => openAuthModal('login', { returnUrl: '/radio' })}
            className="mt-6 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-6 py-2 text-cyan-200 hover:bg-cyan-500/30"
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
      <div className="flex min-h-dvh items-center justify-center bg-[#060606] px-6 text-zinc-100">
        <div className="max-w-md text-center">
          <div className="text-sm font-semibold tracking-widest text-cyan-400">РАДИО</div>
          <h1 className="mt-2 text-2xl font-bold">Радио молчит</h1>
          <p className="mt-3 text-zinc-400">
            Потому что не знает ваших интересов. Задайте темы в портфеле — и эфир начнёт
            собирать новости по ним.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              to="/portfolio"
              className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-6 py-2 text-cyan-200 hover:bg-cyan-500/30"
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

  // ─── Консоль эфира ───
  return (
    <div className="flex min-h-dvh flex-col bg-[#060606] text-zinc-100">
      <Header
        onAir={speech.isSpeaking}
        live={live}
        unread={feed.length}
        onAdmin={() => setAdminOpen(true)}
      />
      {config.blocks.ticker && <TickerBar items={feed.slice(0, 12)} />}
      {config.blocks.summary && (
        <SummaryBar
          freshCount={freshAcc}
          threshold={config.threshold}
          setThreshold={(v) => update({ threshold: v })}
          market={market}
          onReadPersonal={readPersonalSummary}
          onReadMarket={readMarketSummary}
          onReadCalendar={readCalendar}
          onReadQuotes={readQuotes}
          onDismissMarket={() => setMarket(null)}
        />
      )}

      <div className="flex flex-1">
        {(config.blocks.watchlist || config.blocks.calendar) && (
          <div className="hidden w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60 lg:flex">
            {config.blocks.watchlist && <Watchlist quotes={quotes} live={live} />}
            {config.blocks.calendar && <CalendarPanel events={calendarEvents} />}
          </div>
        )}
        <NewsFeed
          items={feed}
          freshIds={freshIdSet}
          readIds={readIds}
          speakingId={speech.current?.item.id ?? null}
          queuedIds={queuedIds}
          userTagIds={userTagIds}
          tagMap={tagMap}
          onRead={(item) => {
            unlockAudio()
            speech.enqueue(item, 'по запросу', readMode)
          }}
        />
        {config.blocks.radio && <QueuePanel speech={speech} />}
      </div>

      {feed.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">
          Непрочитанных по вашим темам нет — эфир всё озвучил. Загляните позже.
        </p>
      )}

      {/* нижний плеер — транспорт эфира, прилипает к низу при скролле */}
      <div className="sticky bottom-0">
        <PlayerBar
          speech={speech}
          unreadCount={feed.length}
          onStartBroadcast={startBroadcast}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={serverConfig.radio_voice_provider}
        speech={speech}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        readMode={readMode}
        setReadMode={setReadMode}
      />
      <AdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        config={config}
        update={update}
        toggleBlock={toggleBlock}
        reset={reset}
      />
    </div>
  )
}

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
import { useFinamWatchlist } from '@/hooks/useFinamWatchlist'
import { useRadioLocalConfig } from '@/hooks/useRadioLocalConfig'
import { fetchUserTags, buildTagMap } from '@/lib/radio/tagMap'
import { adaptPulseToNewsItem } from '@/lib/radio/newsAdapter'
import { adaptCalendarToday, buildCalendarSegments } from '@/lib/radio/calendarAdapter'
import { getCalendar } from '@/lib/calendarApi'
import { buildGreeting } from '@/lib/radio/greeting'
import { beep, beepCritical, unlockAudio } from '@/lib/radio/sound'
import {
  buildPersonalSummary,
  buildMarketSummary,
  buildQuotesSegments,
  type MarketSummary,
} from '@/lib/radio/summary'
import { fetchMarketCached } from '@/lib/radio/fetchMarketCached'
import { fetchMarketDialog } from '@/lib/radio/fetchMarketDialog'
import { loadMp3 } from '@/lib/radio/mp3Cache'
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
import type { RadioNewsItem, RadioCalendarEvent, RadioReadMode, RadioSegment } from '@/types/radio'

const FRESH_HIGHLIGHT_MS = 4000
const MAX_FEED = 40
/** ТЗ-47: после запуска эфира авто-поток молчит 30 с (приветствие не перебивается) */
const AUTOREAD_COOLDOWN_MS = 30_000

function validMode(v: unknown): RadioReadMode {
  return v === 'text' || v === 'reflect' || v === 'podcast' ? v : 'reflect'
}

export default function RadioPage() {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const serverConfig = useRadioConfig()
  const queryClient = useQueryClient()
  const { config, update, toggleBlock, reset } = useRadioLocalConfig()
  const watchlist = useFinamWatchlist(isLoggedIn)
  const quotes = watchlist.quotes
  // ТЗ-56: live = данные свежие и онлайн (Finam, не Binance)
  const live = !watchlist.offline && watchlist.lastUpdate !== null

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
    staleTime: 30 * 1000,
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

  // ─── Саммари рынка ───
  // ТЗ-55: два источника. `marketCached` — read-only кэш крона (бесплатно,
  // 0 LLM, обновляется раз в 6ч; доступен с ~3 мин после boot VDS). `marketFresh`
  // — свежий обзор от LLM (1 Kimi-запрос при накоплении порога свежих).
  const [freshAcc, setFreshAcc] = useState(0)
  const [marketCached, setMarketCached] = useState<MarketSummary | null>(null)
  const [marketFresh, setMarketFresh] = useState<MarketSummary | null>(null)
  // ТЗ-57: диалог общей сводки (host+guest, Minimax chat, кэш 6ч на бэке).
  // Стейт здесь (до startBroadcast) — шаг 2 эфира читает его в deps useCallback.
  const [marketDialog, setMarketDialog] = useState<RadioSegment[] | null>(null)

  // ─── Прочитанность: начатая карточка (в т.ч. скип после старта — v1 без opt-out) ───
  // ТЗ-50: после POST /read — дебаунс-инвалидация ['radio','feed'], иначе счётчик
  // «непрочитано» в плеере показывает старое значение из кэша (2 мин staleTime).
  const invalidateFeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFeedInvalidate = useCallback(() => {
    if (invalidateFeedTimerRef.current) clearTimeout(invalidateFeedTimerRef.current)
    invalidateFeedTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['radio', 'feed'] })
    }, 1000)
  }, [queryClient])
  useEffect(
    () => () => {
      if (invalidateFeedTimerRef.current) clearTimeout(invalidateFeedTimerRef.current)
    },
    []
  )
  // ТЗ-50: рефетч ленты при возврате на вкладку — актуальный счётчик
  useEffect(() => {
    const onFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['radio', 'feed'] })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [queryClient])

  const handleEntryStart = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    api
      .post(`/news/${id}/read`, {})
      .then(scheduleFeedInvalidate)
      .catch(() => {
        setReadIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
  }, [scheduleFeedInvalidate])

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
  /** ТЗ-47: метка запуска эфира (кулдаун авто-потока 30 с) */
  const broadcastStartTsRef = useRef(0)
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
      // (blocks.autoRead); серверный kill-switch — radio_service_enabled, ТЗ-46.
      // ТЗ-47: + кулдаун 30 с после ▶ Эфир — приветствие не перебивается
      if (
        cfgRef.current.blocks.autoRead &&
        Date.now() - broadcastStartTsRef.current > AUTOREAD_COOLDOWN_MS
      ) {
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

  // ─── Свежий обзор (ТЗ-55, раньше «саммари рынка»): state marketFresh → speak;
  // иначе LLM-эндпоинт /api/user/summary-global → клиентский фолбэк.
  // ВНИМАНИЕ: только ручной клик «◉ свежий обзор» — в эфире не используется.
  // Guard по segments?.length — при marketFresh с пустыми сегментами рефетч.
  const readMarketSummary = useCallback(async () => {
    unlockAudio()
    if (marketFresh?.segments?.length) {
      speech.speakCustom('Свежий обзор', marketFresh.segments)
      return
    }
    return (async () => {
      try {
        const data = (await api.get('/user/summary-global')) as { summary?: string }
        const next: MarketSummary = {
          id: `ms-${Date.now()}`,
          text: data.summary ?? '',
          segments: data.summary ? [{ role: 'single', text: data.summary }] : [],
          createdAt: Date.now(),
          freshCount: freshAcc,
        }
        setMarketFresh(next)
        if (next.segments.length > 0) speech.speakCustom('Свежий обзор', next.segments)
      } catch {
        // фолбэк: клиентское саммари из ленты (LLM-эндпоинт недоступен)
        const fallback = buildMarketSummary(
          feedRef.current,
          quotesRef.current,
          freshAcc,
          cfgRef.current.threshold
        )
        setMarketFresh(fallback)
        speech.speakCustom('Свежий обзор', fallback.segments)
      }
    })()
  }, [speech, marketFresh, freshAcc])

  // ─── Запуск эфира (ТЗ-53): приветствие → общее саммари → персональное →
  // топ новостей по score → полный календарь. Контекст → личная выжимка →
  // детали → что смотреть дальше. Кнопки саммари/календаря остаются для ручного запроса.
  const startBroadcast = useCallback(async () => {
    // ТЗ-54: защита от race condition на двойное нажатие ▶ эфир — второй
    // клик во время эфира no-op (рестарт доступен через ■ стоп)
    if (speech.isSpeaking) return
    unlockAudio()
    speech.stopAll()
    // ТЗ-47: кулдаун авто-потока после запуска — приветствие и первые новости
    // не перебиваются свежими SSE-новостями (визуал SSE не затрагивается)
    broadcastStartTsRef.current = Date.now()

    const unreadAll = [...feedRef.current].sort((a, b) => b.score - a.score)
    const unreadForNews = unreadAll.slice(0, cfgRef.current.broadcastLimit)

    // 1. Приветствие (без calLine — календарь целиком звучит на шаге 5)
    speech.speakCustom('Приветствие', [
      { role: 'single', text: buildGreeting(unreadForNews.length) },
    ])

    // 2. Общее саммари рынка — ТЗ-57: диалог host+guest (Minimax chat, кэш 6ч
    //    на бэке, префетч в стейте marketDialog). Fallback на plain text кэша
    //    крона, если диалога нет (204 / ошибка / нет MINIMAX_CHAT_MODEL).
    //    Свежий обзор (marketFresh) в эфире НЕ используется — только ручной клик.
    //    Кэша нет (boot < 3 мин) — шаг молчит, остальные идут.
    if (marketCached?.segments?.length) {
      const dialog = marketDialog ?? (await fetchMarketDialog())
      if (dialog && dialog.length > 0) {
        speech.speakCustom('Саммари: диалог', dialog)
      } else {
        speech.speakCustom('Саммари рынка', marketCached.segments)
      }
    }

    // 3. Персональное саммари: API → фолбэк. Без интересов пропускаем —
    //    общее саммари уже сказало «интересы не заданы, главные сюжеты».
    let pickedIds = new Set<string>()
    if (userTagNames.length > 0) {
      try {
        const data = (await api.get('/user/summary?hours=12')) as { summary?: string }
        if (data.summary) {
          speech.speakCustom('Персональное саммари', [{ role: 'single', text: data.summary }])
        } else {
          throw new Error('empty')
        }
      } catch {
        const result = buildPersonalSummary(
          feedRef.current,
          readIds,
          quotesRef.current,
          cfgRef.current.summaryTopN,
          userTagNames
        )
        pickedIds = result.pickedIds
        speech.speakCustom('Персональное саммари', result.segments)
      }
    }

    // 4. Топ непрочитанных по score; новости из персонального саммари
    //    исключаем, чтобы не озвучивать дважды (onEntryStart → POST /read)
    unreadForNews
      .filter((n) => !pickedIds.has(n.id))
      .forEach((n, i, arr) =>
        speech.enqueue(n, `эфир · ${i + 1} из ${arr.length}`, readModeRef.current)
      )

    // 5. Полный календарь
    if (cfgRef.current.blocks.calendar && calendarEvents.length > 0) {
      speech.speakCustom('Повестка дня', buildCalendarSegments(calendarEvents))
    }
  }, [speech, calendarEvents, marketCached, readIds, userTagNames])

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
        const result = buildPersonalSummary(
          feedRef.current,
          readIds,
          quotesRef.current,
          cfgRef.current.summaryTopN,
          userTagNames
        )
        speech.speakCustom('Персональное саммари', result.segments)
      }
    })()
  }, [speech, readIds, userTagNames, marketDialog])

  const readCalendar = useCallback(() => {
    unlockAudio()
    speech.speakCustom('Повестка дня', buildCalendarSegments(calendarEvents))
  }, [speech, calendarEvents])

  const readQuotes = useCallback(() => {
    unlockAudio()
    speech.speakCustom('Котировки наблюдения', buildQuotesSegments(quotesRef.current))
  }, [speech])

  // ТЗ-57: префетч диалога сводки — как только появился кэш крона, дёргаем
  // /api/market/market-dialog (бэк кэширует 6ч, in-flight lock). К запуску
  // эфира диалог уже в стейте — нет паузы 1-3 сек перед озвучкой шага 2.
  // Fallback на plain — в самом шаге 2 эфира.
  useEffect(() => {
    if (marketDialog || !marketCached?.segments?.length) return
    let cancelled = false
    fetchMarketDialog().then((d) => { if (!cancelled) setMarketDialog(d) })
    return () => { cancelled = true }
  }, [marketCached, marketDialog])

  // ТЗ-59, C: префетч mp3 диалога — через 5 сек после появления marketDialog
  // параллельно грузим все сегменты в общий mp3Cache. К моменту ▶ Эфир
  // реплики играют без пауз (TTFB Minimax спрятан в фон). Голоса — из
  // серверного конфига (как у плеера), темп — текущий speech.rate, pitch
  // при одинаковых голосах — как в playback: ключи совпадают, кеш общий.
  const hostVoice = serverConfig.radio_minimax_host_voice || 'presenter_male'
  const guestVoice = serverConfig.radio_minimax_guest_voice || 'presenter_female'
  useEffect(() => {
    if (!marketDialog || marketDialog.length === 0) return
    const timer = setTimeout(() => {
      void Promise.all(
        marketDialog.map((seg) => {
          const voiceId = seg.role === 'guest' ? guestVoice : hostVoice
          const pitch = seg.role === 'guest' && guestVoice === hostVoice ? 2 : 0
          return loadMp3(seg.text, voiceId, speech.rate, pitch).catch(() => null)
        }),
      ).then(() => console.log(`[Radio] prefetched ${marketDialog.length} mp3`))
    }, 5000)
    return () => clearTimeout(timer)
  }, [marketDialog, hostVoice, guestVoice, speech.rate])

  // ─── ТЗ-55: marketCached — read-only кэш крона. Спиннер у кнопки, пока
  // кэш не появился; ретрай каждые 30с, максимум 60 попыток (30 мин) — после
  // этого кнопка остаётся серой и в лог ошибка (защита от бесконечного цикла
  // при сломанном кроне). Cleanup отменяет in-flight запись при unmount.
  useEffect(() => {
    // Гостю кэш недоступен (endpoint под auth) — не ретраим впустую
    if (!isLoggedIn || marketCached !== null) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    const tick = async () => {
      if (cancelled) return
      attempts += 1
      const next = await fetchMarketCached()
      if (cancelled) return
      if (next) {
        setMarketCached(next)
        console.log(`[Radio] marketCached loaded after ${attempts} attempts`)
      } else if (attempts >= 60) {
        console.error(`[Radio] marketCached unavailable after ${attempts} attempts (30 min)`)
      } else {
        timer = setTimeout(tick, 30_000)
      }
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [marketCached, isLoggedIn])

  // порог свежих накоплен → формируем свежий обзор marketFresh (сброс счётчика, как в прототипе)
  const thresholdMetRef = useRef(false)
  useEffect(() => {
    if (marketFresh || freshAcc < config.threshold || thresholdMetRef.current) return
    thresholdMetRef.current = true
    const t = setTimeout(() => {
      readMarketSummary()
      setFreshAcc(0)
      thresholdMetRef.current = false
    }, 300)
    return () => clearTimeout(t)
  }, [freshAcc, marketFresh, config.threshold, readMarketSummary])

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
          marketCached={marketCached}
          marketFresh={marketFresh}
          onReadPersonal={readPersonalSummary}
          onReadMarketCached={() =>
            marketCached && speech.speakCustom('Саммари рынка', marketCached.segments)
          }
          onReadMarketFresh={() =>
            marketFresh && speech.speakCustom('Свежий обзор', marketFresh.segments)
          }
          onReadCalendar={readCalendar}
          onReadQuotes={readQuotes}
          onDismissMarketCached={() => setMarketCached(null)}
          onDismissMarketFresh={() => setMarketFresh(null)}
        />
      )}

      <div className="flex flex-1">
        {(config.blocks.watchlist || config.blocks.calendar) && (
          <div className="hidden w-[240px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60 lg:flex">
            {config.blocks.watchlist && <Watchlist state={watchlist} />}
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
          autoRead={config.blocks.autoRead}
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
        config={config}
        update={update}
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

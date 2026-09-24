/**
 * =============================================================================
 * PULSE — Радио: голосовой движок (ТЗ-44, задача 1)
 * =============================================================================
 *
 * Порт radio-app/src/hooks/useSpeech.ts ЦЕЛИКОМ, с genRef-счётчиком поколений:
 * любой stopAll/скип бампит генерацию; все async-колбэки (fetch .then/.catch,
 * audio.onended/onerror, utterance onend/onerror) с устаревшей генерацией
 * выходят молча. Это фикс бага параллельных аудиопотоков — НЕ упрощать.
 *
 * Отличия от прототипа (по ТЗ-44):
 *   - Minimax-ветка идёт в POST /api/radio/tts через loadMp3() (единый mp3-кеш
 *     префетча/конвейера, ТЗ-59), который внутри оборачивает serverTTS() (ключ
 *     только на сервере, ТЗ-42); minimaxKey/minimaxHostVoice-опций нет — провайдер и
 *     голоса приходят из серверного конфига useRadioConfig();
 *   - 503 tts_not_configured → авто-фолбэк на браузерный SpeechSynthesis,
 *     пометка наружу через minimaxDown (настройки показывают фолбэк);
 *   - 503 radio_service_disabled (ТЗ-46, kill-switch админа) → СТОП эфира БЕЗ
 *     фолбэка + onServiceDisabled (страница инвалидирует useRadioConfig →
 *     заглушка); иначе выключенное радио звучало бы браузерным голосом в обход;
 *   - 502 tts_upstream → сегмент пропускается, очередь продолжается;
 *   - skip = пропуск ВСЕЙ новости (как в прототипе, useSpeech.ts:252–266).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  RadioNewsItem,
  RadioQueueEntry,
  RadioReadMode,
  RadioSegment,
  RadioSpeaker,
  RadioVoiceProvider,
} from '@/types/radio'
import { buildSegments } from '@/lib/radio/scripts'
import { buildReflectReasoning } from '@/lib/radio/buildReflectReasoning'
import { RadioTtsError } from '@/lib/radio/ttsApi'
import { loadMp3 } from '@/lib/radio/mp3Cache'
import type { TagMap } from '@/lib/radio/tagMap'

/** ТЗ-47: hard cap очереди озвучки */
const MAX_QUEUE = 30

function allVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}

function pickByURI(uri: string): SpeechSynthesisVoice | undefined {
  if (uri === 'auto') return undefined
  return allVoices().find((v) => v.voiceURI === uri)
}

function defaultRu(offset: number): SpeechSynthesisVoice | undefined {
  const ru = allVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'))
  if (ru.length > offset) return ru[offset]
  if (ru.length > 0) return ru[0]
  const en = allVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
  return en[offset] ?? en[0] ?? allVoices()[0]
}

export interface SpeechOptions {
  onEntryStart?: (item: RadioNewsItem) => void
  /** ТЗ-46: сервер вернул 503 radio_service_disabled (kill-switch админа) —
   * эфир остановлен без фолбэка; страница должна показать заглушку. */
  onServiceDisabled?: () => void
  /** провайдер из серверного конфига (GET /api/radio/config) */
  provider?: RadioVoiceProvider | string
  /** голоса Minimax из серверного конфига */
  minimaxHostVoice?: string
  minimaxGuestVoice?: string
  /** для режима «мысли»: reasoning строится по цепочке ТЗ-43 */
  userTagIds?: ReadonlySet<string>
  tagMap?: TagMap
}

export function useSpeech(opts?: SpeechOptions) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [hostVoiceURI, setHostVoiceURI] = useState('auto')
  const [guestVoiceURI, setGuestVoiceURI] = useState('auto')
  const [rate, setRate] = useState(1.05)
  const [current, setCurrent] = useState<RadioQueueEntry | null>(null)
  const [currentSpeaker, setCurrentSpeaker] = useState<RadioSpeaker | null>(null)
  const [queue, setQueue] = useState<RadioQueueEntry[]>([])
  const [paused, setPaused] = useState(false)
  /** true — сервер вернул 503 tts_not_configured, эфир живёт на браузерном голосе */
  const [minimaxDown, setMinimaxDown] = useState(false)

  const speakingRef = useRef(false)
  const queueRef = useRef<RadioQueueEntry[]>([])
  const segRef = useRef(0)
  const entryStartedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** поколение сессии: любой стоп/пропуск инвалидирует старые асинхронные колбэки */
  const genRef = useRef(0)
  const minimaxDownRef = useRef(false)
  const refs = useRef({ hostVoiceURI, guestVoiceURI, rate })
  refs.current = { hostVoiceURI, guestVoiceURI, rate }
  const onEntryStartRef = useRef(opts?.onEntryStart)
  onEntryStartRef.current = opts?.onEntryStart
  const onServiceDisabledRef = useRef(opts?.onServiceDisabled)
  onServiceDisabledRef.current = opts?.onServiceDisabled
  const providerRef = useRef<RadioVoiceProvider>(
    opts?.provider === 'minimax' ? 'minimax' : 'browser'
  )
  providerRef.current = opts?.provider === 'minimax' ? 'minimax' : 'browser'
  const minimaxVoicesRef = useRef({
    host: opts?.minimaxHostVoice ?? 'presenter_male',
    guest: opts?.minimaxGuestVoice ?? 'presenter_female',
  })
  minimaxVoicesRef.current = {
    host: opts?.minimaxHostVoice ?? 'presenter_male',
    guest: opts?.minimaxGuestVoice ?? 'presenter_female',
  }
  const reflectCtxRef = useRef({ userTagIds: opts?.userTagIds, tagMap: opts?.tagMap })
  reflectCtxRef.current = { userTagIds: opts?.userTagIds, tagMap: opts?.tagMap }

  useEffect(() => {
    if (!supported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  const voiceFor = useCallback((role: RadioSpeaker): { voice?: SpeechSynthesisVoice; pitch: number } => {
    if (role === 'host') {
      const v = pickByURI(refs.current.hostVoiceURI) ?? defaultRu(0)
      return { voice: v, pitch: 1.0 }
    }
    if (role === 'guest') {
      const v = pickByURI(refs.current.guestVoiceURI) ?? defaultRu(1)
      // если голос один на двоих — различаем тембром
      const host = pickByURI(refs.current.hostVoiceURI) ?? defaultRu(0)
      return { voice: v, pitch: v && host && v.voiceURI === host.voiceURI ? 0.82 : 1.0 }
    }
    return { voice: defaultRu(0), pitch: 1.0 }
  }, [])

  const cancelAudio = useCallback(() => {
    genRef.current += 1 // все взлетевшие запросы/плееры этой сессии — мертвы
    abortRef.current?.abort()
    abortRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  /** браузерный синтез одного сегмента (общий для штатного пути и 503-фолбэка) */
  const speakBrowserSegment = useCallback(
    (seg: RadioSegment, gen: number) => {
      const { voice, pitch } = voiceFor(seg.role)
      const u = new SpeechSynthesisUtterance(seg.text)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      } else {
        u.lang = 'ru-RU'
      }
      u.rate = seg.role === 'guest' ? refs.current.rate * 0.97 : refs.current.rate
      u.pitch = pitch
      const next = () => {
        if (gen !== genRef.current) return
        segRef.current += 1
        speakSegmentRef.current()
      }
      u.onend = next
      u.onerror = next
      window.speechSynthesis.speak(u)
    },
    [voiceFor]
  )

  const speakSegment = useCallback(() => {
    if (!supported && providerRef.current !== 'minimax') return
    const entry = queueRef.current[0] ?? null
    if (!entry) {
      speakingRef.current = false
      setCurrent(null)
      setCurrentSpeaker(null)
      return
    }

    if (!entryStartedRef.current) {
      entryStartedRef.current = true
      onEntryStartRef.current?.(entry.item)
      setCurrent(entry)
    }

    const seg = entry.segments[segRef.current]
    if (!seg) {
      // карточка дочитана — следующая в очереди
      queueRef.current = queueRef.current.slice(1)
      setQueue(queueRef.current)
      segRef.current = 0
      entryStartedRef.current = false
      speakSegment()
      return
    }

    setCurrentSpeaker(seg.role)

    // ТЗ-59, B: конвейер — догрузить следующий сегмент, пока играет текущий.
    // Общий mp3Cache с префетчем (C) — дедупликация автоматическая.
    const mmVoice =
      seg.role === 'guest' ? minimaxVoicesRef.current.guest : minimaxVoicesRef.current.host
    // если на обе роли выбран один голос — различаем тембром (как в playback)
    const mmPitch =
      seg.role === 'guest' && minimaxVoicesRef.current.guest === minimaxVoicesRef.current.host
        ? 2
        : 0
    const nextSeg = (() => {
      const sameEntryNext = entry.segments[segRef.current + 1]
      if (sameEntryNext) return sameEntryNext
      const nextEntry = queueRef.current[1]
      return nextEntry?.segments[0]
    })()
    if (nextSeg) {
      const nextVoice =
        nextSeg.role === 'guest' ? minimaxVoicesRef.current.guest : minimaxVoicesRef.current.host
      const nextPitch =
        nextSeg.role === 'guest' && minimaxVoicesRef.current.guest === minimaxVoicesRef.current.host
          ? 2
          : 0
      loadMp3(nextSeg.text, nextVoice, refs.current.rate, nextPitch).catch((err) => {
        console.warn('[Radio] preload next segment failed:', err?.message ?? err)
      })
    }

    // провайдер Minimax: серверный синтез через прокси, mp3 через fetch
    if (providerRef.current === 'minimax' && !minimaxDownRef.current) {
      const gen = genRef.current
      const ac = new AbortController()
      abortRef.current = ac
      // ТЗ-59: loadMp3 — единый кеш (префетч C + конвейер B): cache hit → 0 мс.
      // Общий промис не обрывается signal — стоп/скиp отбрасывает blob через
      // gen-check ниже (stale generation), см. mp3Cache.ts.
      loadMp3(seg.text, mmVoice, refs.current.rate, mmPitch)
        .then((blob) => {
          if (gen !== genRef.current) return // сессия уже остановлена/перезапущена
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          const next = () => {
            URL.revokeObjectURL(url)
            if (audioRef.current === audio) audioRef.current = null
            if (gen !== genRef.current) return
            segRef.current += 1
            speakSegment()
          }
          audio.onended = next
          audio.onerror = next
          void audio.play().catch(next)
        })
        .catch((err) => {
          if (gen !== genRef.current) return
          if (err instanceof RadioTtsError && err.status === 503) {
            // 503 radio_service_disabled (ТЗ-46, kill-switch админа): НЕ фолбэчим
            // на браузерный голос — иначе выключенное радио продолжит звучать
            // в обход выключателя (кэш фронта 5 мин держит старый флаг).
            // Стоп эфира + сигнал наружу: RadioPage инвалидирует useRadioConfig,
            // перечитает флаги и покажет заглушку «Радио временно отключено».
            if (err.message === 'radio_service_disabled') {
              queueRef.current = []
              setQueue([])
              segRef.current = 0
              entryStartedRef.current = false
              speakingRef.current = false
              cancelAudio()
              setCurrent(null)
              setCurrentSpeaker(null)
              setPaused(false)
              onServiceDisabledRef.current?.()
              return
            }
            // 503 tts_not_configured — ключа Minimax нет на сервере:
            // авто-фолбэк на браузерный голос, эфир не встаёт мёртво;
            // пометка уходит в настройки (minimaxDown)
            minimaxDownRef.current = true
            setMinimaxDown(true)
            providerRef.current = 'browser'
            speakBrowserSegment(seg, gen)
            return
          }
          // 502 tts_upstream и прочее — сегмент пропускаем, очередь продолжается
          segRef.current += 1
          speakSegment()
        })
      return
    }

    // провайдер браузера: speechSynthesis
    const gen = genRef.current
    speakBrowserSegment(seg, gen)
  }, [supported, speakBrowserSegment, cancelAudio])

  // ref-обёртка: speakBrowserSegment колбэком ссылается на speakSegment
  const speakSegmentRef = useRef(speakSegment)
  speakSegmentRef.current = speakSegment

  const enqueue = useCallback(
    (item: RadioNewsItem, label = '', mode: RadioReadMode = 'text') => {
      if (!supported && providerRef.current !== 'minimax') return
      if (queueRef.current.some((q) => q.item.id === item.id)) return
      // ТЗ-47: hard cap очереди — защита от переполнения, если новости встают
      // быстрее, чем юзер слушает (авто-поток / лимит эфира / будущие источники)
      if (queueRef.current.length >= MAX_QUEUE) {
        console.warn(`[Radio] Queue full (${MAX_QUEUE}), dropping ${item.id}`)
        return
      }
      const reflectReasoning = buildReflectReasoning(
        item,
        reflectCtxRef.current.userTagIds ?? new Set<string>(),
        reflectCtxRef.current.tagMap ?? new Map()
      )
      const entry: RadioQueueEntry = {
        id: `q-${item.id}-${Date.now()}`,
        item,
        label,
        segments: buildSegments(item, mode, reflectReasoning),
      }
      queueRef.current = [...queueRef.current, entry]
      setQueue(queueRef.current)
      if (!speakingRef.current) {
        speakingRef.current = true
        segRef.current = 0
        entryStartedRef.current = false
        speakSegment()
      }
    },
    [speakSegment, supported]
  )

  /** озвучить произвольный сценарий (саммари и т.п.) */
  const speakCustom = useCallback(
    (label: string, segments: RadioSegment[]) => {
      if (!supported && providerRef.current !== 'minimax') return
      const pseudo: RadioNewsItem = {
        id: `custom-${Date.now()}`,
        time: '',
        source: 'ЭФИР',
        title: label,
        text: '',
        url: '',
        tags: [],
        score: 10,
        reprint: false,
        sources: [],
        tagImpact: [],
        sentimentReasoning: '',
      }
      const entry: RadioQueueEntry = { id: `q-${pseudo.id}`, item: pseudo, label, segments }
      queueRef.current = [...queueRef.current, entry]
      setQueue(queueRef.current)
      if (!speakingRef.current) {
        speakingRef.current = true
        segRef.current = 0
        entryStartedRef.current = false
        speakSegment()
      }
    },
    [speakSegment, supported]
  )

  const skip = useCallback(() => {
    // выбрасываем текущую карточку целиком
    if (queueRef.current.length > 0) {
      queueRef.current = queueRef.current.slice(1)
      setQueue(queueRef.current)
    }
    segRef.current = 0
    entryStartedRef.current = false
    speakingRef.current = false
    cancelAudio()
    setPaused(false)
    setTimeout(() => {
      speakingRef.current = true
      speakSegment()
    }, 80)
  }, [speakSegment, cancelAudio])

  const stopAll = useCallback(() => {
    queueRef.current = []
    setQueue([])
    segRef.current = 0
    entryStartedRef.current = false
    speakingRef.current = false
    cancelAudio()
    setCurrent(null)
    setCurrentSpeaker(null)
    setPaused(false)
  }, [cancelAudio])

  /** пауза / продолжить — как у классического плеера */
  const togglePause = useCallback(() => {
    if (!current) return
    if (audioRef.current) {
      // minimax: настоящий плеер
      if (audioRef.current.paused) {
        void audioRef.current.play().catch(() => {})
        setPaused(false)
      } else {
        audioRef.current.pause()
        setPaused(true)
      }
      return
    }
    if (supported) {
      // браузерный синтез
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setPaused(false)
      } else if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        setPaused(true)
      }
    }
  }, [current, supported])

  return {
    supported,
    ready: supported || providerRef.current === 'minimax',
    minimaxDown,
    voices,
    hostVoiceURI,
    setHostVoiceURI,
    guestVoiceURI,
    setGuestVoiceURI,
    rate,
    setRate,
    current,
    currentSpeaker,
    queue,
    isSpeaking: current !== null,
    paused,
    togglePause,
    enqueue,
    speakCustom,
    skip,
    stopAll,
  }
}

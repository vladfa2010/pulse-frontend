/**
 * =============================================================================
 * ТЗ-132 — «Слушать»: аудио-озвучка конспекта урока
 * =============================================================================
 *
 * Сегменты текста озвучиваются через POST /api/radio/tts (Minimax, кэш mp3
 * 24ч на бэке), следующий сегмент префетчится, пока играет текущий (паттерн
 * ТЗ-59). Обработка ошибок (контракт ТЗ-132 §2.2):
 *   - 503 tts_not_configured  → прозрачный фолбэк на браузерный SpeechSynthesis;
 *   - 503 radio_service_disabled (kill-switch админа) → disabled=true,
 *     фолбэка НЕТ — снаружи рендерится заглушка «Аудио временно отключено»;
 *   - 502 tts_upstream / сеть → один ретрай, затем onError({kind:'fatal'}) —
 *     снаружи тост «Озвучка недоступна» и возврат в режим «Читать»;
 *   - 429 → onError({kind:'toast'}) «Слишком часто…», режим жив.
 *
 * Автозачёт (дослушал до конца без seek) — onListened. Любой seek/cycleSpeed
 * выставляет seeked → автозачёт в этой сессии отменяется; полное прослушивание
 * с нуля (stop → toggle) снимает флаг.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTtsSegment } from '@/lib/educationApi'

/** Оценка длительности сегмента до факта loadedmetadata (~14 зн/сек с учётом темпа). */
const CHARS_PER_SEC = 14
/** Цикл скоростей из мокапа: 1.0× → 1.25× → 1.5× → 0.75×. */
const SPEED_CYCLE = [1, 1.25, 1.5, 0.75]

export type LessonAudioError =
  | { kind: 'disabled' } // 503 radio_service_disabled — заглушка, без фолбэка
  | { kind: 'fatal'; message: string } // ретрай исчерпан — тост + возврат в «Читать»
  | { kind: 'toast'; message: string } // 429 и прочее — тост, режим жив

export interface LessonAudio {
  playing: boolean
  speed: number
  speedLabel: string
  /** Прослушано секунд (факт + оценка для незагруженных сегментов). */
  cur: number
  /** Общая оценка длительности, уточняется по мере loadedmetadata. */
  total: number
  pct: number
  /** true — сервер без ключа Minimax, говорим браузерным синтезом. */
  browserVoice: boolean
  /** true — kill-switch радио (503 radio_service_disabled): фолбэка НЕТ. */
  disabled: boolean
  toggle: () => void
  cycleSpeed: () => void
  seekByFraction: (f: number) => void
  stop: () => void
}

export function useLessonAudio(opts: {
  lessonId: string
  segments: string[]
  active: boolean // сегмент-режим 'listen' (уход → стоп + сброс сегментов)
  onListened: () => void // дослушал до конца без seek в этой сессии
  onError: (e: LessonAudioError) => void
}): LessonAudio {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [cur, setCur] = useState(0)
  const [total, setTotal] = useState(0)
  const [browserVoice, setBrowserVoice] = useState(false)
  const [disabled, setDisabled] = useState(false)

  const segsRef = useRef(opts.segments)
  segsRef.current = opts.segments
  const speedRef = useRef(speed)
  speedRef.current = speed
  const engineRef = useRef<'server' | 'speech'>('server')
  const idxRef = useRef(0)
  const baseSecRef = useRef(0) // секунды полностью доигранных сегментов
  const curSecRef = useRef(0)
  const durRef = useRef(new Map<string, number>()) // "idx@speed" → duration
  const seekedRef = useRef(false)
  const stoppedRef = useRef(true)
  const startedRef = useRef(false)
  const pausedRef = useRef(false)
  const restartPendingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlsRef = useRef(new Map<string, string>())
  const prefetchRef = useRef(new Map<string, Promise<Blob>>())
  const onListenedRef = useRef(opts.onListened)
  onListenedRef.current = opts.onListened
  const onErrorRef = useRef(opts.onError)
  onErrorRef.current = opts.onError

  const estimate = useCallback((text: string, sp: number) => {
    return Math.max(1, text.length / CHARS_PER_SEC / sp)
  }, [])

  const computeTotal = useCallback(
    (sp: number) =>
      segsRef.current.reduce(
        (s, t, i) => s + (durRef.current.get(`${i}@${sp}`) ?? estimate(t, sp)),
        0,
      ),
    [estimate],
  )

  const syncProgress = useCallback(() => {
    setCur(curSecRef.current)
  }, [])

  // ─── Загрузка сегмента: кэш Promise'ов + один ретрай на 502/сеть ─────────
  const loadBlob = useCallback(
    async (i: number, sp: number): Promise<Blob> => {
      const key = `${i}@${sp}`
      const attempt = async (left: number): Promise<Blob> => {
        let p = prefetchRef.current.get(key)
        if (!p) {
          p = fetchTtsSegment(segsRef.current[i], sp)
          prefetchRef.current.set(key, p)
        }
        try {
          return await p
        } catch (err: any) {
          // 503 (not_configured/disabled) и 429 НЕ ретраим — семантика своя
          if (err?.status === 503 || err?.status === 429) throw err
          prefetchRef.current.delete(key)
          if (left > 0) return attempt(left - 1) // один ретрай (ТЗ-132 §2.2 п.7)
          throw err
        }
      }
      return attempt(1)
    },
    [],
  )

  const stopCurrent = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.onended = null
      a.ontimeupdate = null
      a.onloadedmetadata = null
      a.pause()
      audioRef.current = null
    }
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* SpeechSynthesis может быть недоступен */
    }
  }, [])

  const fail = useCallback(
    (err: any) => {
      const status = err?.status
      const code = err?.message
      stopCurrent()
      stoppedRef.current = true
      startedRef.current = false
      setPlaying(false)
      if (status === 503 && code === 'radio_service_disabled') {
        setDisabled(true)
        onErrorRef.current({ kind: 'disabled' })
      } else if (status === 503 && code === 'tts_not_configured') {
        // Прозрачный фолбэк на браузерный синтез — продолжаем с того же сегмента
        setBrowserVoice(true)
        engineRef.current = 'speech'
        stoppedRef.current = false
        startedRef.current = true
        setPlaying(true)
        speakRef.current(idxRef.current)
      } else if (status === 429) {
        onErrorRef.current({ kind: 'toast', message: 'Слишком часто, попробуйте через минуту' })
      } else {
        onErrorRef.current({ kind: 'fatal', message: 'Озвучка недоступна' })
      }
    },
    [stopCurrent],
  )

  // ─── Браузерный фолбэк (SpeechSynthesis) ─────────────────────────────────
  const speakFrom = useCallback(
    (i: number) => {
      const segs = segsRef.current
      if (stoppedRef.current) return
      if (i >= segs.length) {
        stoppedRef.current = true
        startedRef.current = false
        setPlaying(false)
        curSecRef.current = computeTotal(speedRef.current)
        syncProgress()
        if (!seekedRef.current) onListenedRef.current()
        return
      }
      idxRef.current = i
      const sp = speedRef.current
      const est = estimate(segs[i], sp)
      const u = new SpeechSynthesisUtterance(segs[i])
      u.lang = 'ru-RU'
      u.rate = sp
      const voice = window.speechSynthesis?.getVoices().find(v => v.lang?.toLowerCase().startsWith('ru'))
      if (voice) u.voice = voice
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (e.charIndex == null) return
        curSecRef.current = baseSecRef.current + (e.charIndex / segs[i].length) * est
        syncProgress()
      }
      u.onend = () => {
        if (stoppedRef.current) return
        baseSecRef.current += est
        speakFrom(i + 1)
      }
      u.onerror = () => {
        if (stoppedRef.current) return
        baseSecRef.current += est
        speakFrom(i + 1)
      }
      window.speechSynthesis.speak(u)
    },
    [computeTotal, estimate, syncProgress],
  )
  const speakRef = useRef(speakFrom)
  speakRef.current = speakFrom

  // ─── Серверный движок: цепочка Audio по сегментам ────────────────────────
  const playFrom = useCallback(
    async (i: number) => {
      const segs = segsRef.current
      if (stoppedRef.current) return
      if (i >= segs.length) {
        stoppedRef.current = true
        startedRef.current = false
        setPlaying(false)
        curSecRef.current = computeTotal(speedRef.current)
        syncProgress()
        if (!seekedRef.current) onListenedRef.current()
        return
      }
      idxRef.current = i
      const sp = speedRef.current
      try {
        const blob = await loadBlob(i, sp)
        if (stoppedRef.current) return
        const key = `${i}@${sp}`
        let url = urlsRef.current.get(key)
        if (!url) {
          url = URL.createObjectURL(blob)
          urlsRef.current.set(key, url)
        }
        // Префетч следующего сегмента, пока играет текущий (ТЗ-132 §1.3)
        if (i + 1 < segs.length) void loadBlob(i + 1, sp).catch(() => undefined)
        const a = new Audio(url)
        audioRef.current = a
        a.ontimeupdate = () => {
          curSecRef.current = baseSecRef.current + a.currentTime
          syncProgress()
        }
        a.onloadedmetadata = () => {
          if (Number.isFinite(a.duration)) {
            durRef.current.set(key, a.duration)
            setTotal(computeTotal(sp))
          }
        }
        a.onended = () => {
          const d = durRef.current.get(key) ?? a.duration
          baseSecRef.current += Number.isFinite(d) && d > 0 ? d : estimate(segs[i], sp)
          audioRef.current = null
          void playFrom(i + 1)
        }
        await a.play()
      } catch (err: any) {
        if (stoppedRef.current) return
        if (engineRef.current === 'speech') {
          speakRef.current(idxRef.current)
        } else {
          fail(err)
        }
      }
    },
    [computeTotal, estimate, fail, loadBlob, syncProgress],
  )

  // ─── Публичное API ───────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!segsRef.current.length || disabled) return
    stoppedRef.current = false
    startedRef.current = true
    pausedRef.current = false
    restartPendingRef.current = false
    seekedRef.current = false
    baseSecRef.current = 0
    curSecRef.current = 0
    idxRef.current = 0
    syncProgress()
    setTotal(computeTotal(speedRef.current))
    setPlaying(true)
    if (engineRef.current === 'speech') speakRef.current(0)
    else void playFrom(0)
  }, [computeTotal, disabled, playFrom, syncProgress])

  const toggle = useCallback(() => {
    if (disabled) return
    if (playing) {
      audioRef.current?.pause()
      try {
        window.speechSynthesis?.pause()
      } catch {
        /* нет speechSynthesis */
      }
      pausedRef.current = true
      setPlaying(false)
      return
    }
    if (!startedRef.current || stoppedRef.current) {
      start()
      return
    }
    pausedRef.current = false
    setPlaying(true)
    if (restartPendingRef.current) {
      // Скорость меняли на паузе — перезапускаем текущий сегмент с новым speed
      restartPendingRef.current = false
      stopCurrent()
      if (engineRef.current === 'speech') speakRef.current(idxRef.current)
      else void playFrom(idxRef.current)
      return
    }
    if (engineRef.current === 'speech') {
      try {
        window.speechSynthesis?.resume()
      } catch {
        /* нет speechSynthesis */
      }
    } else if (audioRef.current) {
      void audioRef.current.play().catch(() => undefined)
    } else {
      // сегмент умер без стейта — продолжаем с текущего индекса
      void playFrom(idxRef.current)
    }
  }, [disabled, playing, start, stopCurrent, playFrom])

  const cycleSpeed = useCallback(() => {
    const next = SPEED_CYCLE[(SPEED_CYCLE.indexOf(speedRef.current) + 1) % SPEED_CYCLE.length]
    speedRef.current = next
    setSpeed(next)
    // Смена темпа = seek: автозачёт этой сессии отменяется (ТЗ-132 Задача 4)
    seekedRef.current = true
    setTotal(computeTotal(next))
    if (!startedRef.current || stoppedRef.current) return
    if (pausedRef.current) {
      restartPendingRef.current = true
      return
    }
    // На лету: перезапрос текущего сегмента с новым speed (cache miss осознан)
    stopCurrent()
    if (engineRef.current === 'speech') speakRef.current(idxRef.current)
    else void playFrom(idxRef.current)
  }, [computeTotal, playFrom, stopCurrent])

  const seekByFraction = useCallback(
    (f: number) => {
      const segs = segsRef.current
      if (!segs.length) return
      const clamped = Math.min(1, Math.max(0, f))
      // Индекс сегмента — по доле суммарных символов (ТЗ-132 §2.2 п.5)
      const totalChars = segs.reduce((s, t) => s + t.length, 0)
      const target = clamped * totalChars
      let acc = 0
      let idx = segs.length - 1
      for (let i = 0; i < segs.length; i++) {
        if (acc + segs[i].length >= target) {
          idx = i
          break
        }
        acc += segs[i].length
      }
      seekedRef.current = true // seek сбрасывает право на автозачёт
      const sp = speedRef.current
      stopCurrent()
      baseSecRef.current = segs
        .slice(0, idx)
        .reduce((s, t, i) => s + (durRef.current.get(`${i}@${sp}`) ?? estimate(t, sp)), 0)
      curSecRef.current = baseSecRef.current
      syncProgress()
      stoppedRef.current = false
      startedRef.current = true
      pausedRef.current = false
      setPlaying(true)
      if (engineRef.current === 'speech') speakRef.current(idx)
      else void playFrom(idx)
    },
    [estimate, playFrom, stopCurrent, syncProgress],
  )

  const stop = useCallback(() => {
    stoppedRef.current = true
    startedRef.current = false
    pausedRef.current = false
    restartPendingRef.current = false
    stopCurrent()
    setPlaying(false)
    // Сегменты в памяти сбрасываются (ТЗ-132 Задача 1: возврат в «Читать»)
    for (const u of urlsRef.current.values()) URL.revokeObjectURL(u)
    urlsRef.current.clear()
    prefetchRef.current.clear()
    durRef.current.clear()
    baseSecRef.current = 0
    curSecRef.current = 0
    idxRef.current = 0
    seekedRef.current = false // повторное прослушивание с нуля снимает флаг
    syncProgress()
  }, [stopCurrent, syncProgress])

  // Уход из режима «Слушать» → стоп + сброс (Задача 1)
  useEffect(() => {
    if (!opts.active) stop()
  }, [opts.active, stop])

  // Смена урока → полный сброс состояния
  useEffect(() => {
    stop()
    setBrowserVoice(false)
    setDisabled(false)
    setSpeed(1)
    speedRef.current = 1
    engineRef.current = 'server'
    setTotal(0)
  }, [opts.lessonId, stop])

  // Размонтирование → стоп
  useEffect(() => stop, [stop])

  return {
    playing,
    speed,
    speedLabel: `${speed}×`,
    cur,
    total,
    pct: total > 0 ? Math.min(100, (cur / total) * 100) : 0,
    browserVoice,
    disabled,
    toggle,
    cycleSpeed,
    seekByFraction,
    stop,
  }
}

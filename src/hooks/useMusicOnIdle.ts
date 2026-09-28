/**
 * PULSE — Радио: фоновая музыка в «тишине» эфира (TZ70).
 *
 * Триггер (все условия сразу):
 *   - enabled = adminFlag (radio_flags.music_enabled) && userFlag (localStorage)
 *   - !isSpeaking — нет активного TTS (эфир, интро-фраза, карточка)
 *   - unreadCount === 0 — юзер прочитал всё
 *
 * Сценарий: fetch /api/radio/music/next → { url: null } → тишина (БЕЗ фразы,
 * никаких следов функционала). Трек есть → один раз за idle-сессию фраза
 * ведущего (speakCustom, голос minimax_host_voice на бэке) → <audio>.play().
 * Трек доиграл → следующий (без фразы). Прерывание (пришла новость / старт
 * эфира / флаг выключен) → fade-out volume 1.5 с, затем pause.
 *
 * Без WebAudio API: один <audio> элемент, последовательное воспроизведение
 * (TTS или музыка, не одновременно). Прерывание на новой новости НЕ трёт
 * unreadCount и не запускает TTS — только глушит музыку.
 *
 * Deps эффекта сужены до isSpeaking/speakCustom — весь объект speech в deps
 * перезапускал бы эффект на каждый рендер контекста (аудит ревизии v1.1).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSpeechContext } from '@/contexts/SpeechContext'
import { useUnreadCount } from '@/contexts/UnreadCountContext'
import { useRadioConfig } from '@/hooks/useRadioConfig'
import { useMusicUserFlag } from '@/lib/radio/musicUserFlag'
import { api } from '@/lib/api'
import { MUSIC_INTRO_PHRASES, MUSIC_FADE_OUT_MS } from '@/lib/radio/config'

interface MusicNextResponse {
  url: string | null
  title?: string
  year?: number
  tempo?: string
  genre?: string
}

/** Плавное затухание volume за MUSIC_FADE_OUT_MS (30 шагов по 50 мс). */
function fadeOut(audio: HTMLAudioElement, onDone: () => void): void {
  const STEP_MS = 50
  const STEPS = Math.max(1, Math.ceil(MUSIC_FADE_OUT_MS / STEP_MS))
  const step = 1 / STEPS
  let current = audio.volume
  const interval = setInterval(() => {
    current -= step
    if (current <= 0) {
      audio.volume = 0
      audio.pause()
      clearInterval(interval)
      onDone()
    } else {
      audio.volume = current
    }
  }, STEP_MS)
}

export interface MusicOnIdleState {
  isPlaying: boolean
  currentTrackTitle: string | null
}

export function useMusicOnIdle(): MusicOnIdleState {
  const speech = useSpeechContext()
  const { unreadCount } = useUnreadCount()
  const radioConfig = useRadioConfig()
  const userFlag = useMusicUserFlag()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string | null>(null)
  /** Фраза ведущего звучит один раз за idle-сессию (не между треками). */
  const introPlayedRef = useRef(false)

  const { isSpeaking, speakCustom } = speech
  const adminFlag = radioConfig.radio_music_enabled
  const enabled = adminFlag && userFlag

  // Единожды создаём <audio>. preload='none' — не тянем файл до явного src.
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audio.onended = () => {
      setIsPlaying(false)
      setCurrentTrackTitle(null)
    }
    audio.onerror = () => {
      setIsPlaying(false)
      setCurrentTrackTitle(null)
    }
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  // Прерывание: fade-out → pause. Сброс intro — чтобы новая idle-сессия
  // началась снова с фразы ведущего.
  const interrupt = useCallback((resetIntro: boolean) => {
    if (resetIntro) introPlayedRef.current = false
    const audio = audioRef.current
    if (!audio || audio.paused) {
      setIsPlaying(false)
      setCurrentTrackTitle(null)
      return
    }
    fadeOut(audio, () => {
      setIsPlaying(false)
      setCurrentTrackTitle(null)
    })
  }, [])

  // Главный эффект idle-детекции
  useEffect(() => {
    const idle = !isSpeaking && unreadCount === 0

    if (!enabled || !idle) {
      // Сессия прервана — следующая начнётся снова с интро-фразы
      if (isPlaying) interrupt(true)
      if (!idle) introPlayedRef.current = false
      return
    }

    if (isPlaying) return // трек уже звучит — не дёргаемся

    let cancelled = false
    ;(async () => {
      try {
        const data = (await api.get('/radio/music/next')) as MusicNextResponse
        if (cancelled) return
        if (!data?.url) return // пустая папка → тишина, БЕЗ фразы ( graceful )

        if (!introPlayedRef.current) {
          introPlayedRef.current = true
          // Голос фразы — minimax_host_voice (Михаил), как все speakCustom-блоки.
          // Эффект перезапустится, когда isSpeaking станет false после фразы.
          speakCustom('Музыкальная пауза', [
            { role: 'single', text: MUSIC_INTRO_PHRASES[Math.floor(Math.random() * MUSIC_INTRO_PHRASES.length)] },
          ])
          return
        }

        const audio = audioRef.current
        if (!audio) return
        audio.volume = 1.0
        audio.src = data.url
        await audio.play()
        if (!cancelled) {
          setIsPlaying(true)
          setCurrentTrackTitle(data.title || null)
        }
      } catch {
        // autoplay policy, сеть, нет треков — тихо, эфир не ломаем
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, isSpeaking, unreadCount, isPlaying, speakCustom, interrupt])

  return { isPlaying, currentTrackTitle }
}

export default useMusicOnIdle

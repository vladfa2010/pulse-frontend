/**
 * PULSE — Радио: фоновая музыка в «тишине» эфира (TZ70, WebAudio в TZ71).
 *
 * Триггер (все условия сразу):
 *   - enabled = adminFlag (radio_flags.music_enabled) && userFlag (localStorage)
 *   - !isSpeaking — нет активного TTS (эфир, интро-фраза, карточка)
 *   - queue.length === 0 — в очереди эфира ничего не висит (TZ-73: раньше
 *     смотрели на unreadCount, который никогда не сбрасывался после
 *     прослушивания → музыка не запускалась никогда)
 *   - !userStopped — юзер НЕ нажимал ■ стоп (TZ-75: «стоп значит стоп» —
 *     музыка играет только после ЕСТЕСТВЕННОГО окончания эфира; ручной стоп
 *     = тишина, пока юзер снова явно что-то не запустит)
 *
 * Сценарий: fetch /api/radio/music/next → { url: null } → тишина (БЕЗ фразы,
 * никаких следов функционала). Трек есть → один раз за idle-сессию фраза
 * ведущего (speakCustom, голос minimax_host_voice на бэке) → play().
 * Трек доиграл → следующий (без фразы). Прерывание (пришла новость / старт
 * эфира / флаг выключен) → fade-out gain 1.5 с (sample-precise, TZ71), pause.
 *
 * TZ71: единый WebAudio pipeline (services/audioContext.ts) — музыка идёт
 * через musicGain (default 0.3), а не через audio.volume. Прерывание НЕ
 * сбрасывает src/currentTime: возврат в idle → resume того же трека с того
 * же места (fade-in 3 с), новый fetch только при естественном окончании.
 *
 * Прерывание на новой новости не запускает TTS — только глушит музыку.
 * Появление РЕАЛЬНЫХ новостей в queue (entry с item.id не 'custom-...') сбрасывает
 * introPlayedRef: после прочтения новостей idle-сессия музыки начнётся заново
 * с интро-фразы. Собственная интро-фраза (speakCustom, id 'custom-...') в
 * очереди лежит тоже — на неё сброс не реагирует, иначе фраза зацикливалась бы.
 *
 * Deps эффекта: enabled/isSpeaking/queue/userStopped/speakCustom/interrupt —
 * весь объект speech в deps перезапускал бы эффект на каждый рендер контекста
 * (аудит ревизии v1.1; TZ-73 добавил queue вместо unreadCount, TZ-75 — userStopped).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSpeechContext } from '@/contexts/SpeechContext'
import { useRadioConfig } from '@/hooks/useRadioConfig'
import { useAudioContext } from '@/contexts/AudioContextContext'
import { useMusicUserFlag } from '@/lib/radio/musicUserFlag'
import { api } from '@/lib/api'
import {
  getMusicElement,
  fadeOutMusic,
  fadeInMusic,
  stopMusicGain,
} from '@/services/audioContext'
import { MUSIC_INTRO_PHRASES } from '@/lib/radio/config'

interface MusicNextResponse {
  url: string | null
  title?: string
  year?: number
  tempo?: string
  genre?: string
}

export interface MusicOnIdleState {
  isPlaying: boolean
  currentTrackTitle: string | null
}

export function useMusicOnIdle(): MusicOnIdleState {
  const speech = useSpeechContext()
  const radioConfig = useRadioConfig()
  const userFlag = useMusicUserFlag()
  const { ready: audioReady } = useAudioContext()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string | null>(null)
  /** Фраза ведущего звучит один раз за idle-сессию (не между треками). */
  const introPlayedRef = useRef(false)
  /** Прерывание оставило src/currentTime нетронутыми — resume, а не новый fetch. */
  const resumePendingRef = useRef(false)

  const { isSpeaking, queue, speakCustom, userStopped } = speech
  const adminFlag = radioConfig.radio_music_enabled
  const enabled = adminFlag && userFlag

  // Единожды создаём <audio> канала music (подключён к musicGain в singleton).
  // preload='none' — не тянем файл до явного src.
  useEffect(() => {
    if (!audioReady) return
    const audio = getMusicElement()
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
      audioRef.current = null
    }
  }, [audioReady])

  // Прерывание: fade-out gain → pause. src и currentTime НЕ трём — resume
  // того же треда с того же места при возврате в idle (TZ71, решение #9/#10).
  const interrupt = useCallback((resetIntro: boolean) => {
    if (resetIntro) introPlayedRef.current = false
    const audio = audioRef.current
    if (!audio || audio.paused) {
      stopMusicGain()
      setIsPlaying(false)
      setCurrentTrackTitle(null)
      return
    }
    resumePendingRef.current = true
    fadeOutMusic(() => {
      audio.pause()
      setIsPlaying(false)
      setCurrentTrackTitle(null)
    })
  }, [])

  // Главный эффект idle-детекции
  useEffect(() => {
    // TZ-73 S-1: idle = в эфире ничего не звучит и ничего не ждёт в очереди.
    // NB: собственная интро-фраза ТОЖЕ лежит в queue (speakCustom), поэтому
    // «новости в очереди» определяем по item.id, а не по длине queue —
    // иначе фраза сама себя перезапускала бы по кругу.
    // TZ-75: явный ■ стоп юзером — НЕ idle. «Стоп значит стоп»: музыка
    // играет только после ЕСТЕСТВЕННОГО окончания эфира, не после ручного стопа.
    const idle = !isSpeaking && queue.length === 0 && !userStopped
    const hasNews = queue.some((e) => !e.item.id.startsWith('custom-'))

    if (!enabled || !idle) {
      if (isPlaying) interrupt(true)
      // Интро-флаг сбрасываем ТОЛЬКО когда в очереди появились РЕАЛЬНЫЕ новости
      // (hasNews) или музыка выключена. Сброс по !isSpeaking дал бы цикл:
      // фраза говорит → isSpeaking=true → сброс → фраза снова…
      if (!enabled || hasNews) introPlayedRef.current = false
      return
    }

    if (isPlaying) return // трек уже звучит — не дёргаемся

    const audio = audioRef.current
    if (!audio) return

    // Resume после прерывания: тот же трек с того же места, fade-in 3 с
    if (resumePendingRef.current && audio.src) {
      resumePendingRef.current = false
      let cancelled = false
      fadeInMusic()
      audio.play()
        .then(() => {
          if (!cancelled) setIsPlaying(true)
        })
        .catch((err: any) => {
          // TZ-73 S-2: autoplay policy — предупреждаем в консоли, юзер увидит причину
          if (err?.name === 'NotAllowedError') {
            console.warn('[Music] resume blocked — autoplay policy. Нужен user gesture (клик/клавиша).')
          } else {
            console.error('[Music] resume failed:', err)
          }
        })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    ;(async () => {
      try {
        const data = (await api.get('/radio/music/next')) as MusicNextResponse
        if (cancelled) return
        if (!data?.url) {
          // TZ-73 S-2: пустая папка — тишина, но с diagnóstикой в консоли
          console.warn(
            '[Music] /api/radio/music/next → url: null. ' +
            'Возможные причины: папка /opt/pulse/music/ пуста или admin flag = false. ' +
            'Проверьте: админ-таб Radio → Music Library.'
          )
          return
        }

        if (!introPlayedRef.current) {
          introPlayedRef.current = true
          // Голос фразы — minimax_host_voice (Михаил), как все speakCustom-блоки.
          // Эффект перезапустится, когда isSpeaking станет false после фразы;
          // интро-флаг НЕ сбрасываем (queue пуста — это не новости, а наша фраза).
          speakCustom('Музыкальная пауза', [
            { role: 'single', text: MUSIC_INTRO_PHRASES[Math.floor(Math.random() * MUSIC_INTRO_PHRASES.length)] },
          ])
          return
        }

        fadeInMusic() // gain мог остаться на 0 после жёсткой остановки
        audio.src = data.url
        await audio.play().catch((err: any) => {
          if (err?.name === 'NotAllowedError') {
            console.warn(
              '[Music] audio.play() blocked — autoplay policy. ' +
              'Нужен user gesture (клик/клавиша/касание); музыка запустится после первого взаимодействия.'
            )
          } else {
            console.error('[Music] play() неожиданная ошибка:', err)
          }
        })
        if (!cancelled) {
          setIsPlaying(true)
          setCurrentTrackTitle(data.title || null)
        }
      } catch (err: any) {
        // TZ-73 S-2: сеть/бэк — логируем, эфир не ломаем
        console.error('[Music] idle-запуск музыки не удался:', err?.message || err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, isSpeaking, queue, userStopped, isPlaying, speakCustom, interrupt])

  return { isPlaying, currentTrackTitle }
}

export default useMusicOnIdle

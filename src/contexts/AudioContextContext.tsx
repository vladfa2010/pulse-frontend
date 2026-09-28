/**
 * PULSE — Радио: провайдер общего AudioContext (TZ71).
 *
 * Лениво будит singleton AudioContext по первому user gesture
 * (click/keydown/touchstart) и на возврате вкладки (visibilitychange) —
 * Chrome суспендит AudioContext в фоновых вкладках. До gesture контекст
 * либо ещё не создан (hasAudio() === false), либо suspended — звука не будет
 * в любом случае до вмешательства пользователя (autoplay policy).
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { ensureAudio, hasAudio, resumeAudio } from '@/services/audioContext'

interface AudioContextValue {
  /** Контекст создан. Элементы каналов можно создавать; звук пойдёт после
   *  первого gesture (провайдер сам зовёт resumeAudio). */
  ready: boolean
}

const Ctx = createContext<AudioContextValue>({ ready: false })

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(hasAudio())

  useEffect(() => {
    const wake = () => {
      try {
        ensureAudio()
        resumeAudio()
      } catch {
        // AudioContext не поддерживается — радио молча без звука
      }
      setReady(true)
    }
    window.addEventListener('click', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeAudio()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('click', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <Ctx.Provider value={{ ready }}>{children}</Ctx.Provider>
}

export function useAudioContext(): AudioContextValue {
  return useContext(Ctx)
}

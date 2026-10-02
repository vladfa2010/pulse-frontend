/**
 * PULSE — Радио: контекст фоновой музыки (ТЗ-51, задачи 2-3).
 *
 * useMusicOnIdle держит единственный экземпляр (singleton-аудио + idle-эффект)
 * — вызывать его в нескольких компонентах нельзя (двойной fetch /radio/music/next
 * и двойная интро-фраза). Поэтому: единственный вызов — в MusicProvider
 * (монтируется в App вместо старого MusicOnIdleWrapper), а RadioPage и
 * PlayerBar берут состояние через useMusic(). Канал аудио один, зеркал
 * состояния нет — глобальный плеер и ♪ на /radio видят одно и то же.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useMusicOnIdle, type MusicOnIdleState } from '@/hooks/useMusicOnIdle'

const MusicContext = createContext<MusicOnIdleState | null>(null)

export function MusicProvider({ children }: { children?: ReactNode }) {
  const music = useMusicOnIdle()
  return <MusicContext.Provider value={music}>{children ?? null}</MusicContext.Provider>
}

/** Состояние фоновой музыки. Только внутри MusicProvider (App.tsx). */
export function useMusic(): MusicOnIdleState {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic must be used within MusicProvider (App.tsx)')
  return ctx
}

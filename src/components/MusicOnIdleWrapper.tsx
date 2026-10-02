/**
 * PULSE — Радио: провайдер фоновой музыки (TZ70 + ТЗ-51).
 *
 * Монтируется в App.tsx ОБОРАЧИВАЯ Layout (провайдер = предок консьюмеров,
 * ТЗ-51: sibling-провайдер контекст не отдаёт — RadioPage/useMusic упал).
 * Сам ничего не рендерит — музыка звучит через <audio> внутри useMusicOnIdle,
 * состояние отдаётся в MusicContext (RadioPage / PlayerBar, ТЗ-51).
 * Глобально (все страницы, не только /radio): дух ТЗ-67 «слушать и изучать
 * платформу». Условия и прерывания — в useMusicOnIdle.
 */
import type { ReactNode } from 'react'
import { MusicProvider } from '@/contexts/MusicContext'

export function MusicOnIdleWrapper({ children }: { children?: ReactNode }) {
  return <MusicProvider>{children}</MusicProvider>
}

export default MusicOnIdleWrapper

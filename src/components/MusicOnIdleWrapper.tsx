/**
 * PULSE — Радио: провайдер фоновой музыки (TZ70 + ТЗ-51).
 *
 * Монтируется в App.tsx sibling'ом к GlobalPlayerBar внутри <SpeechProvider>.
 * Сам ничего не рендерит — музыка звучит через <audio> внутри useMusicOnIdle,
 * состояние отдаётся в MusicContext (RadioPage / PlayerBar, ТЗ-51).
 * Глобально (все страницы, не только /radio): дух ТЗ-67 «слушать и изучать
 * платформу». Условия и прерывания — в useMusicOnIdle.
 */
import { MusicProvider } from '@/contexts/MusicContext'

export function MusicOnIdleWrapper() {
  return <MusicProvider />
}

export default MusicOnIdleWrapper

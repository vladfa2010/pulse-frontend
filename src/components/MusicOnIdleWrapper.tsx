/**
 * PULSE — Радио: тонкий wrapper фоновой музыки (TZ70).
 *
 * Монтируется в App.tsx sibling'ом к GlobalPlayerBar внутри <SpeechProvider>.
 * Сам ничего не рендерит — музыка звучит через <audio> внутри useMusicOnIdle.
 * Глобально (все страницы, не только /radio): дух ТЗ-67 «слушать и изучать
 * платформу». Условия и прерывания — в useMusicOnIdle.
 */
import { useMusicOnIdle } from '@/hooks/useMusicOnIdle'

export function MusicOnIdleWrapper() {
  useMusicOnIdle()
  return null
}

export default MusicOnIdleWrapper

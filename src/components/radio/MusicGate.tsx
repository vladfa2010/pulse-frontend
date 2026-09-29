/**
 * PULSE — Радио: MusicGate (TZ-73 S-3).
 *
 * Пока AudioContext не разблокирован пользователем (autoplay policy), любой
 * звук на странице заблокирован — юзер не понимает почему тишина. Обёртка
 * резюмит AudioContext по любому клику внутри себя (onClickCapture — сработает
 * даже если внутренняя кнопка делает stopPropagation) и показывает мини-подсказку
 * «🔇 КЛИК → ВКЛЮЧИТЬ», пока контекст не готов.
 *
 * В отличие от черновика ТЗ, НЕ останавливаем всплытие клика: пробуждение
 * аудио не должно ломать штатные действия плеера (клик по свободному месту
 * по-прежнему ведёт на /radio, а заодно будит контекст).
 */
import type { ReactNode, MouseEvent } from 'react'
import { useAudioContext } from '@/contexts/AudioContextContext'
import { resumeAudio } from '@/services/audioContext'

interface MusicGateProps {
  children: ReactNode
  /** Показывать ли подсказку, пока контекст не готов. Default true. */
  showHint?: boolean
}

export function MusicGate({ children, showHint = true }: MusicGateProps) {
  const { ready } = useAudioContext()

  const handleCaptureClick = (_e: MouseEvent) => {
    if (!ready) {
      try {
        resumeAudio()
      } catch {
        // AudioContext не поддерживается — молча, как в провайдере
      }
    }
  }

  return (
    <div
      onClickCapture={handleCaptureClick}
      style={{ position: 'relative', display: 'contents' }}
    >
      {children}
      {!ready && showHint && (
        <span
          title="Браузер заблокировал автовоспроизведение — кликните в любом месте, чтобы включить звук"
          style={{
            position: 'fixed',
            // Чуть выше плеера (плеер: bottom 16px + safe-area, высота ~52px)
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#F59E0B',
            background: 'rgba(24,24,27,0.9)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 4,
            padding: '2px 8px',
            pointerEvents: 'none',
            zIndex: 51,
            fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
          }}
        >
          🔇 КЛИК → ЗВУК
        </span>
      )}
    </div>
  )
}

export default MusicGate

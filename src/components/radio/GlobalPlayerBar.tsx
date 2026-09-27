/**
 * PULSE — Глобальный мини-плеер (ТЗ-67).
 *
 * Рендерится в App.tsx после <AppRoutes />. На /radio НЕ рендерится — там
 * уже есть legacy PlayerBar встроенный в страницу. На других страницах
 * плеер «прилипает» к низу экрана с момента первого ▶ на /radio и до явного
 * клика на ✕. После ■ (стоп) или ⏸ (пауза) плеер остаётся видимым — только
 * меняет состояние внутри (IDLE / ПАУЗА / ON AIR).
 *
 * Видимость: плеер появляется после ПЕРВОГО запуска эфира (isSpeaking/paused/
 * current), а не сразу — иначе каждый посетитель увидел бы IDLE-плашку
 * «Эфир остановлен» на всех страницах (нестыковка жизненного цикла в ТЗ).
 * dismissed сбрасывается при старте нового эфира — «вернуть плеер = новый ▶
 * на /radio» из ТЗ работает.
 *
 * Состояния:
 *  - ON AIR  — isSpeaking && !paused, cyan эквалайзер анимируется
 *  - ПАУЗА   — paused, cyan эквалайзер animationPlayState: paused
 *  - IDLE    — после ■, серый эквалайзер, «Эфир остановлен»
 *  - Скрыт   — dismissed=true (юзер нажал ✕)
 *
 * Цвета: cyan #22d3ee = фирменный (бренд), red #f87171 = семантика (on-air),
 * yellow #facc15 = пауза, zinc = нейтраль.
 */
import { useEffect, useState } from 'react'
import { useSpeechContext } from '@/contexts/SpeechContext'
import { useLocation, useNavigate } from 'react-router'
import { shareText } from '@/lib/radio/share'

const SPEAKER_LABEL: Record<string, { text: string; color: string }> = {
  host: { text: 'ВЕДУЩИЙ', color: '#f87171' },
  guest: { text: 'АНАЛИТИК', color: '#22d3ee' },
  single: { text: 'ДИКТОР', color: '#22d3ee' },
}

export function GlobalPlayerBar() {
  const speech = useSpeechContext()
  const location = useLocation()
  const navigate = useNavigate()
  const isRadioPage = location.pathname === '/radio'

  // Локальный state: единственный способ закрыть плеер — клик на ✕.
  // Сбрасывается при старте нового эфира (см. эффект ниже) — «вернуть плеер =
  // новый ▶ на /radio» (ТЗ-67).
  const [dismissed, setDismissed] = useState(false)
  // Шеринг: 'idle' | 'copied' — на 1.8s показываем зелёный ✓
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

  // Новый запуск эфира (■ → ▶ на /radio) возвращает плеер, даже если юзер
  // закрывал его ✕ раньше. Срабатывает на 0→1 переходе isSpeaking.
  useEffect(() => {
    if (speech.isSpeaking) setDismissed(false)
  }, [speech.isSpeaking])

  // Риск Р2 ТЗ-67: floating плеер перекрывает контент внизу — добавляем
  // отступ body, пока плеер виден.
  const everStarted = speech.isSpeaking || speech.paused || speech.current !== null
  useEffect(() => {
    if (isRadioPage || dismissed || !everStarted) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = '80px'
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [isRadioPage, dismissed, everStarted])

  // На /radio плеер встроен в страницу через legacy PlayerBar.
  // GlobalPlayerBar не рендерится чтобы не дублировать floating + встроенный.
  if (isRadioPage) return null

  // Плеер живёт после первого запуска эфира и до явного ✕. До первого ▶ не
  // показываем IDLE-плашку (иначе она висела бы у каждого посетителя).
  if (dismissed || !everStarted) return null

  const speaker = speech.currentSpeaker ? SPEAKER_LABEL[speech.currentSpeaker] : null

  // Шеринг: системное меню или копирование в буфер (как в legacy PlayerBar).
  const handleShare = async () => {
    const r = await shareText(
      'Радио PULSE — персональный эфир новостей',
      `Слушаю персональное радио новостей: эфир собирается из свежей ленты в моменте и читается голосом.${
        speech.current ? `\n\nСейчас в эфире: «${speech.current.item.title}»` : ''
      }`
    )
    if (r === 'copied') {
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 1800)
    }
  }

  // IDLE → навигация на /radio. Сборка очереди (приветствие → саммари →
  // новости → календарь) живёт только в RadioPage.startBroadcast callback —
  // useSpeech не имеет метода startBroadcast. Юзер нажмёт ▶ эфир на /radio.
  const handleLaunchFromIdle = () => navigate('/radio')

  // Клик по свободному месту плеера → открыть полный плеер на /radio
  // (UX Spotify/YouTube Music). Кнопки стопят всплытие (stopPropagation).
  const handleOpenFull = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('/radio')
  }

  return (
    <div
      onClick={handleOpenFull}
      role="button"
      tabIndex={0}
      aria-label="Открыть полный плеер"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate('/radio')
        }
      }}
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 720,
        border: '1px solid rgba(34,211,238,0.3)',
        borderRadius: 8,
        background: 'rgba(24,24,27,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 -8px 32px rgba(34,211,238,0.12)',
        zIndex: 50,
        fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* левая часть: on-air точка + эквалайзер (анимируется только когда идёт эфир) */}
      <div style={{ display: 'flex', width: 52, flexShrink: 0, alignItems: 'center', gap: 8 }}>
        {speech.isSpeaking && !speech.paused ? (
          <span
            className="radio-onair-dot"
            style={{ display: 'inline-block', width: 8, height: 8, background: '#f87171', borderRadius: '50%' }}
          />
        ) : (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: speech.paused ? '#facc15' : '#27272a',
              borderRadius: '50%',
            }}
          />
        )}
        <div style={{ display: 'flex', height: 16, alignItems: 'end', gap: 3 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="radio-eq-bar"
              style={{
                width: 3, height: 14,
                background: speech.isSpeaking && !speech.paused ? '#22d3ee' : '#27272a',
                animationDelay: `.${i * 13}s`,
                animationPlayState: speech.isSpeaking && !speech.paused ? 'running' : 'paused',
              }}
            />
          ))}
        </div>
      </div>

      {/* центр: бейдж состояния + заголовок */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          {speech.isSpeaking && !speech.paused && (
            <span style={{ color: '#f87171', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em' }}>ON AIR</span>
          )}
          {speech.paused && (
            <span style={{ color: '#facc15', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em' }}>ПАУЗА</span>
          )}
          {!speech.isSpeaking && !speech.paused && (
            <span style={{ color: '#71717a', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em' }}>IDLE</span>
          )}
          {speaker && speech.isSpeaking && (
            <span style={{
              border: `1px solid ${speaker.color}`,
              color: speaker.color,
              padding: '1px 4px',
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.14em',
            }}>
              {speaker.text}
            </span>
          )}
          {speech.current?.label && speech.isSpeaking && (
            <span style={{ color: '#71717a', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {speech.current.label}
            </span>
          )}
        </div>
        <div style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 600,
          color: speech.isSpeaking ? 'white' : '#71717a',
        }}>
          {speech.isSpeaking && speech.current
            ? speech.current.item.title
            : 'Эфир остановлен'}
        </div>
      </div>

      <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 6 }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (speech.isSpeaking) speech.togglePause()
            else handleLaunchFromIdle()
          }}
          title={speech.paused ? 'Продолжить' : speech.isSpeaking ? 'Пауза' : 'Открыть /radio для запуска'}
          style={{
            display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(34,211,238,0.6)', background: 'rgba(34,211,238,0.1)',
            color: '#22d3ee', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
          }}
        >
          {speech.isSpeaking && !speech.paused ? '⏸' : '▶'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); speech.skip() }}
          disabled={!speech.isSpeaking}
          title="Следующая"
          style={{
            display: 'flex', height: 36, padding: '0 12px', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #27272a', background: 'transparent', color: '#e4e4e7',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
            opacity: speech.isSpeaking ? 1 : 0.3,
          }}
        >
          ⏭
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); speech.stopAll() }}
          disabled={!speech.isSpeaking && speech.queue.length === 0}
          title="Остановить эфир"
          style={{
            display: 'flex', height: 36, padding: '0 12px', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #27272a', background: 'transparent', color: '#e4e4e7',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
            opacity: (speech.isSpeaking || speech.queue.length > 0) ? 1 : 0.3,
          }}
        >
          ■
        </button>
      </div>

      <div style={{
        display: 'flex', flexShrink: 0, alignItems: 'center', gap: 6,
        paddingLeft: 8, borderLeft: '1px solid #27272a', marginLeft: 4,
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleShare() }}
          title={shareState === 'copied' ? 'Скопировано!' : 'Поделиться эфиром'}
          style={{
            display: 'flex', height: 36, padding: '0 12px', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${shareState === 'copied' ? '#34d399' : '#27272a'}`,
            background: 'transparent',
            color: shareState === 'copied' ? '#34d399' : '#e4e4e7',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
            transition: 'all 0.15s',
          }}
        >
          {shareState === 'copied' ? '✓' : '↗'}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            speech.stopAll()
            setDismissed(true)
          }}
          title="Закрыть плеер (стоп эфира + скрыть)"
          className="border border-zinc-800 text-zinc-500 transition-all hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-400/10 active:bg-cyan-400/20"
          style={{
            display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default GlobalPlayerBar

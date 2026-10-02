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
import { useEffect, useRef, useState } from 'react'
import { useSpeechContext } from '@/contexts/SpeechContext'
import { useLocation, useNavigate } from 'react-router'
import { shareText } from '@/lib/radio/share'
import { useMusicUserFlag, setMusicUserFlag } from '@/lib/radio/musicUserFlag'
import { MusicGate } from '@/components/radio/MusicGate'

const SPEAKER_LABEL: Record<string, { text: string; color: string }> = {
  host: { text: 'ВЕДУЩИЙ', color: '#f87171' },
  guest: { text: 'АНАЛИТИК', color: '#22d3ee' },
  single: { text: 'ДИКТОР', color: '#22d3ee' },
}

interface Props {
  /** ТЗ-50/51: режим страницы /radio — тот же плеер, но с кнопками эфира
      (▶ эфир·N стартует эфир на месте, ⚙ открывает настройки) */
  radioMode?: boolean
  /** Управляемая видимость (ТЗ-50/51: started из localStorage — после reload
      плеер сразу в idle, а не ждёт первого isSpeaking) */
  visible?: boolean
  unreadCount?: number
  autoRead?: boolean
  onStartBroadcast?: () => void
  onOpenSettings?: () => void
}

export function GlobalPlayerBar({
  radioMode = false,
  visible,
  unreadCount = 0,
  autoRead,
  onStartBroadcast,
  onOpenSettings,
}: Props = {}) {
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
  // TZ70: фоновая музыка в эфире — юзерский флаг (общий localStorage с SettingsPanel)
  const musicEnabled = useMusicUserFlag()

  // Новый запуск эфира (■ → ▶ на /radio) возвращает плеер, даже если юзер
  // закрывал его ✕ раньше. Срабатывает на 0→1 переходе isSpeaking.
  useEffect(() => {
    if (speech.isSpeaking) setDismissed(false)
  }, [speech.isSpeaking])

  // ТЗ-67-HOTFIX Р1: флаг «юзер уже запускал эфир» залипает в ref — после ■
  // плеер остаётся в IDLE (решение владельца: исчезает только по явному ✕).
  // До первого ▶ плеер скрыт (иначе IDLE-плашка мозолит глаза у каждого
  // посетителя). F5 сбрасывает ref — ок, эфир всё равно не переживает reload.
  // В radioMode видимость приходит снаружи (visible) — ref не используется.
  const everStartedRef = useRef(false)
  useEffect(() => {
    if (speech.isSpeaking && !everStartedRef.current) {
      everStartedRef.current = true
    }
  }, [speech.isSpeaking])

  // Плеер живёт после первого запуска эфира и до явного ✕. radioMode: видимость
  // управляет страница (ТЗ-50/51). До первого ▶ (прочие страницы) не показываем
  // IDLE-плашку (иначе она висела бы у каждого посетителя).
  const everStarted = everStartedRef.current || speech.isSpeaking || speech.paused
  const isVisible = visible !== undefined ? visible : everStarted

  // Риск Р2 ТЗ-67: floating плеер перекрывает контент внизу — добавляем
  // отступ body, пока плеер виден (radioMode-экземпляр порталится в body,
  // отступ ему тоже нужен).
  useEffect(() => {
    if ((isRadioPage && !radioMode) || dismissed || !isVisible) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = '80px'
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [isRadioPage, radioMode, dismissed, isVisible])

  // Обычный экземпляр (App.tsx) на /radio не рендерится — там страница
  // монтирует свой radioMode-экземпляр с кнопками эфира (ТЗ-50/51).
  if (isRadioPage && !radioMode) return null

  if (dismissed || !isVisible) return null

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

  // IDLE: прочие страницы → навигация на /radio (сборка очереди живёт только
  // в RadioPage.startBroadcast). radioMode → эфир стартуем на месте.
  const handleLaunchFromIdle = () => {
    if (radioMode && onStartBroadcast) onStartBroadcast()
    else navigate('/radio')
  }

  // Клик по свободному месту плеера → открыть полный плеер на /radio
  // (UX Spotify/YouTube Music). Кнопки стопят всплытие (stopPropagation).
  const handleOpenFull = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('/radio')
  }

  return (
    <MusicGate>
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
        // ТЗ-67-FIX: iOS safe area — не перекрываем home indicator на iPhone X+.
        // env() работает т.к. в index.html стоит viewport-fit=cover (как в Navbar).
        // На устройствах без safe area возвращает 0 → bottom: 16px как раньше.
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
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
          {/* ТЗ-47: бейдж авто-потока — юзер видит, что новости читаются автоматически */}
          {radioMode && autoRead && speech.isSpeaking && !speech.paused && (
            <span style={{ border: '1px solid #22d3ee', color: '#22d3ee', padding: '1px 4px', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em' }}>
              AUTO
            </span>
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
            : radioMode
              ? `Эфир свободен${unreadCount > 0 ? ` · непрочитано ${unreadCount}` : ''}`
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
          title={
            speech.paused
              ? 'Продолжить'
              : speech.isSpeaking
                ? 'Пауза'
                : radioMode
                  ? `Запустить эфир${unreadCount > 0 ? ` · ${unreadCount}` : ''}`
                  : 'Открыть /radio для запуска'
          }
          style={{
            display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(34,211,238,0.6)', background: 'rgba(34,211,238,0.1)',
            color: '#22d3ee', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
          }}
        >
          {speech.isSpeaking && !speech.paused ? '⏸' : radioMode && unreadCount > 0 ? `▶${unreadCount}` : '▶'}
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
            setMusicUserFlag(!musicEnabled)
          }}
          title={musicEnabled
            ? 'Музыка в эфире включена (клик — выключить)'
            : 'Музыка в эфире выключена (клик — включить)'}
          style={{
            display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${musicEnabled ? 'rgba(34,211,238,0.5)' : '#27272a'}`,
            background: musicEnabled ? 'rgba(34,211,238,0.08)' : 'transparent',
            color: musicEnabled ? '#22d3ee' : '#52525b',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
            transition: 'all 0.15s',
          }}
        >
          ♪
        </button>

        {/* radioMode: ⚙ настройки эфира (голос, темп, блоки) — как в legacy PlayerBar */}
        {radioMode && onOpenSettings && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenSettings() }}
            title="Настройки эфира"
            style={{
              display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
              border: '1px solid #27272a', background: 'transparent',
              color: '#e4e4e7', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 2,
              transition: 'all 0.15s',
            }}
          >
            ⚙
          </button>
        )}

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
    </MusicGate>
  )
}

export default GlobalPlayerBar

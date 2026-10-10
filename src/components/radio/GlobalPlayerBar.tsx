/**
 * PULSE — Глобальный мини-плеер (ТЗ-67; ТЗ-53: Tailwind + мобильная адаптация).
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
 * ТЗ-53 (мобильная адаптация):
 *  - всегда видимы: ⏸/▶, ⏭, ⋯, ✕ (решение владельца 2026-10-10);
 *  - второстепенные ■ ↗ ♪ ⚙: на <sm — в popover по ⋯, на ≥sm — инлайн;
 *  - верстка на Tailwind, инлайн-px оставлены только там, где Tailwind не
 *    выражает значение (safe-area calc, animationDelay барам эквалайзера).
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

/** Базовый вид квадратной кнопки плеера (36×36) */
const BTN =
  'flex h-9 w-9 items-center justify-center rounded-sm border border-zinc-800 bg-transparent text-[13px] font-bold text-zinc-200 transition-all'

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
  // ТЗ-53: popover второстепенных кнопок на мобильном (⋯)
  const [moreOpen, setMoreOpen] = useState(false)

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

  // ТЗ-53: второстепенные кнопки (■ ↗ ♪ ⚙). На <sm — в popover по ⋯,
  // на ≥sm — инлайн через разделитель. Один и тот же набор в обоих местах.
  const secondaryButtons = (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); speech.stopAll() }}
        disabled={!speech.isSpeaking && speech.queue.length === 0}
        title="Остановить эфир"
        className={`${BTN} ${speech.isSpeaking || speech.queue.length > 0 ? '' : 'opacity-30'}`}
      >
        ■
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleShare() }}
        title={shareState === 'copied' ? 'Скопировано!' : 'Поделиться эфиром'}
        className={`${BTN} ${
          shareState === 'copied'
            ? 'border-emerald-400 text-emerald-400'
            : ''
        }`}
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
        className={`${BTN} ${
          musicEnabled
            ? 'border-cyan-400/50 bg-cyan-400/[0.08] text-cyan-400'
            : 'text-zinc-600'
        }`}
      >
        ♪
      </button>
      {/* radioMode: ⚙ настройки эфира (голос, темп, блоки) */}
      {radioMode && onOpenSettings && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenSettings() }}
          title="Настройки эфира"
          className={BTN}
        >
          ⚙
        </button>
      )}
    </>
  )

  return (
    <MusicGate>
      <div
        onClick={handleOpenFull}
        className="fixed left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[720px] -translate-x-1/2 cursor-pointer select-none items-center gap-2 rounded-lg border border-cyan-400/30 bg-zinc-900/95 px-3 py-2 font-mono shadow-[0_-8px_32px_rgba(34,211,238,0.12)] backdrop-blur-md sm:gap-3"
        style={{
          // ТЗ-67-FIX: iOS safe area — не перекрываем home indicator на iPhone X+.
          // env() работает т.к. в index.html стоит viewport-fit=cover (как в Navbar).
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        {/* ТЗ-53: popover второстепенных кнопок — только <sm */}
        {moreOpen && (
          <div
            className="absolute bottom-full right-2 mb-2 flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/95 px-2 py-2 backdrop-blur-md sm:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {secondaryButtons}
          </div>
        )}

        {/* левая часть: on-air точка + эквалайзер (анимируется только когда идёт эфир) */}
        <div className="flex w-[52px] shrink-0 items-center gap-2">
          {speech.isSpeaking && !speech.paused ? (
            <span
              className="radio-onair-dot inline-block h-2 w-2 rounded-full"
              style={{ background: '#f87171' }}
            />
          ) : (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: speech.paused ? '#facc15' : '#27272a' }}
            />
          )}
          <div className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="radio-eq-bar h-3.5 w-[3px]"
                style={{
                  background: speech.isSpeaking && !speech.paused ? '#22d3ee' : '#27272a',
                  animationDelay: `.${i * 13}s`,
                  animationPlayState: speech.isSpeaking && !speech.paused ? 'running' : 'paused',
                }}
              />
            ))}
          </div>
        </div>

        {/* центр: бейдж состояния + заголовок (схлопывается первым) */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            {speech.isSpeaking && !speech.paused && (
              <span className="text-[9px] font-bold tracking-[0.16em] text-red-400">ON AIR</span>
            )}
            {speech.paused && (
              <span className="text-[9px] font-bold tracking-[0.16em] text-yellow-400">ПАУЗА</span>
            )}
            {!speech.isSpeaking && !speech.paused && (
              <span className="text-[9px] font-bold tracking-[0.16em] text-zinc-500">IDLE</span>
            )}
            {/* ТЗ-47: бейдж авто-потока */}
            {radioMode && autoRead && speech.isSpeaking && !speech.paused && (
              <span className="border border-cyan-400 px-1 py-px text-[8px] font-bold tracking-[0.14em] text-cyan-400">
                AUTO
              </span>
            )}
            {speaker && speech.isSpeaking && (
              <span
                className="border px-1 py-px text-[8px] font-bold tracking-[0.14em]"
                style={{ borderColor: speaker.color, color: speaker.color }}
              >
                {speaker.text}
              </span>
            )}
            {speech.current?.label && speech.isSpeaking && (
              <span className="hidden text-[8px] uppercase tracking-[0.12em] text-zinc-500 lg:inline">
                {speech.current.label}
              </span>
            )}
          </div>
          <div
            className={`truncate text-xs font-semibold ${
              speech.isSpeaking ? 'text-white' : 'text-zinc-500'
            }`}
          >
            {speech.isSpeaking && speech.current
              ? speech.current.item.title
              : radioMode
                ? `Эфир свободен${unreadCount > 0 ? ` · непрочитано ${unreadCount}` : ''}`
                : 'Эфир остановлен'}
          </div>
        </div>

        {/* правая часть: основные кнопки — всегда видимы (⏸/▶ · ⏭ · ⋯ · ✕) */}
        <div className="flex shrink-0 items-center gap-1.5">
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
            className="flex h-9 items-center justify-center rounded-sm border border-cyan-400/60 bg-cyan-400/10 px-0 text-[13px] font-bold text-cyan-400 w-9 sm:w-auto sm:px-2.5"
          >
            {speech.isSpeaking && !speech.paused ? (
              '⏸'
            ) : (
              <>
                ▶
                {/* ТЗ-53: счётчик — только ≥sm, на мобильном вылезал за кнопку */}
                {radioMode && unreadCount > 0 && (
                  <span className="hidden sm:inline">{unreadCount}</span>
                )}
              </>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); speech.skip() }}
            disabled={!speech.isSpeaking}
            title="Следующая"
            className={`${BTN} ${speech.isSpeaking ? '' : 'opacity-30'}`}
          >
            ⏭
          </button>
          {/* ⋯ — только <sm: открывает popover со второстепенными кнопками */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMoreOpen((v) => !v)
            }}
            title="Ещё"
            className={`${BTN} sm:hidden ${moreOpen ? 'border-cyan-400/60 text-cyan-400' : ''}`}
          >
            ⋯
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              speech.stopAll()
              setMoreOpen(false)
              setDismissed(true)
            }}
            title="Закрыть плеер (стоп эфира + скрыть)"
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-zinc-800 text-[13px] font-bold text-zinc-500 transition-all hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-400 active:bg-cyan-400/20"
          >
            ✕
          </button>
        </div>

        {/* второстепенные инлайн — только ≥sm (на <sm они в popover по ⋯) */}
        <div className="ml-1 hidden shrink-0 items-center gap-1.5 border-l border-zinc-800 pl-2 sm:flex">
          {secondaryButtons}
        </div>
      </div>
    </MusicGate>
  )
}

export default GlobalPlayerBar

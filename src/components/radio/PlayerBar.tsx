/**
 * PULSE — Радио: нижний плеер-транспорт (ТЗ-44, задача 3).
 * Порт PlayerBar.tsx как есть: ▶ Эфир·N, ⏸/▶, ⏭, ■, очередь, ↗, ⚙;
 * анонс «эфир · N из M» — только визуальный label карточки.
 */
import { useState } from 'react'
import type { useSpeech } from '@/hooks/useSpeech'
import { shareText } from '@/lib/radio/share'

const SPEAKER_LABEL: Record<string, { text: string; color: string }> = {
  host: { text: 'ВЕДУЩИЙ', color: '#f87171' },
  guest: { text: 'АНАЛИТИК', color: '#22d3ee' },
  single: { text: 'ДИКТОР', color: '#22d3ee' },
}

function Eq({ active }: { active: boolean }) {
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={active ? 'radio-eq-bar' : ''}
          style={{
            width: 3,
            height: 14,
            background: active ? '#f87171' : '#27272a',
            animationDelay: `${i * 0.13}s`,
            transform: active ? undefined : 'scaleY(0.25)',
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  )
}

interface Props {
  speech: ReturnType<typeof useSpeech>
  unreadCount: number
  onStartBroadcast: () => void
  onOpenSettings: () => void
}

export function PlayerBar({ speech, unreadCount, onStartBroadcast, onOpenSettings }: Props) {
  const { current, isSpeaking, paused, queue } = speech
  const speaker = speech.currentSpeaker ? SPEAKER_LABEL[speech.currentSpeaker] : null
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

  const shareBroadcast = async () => {
    const r = await shareText(
      'Радио PULSE — персональный эфир новостей',
      `Слушаю персональное радио новостей: эфир собирается из свежей ленты в моменте и читается голосом.${
        current ? `\n\nСейчас в эфире: «${current.item.title}»` : ''
      }`
    )
    if (r === 'copied') {
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 1800)
    }
  }

  const btn =
    'flex h-9 items-center justify-center border border-zinc-800 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-30 disabled:hover:border-zinc-800 disabled:hover:text-zinc-200'

  return (
    <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900/60 px-3 py-2">
      {/* статус */}
      <div className="flex w-[52px] shrink-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isSpeaking && !paused ? 'radio-onair-dot bg-red-400' : 'bg-zinc-800'
          }`}
        />
        <Eq active={isSpeaking && !paused} />
      </div>

      {/* что звучит */}
      <div className="hidden min-w-0 flex-1 sm:block">
        {current ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.16em]"
                style={{ color: paused ? '#facc15' : '#f87171' }}
              >
                {paused ? 'ПАУЗА' : 'ON AIR'}
              </span>
              {speaker && (
                <span
                  className="border px-1 py-px text-[8px] font-bold tracking-[0.14em]"
                  style={{ color: speaker.color, borderColor: speaker.color }}
                >
                  {speaker.text}
                </span>
              )}
              {current.label && (
                <span className="text-[8px] uppercase tracking-[0.12em] text-zinc-500">
                  {current.label}
                </span>
              )}
            </div>
            <div className="truncate text-[12px] font-semibold text-white">
              {current.item.title}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-zinc-500">
            Эфир свободен{unreadCount > 0 ? ` · непрочитано ${unreadCount}` : ''}
          </div>
        )}
      </div>

      {/* транспорт */}
      <div className="flex shrink-0 items-center gap-1.5">
        {!isSpeaking ? (
          <button
            onClick={onStartBroadcast}
            disabled={!speech.ready || unreadCount === 0}
            className="flex h-9 items-center gap-2 border border-red-400/60 bg-red-400/10 px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-30"
            title="Запустить эфир с непрочитанных новостей"
          >
            ▶ эфир{unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </button>
        ) : (
          <button
            onClick={speech.togglePause}
            className="flex h-9 w-11 items-center justify-center border border-red-400/60 bg-red-400/10 text-[13px] font-bold text-red-400 transition-colors hover:bg-red-400/20"
            title={paused ? 'Продолжить' : 'Пауза'}
          >
            {paused ? '▶' : '⏸'}
          </button>
        )}
        <button onClick={speech.skip} disabled={!isSpeaking} className={btn} title="Следующая новость">
          ⏭
        </button>
        <button
          onClick={speech.stopAll}
          disabled={!isSpeaking && queue.length === 0}
          className={btn}
          title="Остановить эфир"
        >
          ■
        </button>
      </div>

      {/* очередь / шеринг / настройки */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className="hidden border border-zinc-800 px-2 py-1 text-[9px] tabular-nums uppercase tracking-[0.12em] text-zinc-500 md:block"
          title="Новостей в очереди"
        >
          оч {queue.length + (isSpeaking ? 1 : 0)}
        </span>
        <button
          onClick={shareBroadcast}
          className={`${btn} ${shareState === 'copied' ? '!border-emerald-400 !text-emerald-400' : ''}`}
          title="Поделиться эфиром"
        >
          {shareState === 'copied' ? '✓' : '↗'}
        </button>
        <button onClick={onOpenSettings} className={btn} title="Настройки эфира">
          ⚙
        </button>
      </div>
    </div>
  )
}

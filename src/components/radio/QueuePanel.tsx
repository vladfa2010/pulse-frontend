/**
 * PULSE — Радио: панель «Сейчас и далее» (ТЗ-44, задача 3).
 * Порт QueuePanel.tsx как есть.
 */
import type { useSpeech } from '@/hooks/useSpeech'

export function QueuePanel({ speech }: { speech: ReturnType<typeof useSpeech> }) {
  const { current, queue, isSpeaking } = speech

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/60 md:flex">
      <div className="border-b border-zinc-800 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        Сейчас и далее
      </div>

      {/* текущая карточка подробно */}
      <div className="border-b border-zinc-800 p-3">
        {current ? (
          <>
            <div className="text-[12px] font-semibold leading-snug text-white">
              {current.item.title}
            </div>
            {current.item.text && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                {current.item.text}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
              {current.label && <span className="text-cyan-400">{current.label}</span>}
              {current.item.score > 0 && current.item.score < 10 && (
                <span className="tabular-nums text-zinc-500">
                  оценка {current.item.score}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[10px] leading-relaxed text-zinc-500">
            {speech.ready
              ? 'Тишина. Плеер внизу: ▶ запускает эфир с непрочитанных, ⏸ ставит на паузу.'
              : 'Голос не готов: проверьте браузер или провайдера в админке.'}
          </div>
        )}
      </div>

      {/* очередь */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 pt-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Очередь · {queue.length}
        </div>
        {queue.length === 0 ? (
          <div className="px-3 py-3 text-[10px] text-zinc-500">пусто</div>
        ) : (
          <ul className="p-1.5">
            {queue.map((q, i) => (
              <li
                key={q.id}
                className="flex items-start gap-2 px-1.5 py-1.5 text-[10px] leading-snug text-zinc-200"
              >
                <span className="tabular-nums text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
                <span>{q.item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-800 px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-zinc-500">
        {isSpeaking ? 'в эфире' : 'на паузе'} · настройки — ⚙ в плеере
      </div>
    </aside>
  )
}

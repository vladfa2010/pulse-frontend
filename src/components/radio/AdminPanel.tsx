/**
 * PULSE — Радио: конструктор эфира (ТЗ-44, задача 3).
 * Порт AdminPanel.tsx по ТЗ-44: УДАЛЕНЫ поле ключа Minimax, выбор провайдера,
 * minimax-голоса, дефолтные режимы (всё это — серверные флаги, ТЗ-42).
 * Блок «Авточтение» ОСТАВЛЕН — юзерская настройка авточтения (localStorage);
 * сервис радио целиком — серверный kill-switch `_radio_settings.service_enabled`,
 * ТЗ-46.
 */
import type { RadioLocalConfig, RadioNewsPace } from '@/lib/radio/config'
import { BLOCK_META } from '@/lib/radio/config'

interface Props {
  open: boolean
  onClose: () => void
  config: RadioLocalConfig
  update: (patch: Partial<RadioLocalConfig>) => void
  toggleBlock: (key: keyof RadioLocalConfig['blocks']) => void
  reset: () => void
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-4 w-8 shrink-0 border transition-colors ${
        on ? 'border-cyan-400 bg-cyan-400/20' : 'border-zinc-800'
      }`}
    >
      <span
        className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 transition-all ${
          on ? 'left-[18px] bg-cyan-400' : 'left-[3px] bg-zinc-500'
        }`}
      />
    </button>
  )
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${
            value === v
              ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function AdminPanel({ open, onClose, config, update, toggleBlock, reset }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-[340px] flex-col border-l border-zinc-800 bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.22em] text-white">АДМИНКА</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              конструктор эфира
            </div>
          </div>
          <button
            onClick={onClose}
            className="border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:border-red-400 hover:text-red-400"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* блоки */}
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Блоки эфира
            </div>
            <ul className="space-y-2.5">
              {BLOCK_META.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-zinc-200">{b.title}</div>
                    <div className="text-[9px] leading-snug text-zinc-500">{b.hint}</div>
                  </div>
                  <Toggle on={config.blocks[b.key]} onClick={() => toggleBlock(b.key)} />
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[8px] leading-snug text-zinc-500">
              «Авточтение» — ваша настройка авто-потока: эфир сам читает новости,
              когда включён этот блок. Выключенный блок не рендерится и не звучит.
            </div>
          </div>

          {/* параметры */}
          <div className="space-y-4 px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Параметры
            </div>

            <div>
              <div className="mb-1.5 text-[10px] text-zinc-200">Порог саммари рынка</div>
              <Seg
                options={[[25, '25'], [50, '50'], [100, '100']]}
                value={config.threshold}
                onChange={(v) => update({ threshold: v })}
              />
              <div className="mt-1 text-[9px] leading-snug text-zinc-500">
                сколько свежих сюжетов накопить, прежде чем формировать общее саммари
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] text-zinc-200">Скорость ленты</div>
              <Seg<RadioNewsPace>
                options={[['fast', 'быстро'], ['normal', 'норма'], ['slow', 'медленно']]}
                value={config.newsPace}
                onChange={(v) => update({ newsPace: v })}
              />
            </div>

            <div>
              <div className="mb-1.5 text-[10px] text-zinc-200">Длина «запуска эфира»</div>
              <Seg
                options={[[5, '5'], [8, '8'], [12, '12']]}
                value={config.broadcastLimit}
                onChange={(v) => update({ broadcastLimit: v })}
              />
              <div className="mt-1 text-[9px] leading-snug text-zinc-500">
                сколько непрочитанных новостей читать подряд
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] text-zinc-200">Сюжетов в своём саммари</div>
              <Seg
                options={[[3, '3'], [4, '4'], [5, '5']]}
                value={config.summaryTopN}
                onChange={(v) => update({ summaryTopN: v })}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 px-4 py-3">
          <button
            onClick={reset}
            className="w-full border border-zinc-800 px-2 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:border-red-400 hover:text-red-400"
          >
            Сбросить к заводским
          </button>
          <div className="mt-2 text-[8px] leading-snug text-zinc-500">
            Конфиг сохраняется в этом браузере (localStorage {`pulse-radio-config-v1`}).
            Провайдер озвучки, голоса и режим по умолчанию — серверные флаги.
          </div>
        </div>
      </div>
    </div>
  )
}

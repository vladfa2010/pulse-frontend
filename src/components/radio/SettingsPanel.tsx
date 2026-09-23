/**
 * PULSE — Радио: настройки эфира (ТЗ-44, задача 3; ТЗ-49 — перенос «Автоплей новых»).
 * Автоплей — юзерская настройка, живёт здесь, а не в конструкторе эфира
 * (AdminPanel): у обычного юзера нет доступа в админку, это его персональное
 * радио (ТЗ-49). Провайдер/голоса — серверные флаги, режим на сессию,
 * browser-голоса, темп, «пилик». При 503 tts_not_configured (speech.minimaxDown)
 * показываем пометку об авто-фолбэке на браузерный голос.
 */
import type { useSpeech } from '@/hooks/useSpeech'
import { READ_MODES } from '@/lib/radio/config'
import type { RadioLocalConfig } from '@/lib/radio/config'
import type { RadioReadMode } from '@/types/radio'

interface Props {
  open: boolean
  onClose: () => void
  /** серверный провайдер из /api/radio/config (информативно) */
  provider: string
  speech: ReturnType<typeof useSpeech>
  soundOn: boolean
  setSoundOn: (v: boolean) => void
  readMode: RadioReadMode
  setReadMode: (v: RadioReadMode) => void
  /** локальный конфиг юзера (autoRead — ТЗ-49) */
  config: RadioLocalConfig
  update: (patch: Partial<RadioLocalConfig>) => void
}

function Seg<T extends string>({
  options,
  value,
  onChange,
  titles,
}: {
  options: [T, string][]
  value: T
  onChange: (v: T) => void
  titles?: Record<string, string>
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={titles?.[v]}
          className={`border px-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors ${
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

export function SettingsPanel({
  open,
  onClose,
  provider,
  speech,
  soundOn,
  setSoundOn,
  readMode,
  setReadMode,
  config,
  update,
}: Props) {
  if (!open) return null

  // Browser-голоса — только фолбэк: при живом серверном Minimax селекты
  // заблокированы и приглушены (иначе выглядят дублем серверных голосов).
  const browserVoicesDisabled = provider === 'minimax' && !speech.minimaxDown

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-[320px] flex-col border-l border-zinc-800 bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.22em] text-white">НАСТРОЙКИ ЭФИРА</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              как звучит ваше радио
            </div>
          </div>
          <button
            onClick={onClose}
            className="border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:border-red-400 hover:text-red-400"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {speech.minimaxDown && (
            <div className="border border-yellow-400/40 bg-yellow-400/5 px-2.5 py-2 text-[9px] leading-snug text-yellow-400">
              Серверный синтез (Minimax) не настроен — эфир звучит браузерным голосом.
              Ключ добавит администратор на сервере.
            </div>
          )}
          {!speech.minimaxDown && provider === 'minimax' && (
            <div className="text-[9px] leading-snug text-zinc-500">
              Провайдер озвучки — Minimax (серверный, speech-02-hd). Голоса ролей задаются
              на сервере.
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Автоплей новых
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-200">
                {config.blocks.autoRead ? 'включён' : 'выключен'}
              </span>
              <button
                onClick={() => update({ blocks: { ...config.blocks, autoRead: !config.blocks.autoRead } })}
                title={
                  config.blocks.autoRead
                    ? 'Новые новости автоматически встают в очередь озвучки'
                    : 'Только ручной запуск ▶ Эфир или ▶ читать на карточке'
                }
                className={`relative h-4 w-8 shrink-0 border transition-colors ${
                  config.blocks.autoRead ? 'border-cyan-400 bg-cyan-400/20' : 'border-zinc-800'
                }`}
              >
                <span
                  className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 transition-all ${
                    config.blocks.autoRead ? 'left-[18px] bg-cyan-400' : 'left-[3px] bg-zinc-500'
                  }`}
                />
              </button>
            </div>
            <div className="mt-1 text-[8px] leading-snug text-zinc-500">
              Вкл — каждая новая новость сразу озвучивается. Выкл — только ручной
              запуск ▶ Эфир или ▶ читать на карточке.
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Режим эфира · на сессию
            </div>
            <Seg<RadioReadMode>
              options={READ_MODES}
              value={readMode}
              onChange={setReadMode}
              titles={{
                text: 'Просто зачитывать новость',
                reflect: 'Новость + размышление, что это значит для рынка',
                podcast: 'Диалог ведущего и аналитика',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              «Пилик» о новости
            </span>
            <button
              onClick={() => setSoundOn(!soundOn)}
              className={`relative h-4 w-8 border transition-colors ${
                soundOn ? 'border-cyan-400 bg-cyan-400/20' : 'border-zinc-800'
              }`}
            >
              <span
                className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 transition-all ${
                  soundOn ? 'left-[18px] bg-cyan-400' : 'left-[3px] bg-zinc-500'
                }`}
              />
            </button>
          </div>

          {/* Browser-голоса — только для фолбэка, когда серверный Minimax недоступен
              (useSpeech: 503 tts_not_configured → авто-фолбэк на speechSynthesis).
              Пока Minimax жив — секции приглушены и заблокированы, чтобы не выглядели
              дублем серверных голосов из админки (_radio_settings). */}
          <div className={browserVoicesDisabled ? 'pointer-events-none opacity-40' : ''}>
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Голос ведущего
              </div>
              <select
                value={speech.hostVoiceURI}
                onChange={(e) => speech.setHostVoiceURI(e.target.value)}
                disabled={browserVoicesDisabled}
                className="w-full border border-zinc-800 bg-zinc-800/50 px-2 py-1.5 text-[10px] text-zinc-200 outline-none focus:border-cyan-400"
              >
                <option value="auto">авто (русский)</option>
                {speech.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Голос аналитика
              </div>
              <select
                value={speech.guestVoiceURI}
                onChange={(e) => speech.setGuestVoiceURI(e.target.value)}
                disabled={browserVoicesDisabled}
                className="w-full border border-zinc-800 bg-zinc-800/50 px-2 py-1.5 text-[10px] text-zinc-200 outline-none focus:border-cyan-400"
              >
                <option value="auto">авто (второй русский)</option>
                {speech.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[8px] leading-snug text-zinc-500">
                Если на обе роли выбран один голос, аналитик звучит выше тембром.
              </div>
            </div>
            {browserVoicesDisabled && (
              <div className="mt-1 text-[8px] leading-snug text-zinc-500">
                Голоса ролей задаются на сервере — эти селекты работают только при
                фолбэке на браузерный голос (когда серверный синтез недоступен).
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <span>Темп</span>
              <span className="tabular-nums text-cyan-400">{speech.rate.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={speech.rate}
              onChange={(e) => speech.setRate(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

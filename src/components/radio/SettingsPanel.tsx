/**
 * PULSE — Радио: настройки эфира (ТЗ-44, задача 3).
 * Порт SettingsPanel.tsx по ТЗ-44: УДАЛЕНЫ «Мои интересы», «Авточтение новых»,
 * minimax-голоса и выбор провайдера (провайдер/голоса — серверные флаги).
 * Остаются: режим на сессию (текст/мысли/подкаст), browser-голоса ведущего/
 * аналитика, темп, «пилик». При 503 tts_not_configured (speech.minimaxDown)
 * показываем пометку об авто-фолбэке на браузерный голос.
 */
import type { useSpeech } from '@/hooks/useSpeech'
import { READ_MODES } from '@/lib/radio/config'
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
}: Props) {
  if (!open) return null

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

          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Голос ведущего
            </div>
            <select
              value={speech.hostVoiceURI}
              onChange={(e) => speech.setHostVoiceURI(e.target.value)}
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
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Голос аналитика
            </div>
            <select
              value={speech.guestVoiceURI}
              onChange={(e) => speech.setGuestVoiceURI(e.target.value)}
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

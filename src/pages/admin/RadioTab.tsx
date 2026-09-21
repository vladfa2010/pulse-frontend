import { useState, useEffect, useCallback } from 'react'
import { Radio, RefreshCw, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'
import { adminApi } from '@/lib/api'

interface RadioFlags {
  auto_read_enabled: boolean
  voice_provider: 'browser' | 'minimax'
  minimax_host_voice: string
  minimax_guest_voice: string
  default_mode: 'text' | 'reflect' | 'podcast'
}

interface RadioFlagsResponse {
  flags: RadioFlags
  minimax_configured: boolean
  allowed_voices: string[]
}

const PROVIDER_LABELS: Record<RadioFlags['voice_provider'], string> = {
  browser: 'Браузер (Web Speech)',
  minimax: 'Minimax (серверный TTS)',
}

const MODE_LABELS: Record<RadioFlags['default_mode'], string> = {
  text: 'Текст',
  reflect: 'Рефлексия',
  podcast: 'Подкаст',
}

export default function RadioTab() {
  const [data, setData] = useState<RadioFlagsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/api/admin/radio-flags')
      setData(res as RadioFlagsResponse)
    } catch (err: any) {
      setError(err?.message || 'Failed to load radio flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const showSuccess = () => {
    setSaveSuccess('Сохранено. Юзеры подхватят изменения в течение ~5 минут.')
    window.setTimeout(() => setSaveSuccess(null), 6000)
  }

  const updateFlag = async (key: keyof RadioFlags, value: boolean | string) => {
    setSavingKey(key)
    setError(null)
    try {
      const res: any = await adminApi.put('/api/admin/radio-flags', { key, value })
      setData((prev) => (prev ? { ...prev, flags: res.flags } : prev))
      showSuccess()
    } catch (err: any) {
      setError(err?.message || 'Failed to update flag')
    } finally {
      setSavingKey(null)
    }
  }

  const handleReset = async () => {
    if (resetting) return
    setResetting(true)
    setError(null)
    try {
      const res: any = await adminApi.post('/api/admin/radio-flags/reset', {})
      setData((prev) => (prev ? { ...prev, flags: res.flags } : prev))
      showSuccess()
    } catch (err: any) {
      setError(err?.message || 'Failed to reset flags')
    } finally {
      setResetting(false)
    }
  }

  const flags = data?.flags
  const minimaxWarning = !!flags && flags.voice_provider === 'minimax' && !data?.minimax_configured

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: '#111111', borderColor: '#222222' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Radio size={18} style={{ color: '#00D4FF' }} />
              Радио — флаги
            </h2>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Runtime-настройки голосового радио. Хранятся в БД (_radio_settings), меняются без деплоя.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={resetting || !flags}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
              Сбросить к дефолтам
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* State messages */}
      {saveSuccess && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#34D39915', borderColor: '#34D39930', color: '#34D399' }}
        >
          <CheckCircle2 size={18} />
          <p className="text-sm">{saveSuccess}</p>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#EF444415', borderColor: '#EF444430', color: '#EF4444' }}
        >
          <AlertCircle size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Minimax warning: ровно при voice_provider === 'minimax' && !minimax_configured */}
      {minimaxWarning && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#EF444415', borderColor: '#EF444430', color: '#EF4444' }}
        >
          <AlertCircle size={18} />
          <p className="text-sm">
            MINIMAX_API_KEY не задан на сервере — радио молча переключит юзеров на браузерные голоса.
          </p>
        </div>
      )}

      {/* Flags */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#111111', borderColor: '#222222' }}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#222222' }}
        >
          <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
            Флаги
          </span>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {data?.minimax_configured
              ? 'Minimax API ключ: задан'
              : 'Minimax API ключ: не задан'}
          </span>
        </div>

        {!flags && !error && (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {loading ? 'Загрузка…' : 'Нет данных'}
            </p>
          </div>
        )}

        {flags && (
          <div className="p-6 space-y-5">
            {/* Авточтение новых */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white">Авточтение новых</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  Голосовой блок сам зачитывает свежие новости по открытым тегам
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={flags.auto_read_enabled}
                  disabled={savingKey !== null}
                  onChange={(e) => updateFlag('auto_read_enabled', e.target.checked)}
                />
                <div
                  className="w-9 h-5 rounded-full transition-colors"
                  style={{ backgroundColor: flags.auto_read_enabled ? '#00D4FF' : '#222222' }}
                >
                  <div
                    className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform"
                    style={{ transform: flags.auto_read_enabled ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                </div>
              </label>
            </div>

            {/* Провайдер озвучки */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white">Провайдер озвучки</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  Minimax — серверные нейроголоса (нужен API-ключ), браузер — бесплатный фолбэк
                </div>
              </div>
              <select
                value={flags.voice_provider}
                disabled={savingKey !== null}
                onChange={(e) => updateFlag('voice_provider', e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border bg-[#0A0A0A]"
                style={{ borderColor: '#222222', color: '#9CA3AF' }}
              >
                {(Object.keys(PROVIDER_LABELS) as RadioFlags['voice_provider'][]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            {/* Голоса Minimax (только когда провайдер minimax) */}
            {flags.voice_provider === 'minimax' && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white">Голос ведущего (Minimax)</div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      Голос по умолчанию для TTS-запросов без voice_id
                    </div>
                  </div>
                  <select
                    value={flags.minimax_host_voice}
                    disabled={savingKey !== null}
                    onChange={(e) => updateFlag('minimax_host_voice', e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm border bg-[#0A0A0A]"
                    style={{ borderColor: '#222222', color: '#9CA3AF' }}
                  >
                    {(data?.allowed_voices || []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white">Голос гостя (Minimax)</div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      Второй голос для формата «подкаст» (режим диалога)
                    </div>
                  </div>
                  <select
                    value={flags.minimax_guest_voice}
                    disabled={savingKey !== null}
                    onChange={(e) => updateFlag('minimax_guest_voice', e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm border bg-[#0A0A0A]"
                    style={{ borderColor: '#222222', color: '#9CA3AF' }}
                  >
                    {(data?.allowed_voices || []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Режим по умолчанию */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white">Режим по умолчанию</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  Какой вид открывается у юзера при входе в радио
                </div>
              </div>
              <select
                value={flags.default_mode}
                disabled={savingKey !== null}
                onChange={(e) => updateFlag('default_mode', e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border bg-[#0A0A0A]"
                style={{ borderColor: '#222222', color: '#9CA3AF' }}
              >
                {(Object.keys(MODE_LABELS) as RadioFlags['default_mode'][]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

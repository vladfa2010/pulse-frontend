import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { Bell, Send, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface AlertEventType {
  value: string
  label: string
}

interface TgAlertSettings {
  id: string
  admin_user_id: string
  tg_chat_id: string
  event_types: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SettingsResponse {
  settings: TgAlertSettings | null
  event_types: AlertEventType[]
}

export default function TgAlertsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eventTypes, setEventTypes] = useState<AlertEventType[]>([])
  const [chatId, setChatId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isActive, setIsActive] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data: SettingsResponse = await adminApi.get('/admin/tg-alerts/settings')
      setEventTypes(data.event_types || [])
      if (data.settings) {
        setChatId(data.settings.tg_chat_id || '')
        setSelected(new Set(data.settings.event_types || []))
        setIsActive(data.settings.is_active !== false)
      } else {
        setChatId('')
        setSelected(new Set())
        setIsActive(true)
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const showSuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 3000)
  }

  const toggleType = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleSave = async () => {
    if (!chatId.trim()) {
      setError('Введите Telegram Chat ID')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await adminApi.put('/admin/tg-alerts/settings', {
        tg_chat_id: chatId.trim(),
        event_types: Array.from(selected),
        is_active: isActive,
      })
      showSuccess('Настройки сохранены')
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!chatId.trim()) {
      setError('Введите Telegram Chat ID для теста')
      return
    }
    setTesting(true)
    setError(null)
    try {
      await adminApi.post('/admin/tg-alerts/test', { tg_chat_id: chatId.trim() })
      showSuccess('Тестовое сообщение отправлено')
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить тестовое сообщение')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
        <span className="text-sm" style={{ color: '#9CA3AF' }}>Загрузка настроек...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>Telegram Alerts</h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Мгновенные уведомления админам о событиях пользователей.
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#F59E0B22' }}
        >
          <Bell size={20} style={{ color: '#FBBF24' }} />
        </div>
      </div>

      {/* Info card */}
      <div
        className="rounded-xl border p-4 text-sm"
        style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
      >
        <p>
          Чтобы получать алерты, укажите свой <b>Telegram Chat ID</b> (число, можно узнать через @userinfobot).
          Бот с токеном <code>TELEGRAM_BOT_TOKEN</code> отправит сообщение в этот чат.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-sm"
          style={{ backgroundColor: '#EF444422', borderColor: '#EF444433', color: '#FCA5A5' }}
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-sm"
          style={{ backgroundColor: '#34D39922', borderColor: '#34D39933', color: '#6EE7B7' }}
        >
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#111111', borderColor: '#222222' }}
      >
        <div className="p-5 space-y-5">
          {/* Chat ID */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#D1D5DB' }}>
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
              className="w-full rounded-lg border px-4 py-2 text-sm outline-none focus:border-[#333333] transition-colors"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
            />
            <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
              Может быть ID пользователя или ID канала/группы (с минусом для групп).
            </p>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-11 h-6 rounded-full relative transition-colors"
              style={{ backgroundColor: isActive ? '#34D399' : '#374151' }}
              onClick={() => setIsActive(!isActive)}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: isActive ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </div>
            <span className="text-sm" style={{ color: '#D1D5DB' }}>Алерты активны</span>
          </label>

          {/* Event types */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: '#D1D5DB' }}>
              События для уведомлений
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {eventTypes.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors hover:border-[#333333]"
                  style={{ backgroundColor: '#0A0A0A', borderColor: selected.has(t.value) ? '#34D39955' : '#222222' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="w-4 h-4 accent-[#34D399]"
                  />
                  <span className="text-sm" style={{ color: selected.has(t.value) ? '#FFFFFF' : '#9CA3AF' }}>
                    {t.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
        >
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Отправить тест
          </button>
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: '#34D399', color: '#000000' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

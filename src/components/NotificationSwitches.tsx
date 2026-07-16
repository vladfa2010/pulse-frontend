import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Mail, Send, Loader2 } from 'lucide-react'

interface NotificationSettings {
  fact_check_email_enabled?: boolean
  fact_check_tg_enabled?: boolean
}

interface Props {
  compact?: boolean
  telegramConnected?: boolean
}

export default function NotificationSwitches({ compact, telegramConnected }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api
      .get('/user/notifications')
      .then((data) => setSettings(data.settings || {}))
      .catch(() => setSettings({}))
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    setSaving((prev) => ({ ...prev, [key]: true }))
    try {
      await api.patch('/user/notifications', { [key]: value })
      setSettings((prev) => ({ ...prev, [key]: value }))
    } catch {
      // revert on error
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  const Toggle = ({
    icon: Icon,
    label,
    note,
    enabled,
    disabled,
    onChange,
    keyName,
  }: {
    icon: typeof Mail
    label: string
    note?: string
    enabled: boolean
    disabled?: boolean
    onChange: () => void
    keyName: string
  }) => (
    <div
      className={`flex items-center justify-between ${compact ? 'py-2' : 'py-3 px-4 rounded-xl'}`}
      style={{
        backgroundColor: compact ? 'transparent' : '#0A0A0A',
        border: compact ? 'none' : '1px solid #1a1a1a',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: enabled ? '#00D4FF15' : '#1a1a1a' }}
        >
          <Icon size={16} style={{ color: enabled ? '#00D4FF' : '#6B7280' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: '#D1D5DB' }}>
            {label}
          </p>
          {note && <p className="text-[10px]" style={{ color: '#6B7280' }}>{note}</p>}
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled || saving[keyName]}
        className="w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-60"
        style={{ backgroundColor: enabled ? '#00D4FF' : '#333' }}
      >
        {saving[keyName] ? (
          <Loader2 size={14} className="absolute top-1.5 left-4 animate-spin" style={{ color: '#fff' }} />
        ) : (
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
            style={{ left: enabled ? '24px' : '2px' }}
          />
        )}
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
        <Loader2 size={12} className="animate-spin" /> Загрузка настроек…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>
          Уведомления о проверке
        </p>
      )}
      <Toggle
        icon={Mail}
        label="Email-отчёт"
        note="HTML-письмо с результатом"
        enabled={!!settings.fact_check_email_enabled}
        onChange={() => updateSetting('fact_check_email_enabled', !settings.fact_check_email_enabled)}
        keyName="fact_check_email_enabled"
      />
      <Toggle
        icon={Send}
        label="Telegram-отчёт"
        note={telegramConnected === false ? 'Подключите Telegram в профиле' : 'Сообщение в Telegram'}
        enabled={!!settings.fact_check_tg_enabled}
        disabled={telegramConnected === false}
        onChange={() => updateSetting('fact_check_tg_enabled', !settings.fact_check_tg_enabled)}
        keyName="fact_check_tg_enabled"
      />
    </div>
  )
}

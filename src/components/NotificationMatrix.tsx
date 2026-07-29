/* =============================================================================
   PULSE — Notification Matrix (Liquid Glass Design)
   =============================================================================
   Матрица настроек уведомлений: продукты × каналы.
   Стиль — по образцу Profile.tsx: GlassCard, Toggle, Tailwind + inline rgba.

   API:
     GET /api/user/notification-matrix → { subscriptions, quietHours, channels }
     PUT /api/user/notification-matrix { product, channel, enabled?, frequency? }
     POST /api/user/notification-matrix/quiet-hours { enabled?, start?, end? }

   Подключение: вставить во вкладку 'notifications' в Profile.tsx ПОСЛЕ карточек
   подключения каналов (Telegram / Push), заменив отдельные тумблеры
   "Отправлять дайджест" (email) и "Отправлять push".
   ============================================================================= */

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { api } from '@/lib/api'
import { MessageCircle, Mail, Bell, Moon, Loader2 } from 'lucide-react'

/* ─── Types (соответствуют backend/src/services/notifications/types.ts) ─── */

type Product = 'digest' | 'weekly_report' | 'fact_check' | 'news_alert' | 'billing' | 'engagement'
type Channel = 'telegram' | 'email' | 'push'

interface Subscription {
  userId: string
  product: Product
  channel: Channel
  enabled: boolean
  frequency: string | null
  lastSentAt: string | null
}

interface MatrixResponse {
  subscriptions: Subscription[]
  quietHours: { enabled: boolean; start: string; end: string } | null
  channels: { channel: Channel; is_active: boolean }[]
}

/* ─── Конфиг отображения ─── */

const PRODUCTS: { id: Product; label: string; note: string; channels: Channel[] }[] = [
  { id: 'digest',        label: 'Дайджест непрочитанного', note: 'Подборка по вашим тегам',      channels: ['telegram', 'email', 'push'] },
  { id: 'news_alert',    label: 'Мгновенные алерты',       note: 'Пуш сразу при выходе новости', channels: ['push'] },
  { id: 'weekly_report', label: 'Еженедельный отчёт',      note: 'Воскресенье, 13:00 МСК',       channels: ['telegram', 'email', 'push'] },
  { id: 'fact_check',    label: 'Факт-чек',                note: 'Результат проверки новости',   channels: ['telegram', 'email'] },
  { id: 'billing',       label: 'Подписка и оплата',       note: 'Истечение, продление, чеки',   channels: ['email', 'push'] },
  { id: 'engagement',    label: 'Механики и напоминания',  note: 'Sentiment Index, стрики',       channels: ['push'] },
]

const CHANNELS: { id: Channel; label: string; icon: typeof Mail; color: string }[] = [
  { id: 'telegram', label: 'Telegram', icon: MessageCircle, color: '#0088CC' },
  { id: 'email',    label: 'Email',    icon: Mail,          color: '#F59E0B' },
  { id: 'push',     label: 'Push',     icon: Bell,          color: '#34D399' },
]

const FREQUENCIES = [
  { value: '1h',  label: 'Каждый час' },
  { value: '3h',  label: 'Каждые 3 часа' },
  { value: '6h',  label: 'Каждые 6 часов' },
  { value: '12h', label: 'Каждые 12 часов' },
  { value: '24h', label: 'Раз в сутки' },
]

/* ─── Toggle (копия из Profile.tsx — вынести в components/ui при рефакторе) ─── */

function Toggle({ enabled, onChange, disabled, activeColor = '#00D4FF' }: {
  enabled: boolean
  onChange: () => void
  disabled?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-40"
      style={{ backgroundColor: enabled ? activeColor : '#333' }}
    >
      <div
        className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
        style={{ left: enabled ? '24px' : '2px' }}
      />
    </button>
  )
}

/* ─── Main Component ─── */

export default function NotificationMatrix({ isPremium }: { isPremium: boolean }) {
  const [data, setData] = useState<MatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const load = useCallback(() => {
    setLoading(true)
    api.get('/user/notification-matrix')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const getSub = (product: Product, channel: Channel): Subscription | undefined =>
    data?.subscriptions.find(s => s.product === product && s.channel === channel)

  const isChannelConnected = (channel: Channel): boolean =>
    !!data?.channels.find(c => c.channel === channel && c.is_active)

  const update = async (product: Product, channel: Channel, patch: { enabled?: boolean; frequency?: string }) => {
    const key = `${product}:${channel}`
    setSaving(prev => ({ ...prev, [key]: true }))
    // Оптимистичное обновление
    setData(prev => prev && ({
      ...prev,
      subscriptions: patch.enabled === undefined
        ? prev.subscriptions.map(s => s.product === product && s.channel === channel ? { ...s, ...patch } : s)
        : [
            ...prev.subscriptions.filter(s => !(s.product === product && s.channel === channel)),
            { userId: '', product, channel, enabled: patch.enabled, frequency: patch.frequency ?? s0freq(prev, product, channel), lastSentAt: null },
          ],
    }))
    try {
      await api.put('/user/notification-matrix', { product, channel, ...patch })
    } catch {
      load() // откат при ошибке
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }))
    }
  }

  const updateQuietHours = async (patch: { enabled?: boolean; start?: string; end?: string }) => {
    setData(prev => prev && prev.quietHours && ({
      ...prev,
      quietHours: {
        enabled: patch.enabled ?? prev.quietHours.enabled,
        start: patch.start ?? prev.quietHours.start,
        end: patch.end ?? prev.quietHours.end,
      },
    }))
    try {
      await api.post('/user/notification-matrix/quiet-hours', patch)
    } catch {
      load()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-[#9CA3AF] text-sm">Не удалось загрузить настройки.</p>
  }

  const digestFreq = getSub('digest', 'telegram')?.frequency || '1h'
  const quiet = data.quietHours

  return (
    <div className="space-y-5">
      {/* ─── Заголовок колонок каналов ─── */}
      <div className="grid grid-cols-[1fr_repeat(3,52px)] items-center gap-1 px-1">
        <span />
        {CHANNELS.map(c => (
          <div key={c.id} className="flex flex-col items-center gap-1">
            <c.icon size={14} style={{ color: c.color }} />
            <span className="text-[10px]" style={{ color: '#6B7280' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ─── Строки продуктов ─── */}
      {PRODUCTS.map(p => (
        <div
          key={p.id}
          className="grid grid-cols-[1fr_repeat(3,52px)] items-center gap-1 py-3 px-4 rounded-xl"
          style={{ backgroundColor: '#0A0A0A', border: '1px solid #1a1a1a' }}
        >
          <div className="min-w-0 pr-2">
            <p className="text-sm font-medium" style={{ color: '#D1D5DB' }}>{p.label}</p>
            <p className="text-[10px]" style={{ color: '#6B7280' }}>{p.note}</p>
          </div>
          {CHANNELS.map(c => {
            if (!p.channels.includes(c.id)) {
              return <span key={c.id} className="text-center text-[10px]" style={{ color: '#333' }}>—</span>
            }
            const sub = getSub(p.id, c.id)
            const connected = isChannelConnected(c.id)
            const key = `${p.id}:${c.id}`
            return (
              <div key={c.id} className="flex justify-center" title={connected ? undefined : `Сначала подключите ${c.label}`}>
                {saving[key] ? (
                  <Loader2 size={14} className="animate-spin" style={{ color: '#6B7280' }} />
                ) : (
                  <Toggle
                    enabled={!!sub?.enabled}
                    disabled={!connected}
                    activeColor={c.color}
                    onChange={() => update(p.id, c.id, { enabled: !sub?.enabled })}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* ─── Частота дайджеста ─── */}
      <div className="pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <label className="text-[#9CA3AF] text-sm mb-2 block">Частота дайджеста</label>
        <select
          value={digestFreq}
          onChange={e => {
            // Частота общая для дайджеста: пишем во ВСЕ его каналы,
            // иначе email/push-дайджест останется на старом расписании
            const freq = e.target.value
            const digestChannels = data.subscriptions
              .filter(s => s.product === 'digest')
              .map(s => s.channel)
            const channels = digestChannels.length > 0 ? digestChannels : (['telegram'] as Channel[])
            channels.forEach(ch => update('digest', ch, { frequency: freq }))
          }}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00D4FF]"
          style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* ─── Тихие часы (общие, МСК) ─── */}
      {quiet && (
        <>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div className="flex items-center gap-2 text-sm text-[#D1D5DB]">
              <Moon size={14} className="text-[#6B7280]" />
              <span>Тихие часы <span className="text-[10px]" style={{ color: '#6B7280' }}>(московское время)</span></span>
            </div>
            <Toggle enabled={quiet.enabled} onChange={() => updateQuietHours({ enabled: !quiet.enabled })} />
          </div>
          {quiet.enabled && (
            <div className="flex gap-3">
              {(['start', 'end'] as const).map(which => (
                <div key={which} className="flex-1">
                  <label className="text-[#6B7280] text-xs mb-1 block">{which === 'start' ? 'С' : 'До'}</label>
                  <input
                    type="time"
                    value={quiet[which]}
                    onChange={e => updateQuietHours(which === 'start' ? { start: e.target.value } : { end: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Premium-gate (опционально, по решению из entitlement.ts) ─── */}
      {!isPremium && (
        <p className="text-xs" style={{ color: '#6B7280' }}>
          На Free доступен дайджест по вашим тегам. <Link to="/pricing" className="text-[#00D4FF] hover:underline">Premium</Link> — все теги и еженедельный отчёт.
        </p>
      )}
    </div>
  )
}

function s0freq(prev: MatrixResponse, product: Product, channel: Channel): string | null {
  return prev.subscriptions.find(s => s.product === product && s.channel === channel)?.frequency ?? null
}

export { NotificationMatrix }

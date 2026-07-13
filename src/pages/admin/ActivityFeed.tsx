import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import {
  UserPlus,
  LogIn,
  KeyRound,
  Lock,
  Tag,
  CreditCard,
  Crown,
  Ban,
  MessageSquare,
  MessageSquareOff,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ActivityEvent {
  id: string
  user_id: string
  username: string
  email: string
  event_type: string
  event_data: Record<string, any>
  created_at: string
}

const EVENT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  register:               { label: 'Register', color: '#34D399', bgColor: '#34D39915', icon: UserPlus },
  login:                  { label: 'Login', color: '#60A5FA', bgColor: '#60A5FA15', icon: LogIn },
  forgot_password:        { label: 'Forgot Password', color: '#FBBF24', bgColor: '#FBBF2415', icon: KeyRound },
  password_reset:         { label: 'Password Reset', color: '#34D399', bgColor: '#34D39915', icon: Lock },
  tag_added:              { label: 'Tag Added', color: '#A78BFA', bgColor: '#A78BFA15', icon: Tag },
  tag_removed:            { label: 'Tag Removed', color: '#F87171', bgColor: '#F8717115', icon: Tag },
  payment_completed:      { label: 'Payment', color: '#F59E0B', bgColor: '#F59E0B15', icon: CreditCard },
  subscription_activated: { label: 'Sub Activated', color: '#34D399', bgColor: '#34D39915', icon: Crown },
  subscription_cancelled: { label: 'Sub Cancelled', color: '#EF4444', bgColor: '#EF444415', icon: Ban },
  channel_connected:      { label: 'Channel On', color: '#22D3EE', bgColor: '#22D3EE15', icon: MessageSquare },
  channel_disconnected:   { label: 'Channel Off', color: '#6B7280', bgColor: '#6B728015', icon: MessageSquareOff },
  sentiment_vote:         { label: 'Sentiment Vote', color: '#EC4899', bgColor: '#EC489915', icon: TrendingUp },
}

const HOUR_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 6, label: '6h' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 72, label: '3d' },
  { value: 168, label: '7d' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'register', label: 'Register' },
  { value: 'login', label: 'Login' },
  { value: 'forgot_password', label: 'Forgot Password' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'tag_added', label: 'Tag Added' },
  { value: 'tag_removed', label: 'Tag Removed' },
  { value: 'payment_completed', label: 'Payment' },
  { value: 'subscription_activated', label: 'Sub Activated' },
  { value: 'subscription_cancelled', label: 'Sub Cancelled' },
  { value: 'channel_connected', label: 'Channel On' },
  { value: 'channel_disconnected', label: 'Channel Off' },
  { value: 'sentiment_vote', label: 'Sentiment Vote' },
]

const PAGE_SIZE = 10

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatFullDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function truncateTarget(target: string): string {
  if (!target || target.length <= 12) return target
  return `${target.slice(0, 6)}...${target.slice(-4)}`
}

function EventDetails({ type, data }: { type: string; data: Record<string, any> }) {
  switch (type) {
    case 'register':
      return <span style={{ color: '#9CA3AF' }}>{data.username} · {data.email}</span>
    case 'login':
    case 'forgot_password':
    case 'password_reset':
      return <span style={{ color: '#9CA3AF' }}>{data.email}</span>
    case 'tag_added':
      return (
        <span className="flex items-center gap-2">
          <span style={{ color: '#FFFFFF' }}>{data.tag_name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: '#222222', color: '#9CA3AF' }}>
            {data.tag_type}
          </span>
        </span>
      )
    case 'tag_removed':
      return <span style={{ color: '#FFFFFF' }}>{data.tag_name}</span>
    case 'payment_completed':
      return (
        <span className="flex items-center gap-2">
          <span className="font-mono" style={{ color: '#34D399' }}>{Number(data.amount).toFixed(0)} RUB</span>
          <span style={{ color: '#9CA3AF' }}>{data.plan_id}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: '#222222', color: '#9CA3AF' }}>
            {data.method}
          </span>
        </span>
      )
    case 'subscription_activated':
      return (
        <span className="flex items-center gap-2">
          <span style={{ color: '#9CA3AF' }}>{data.plan_id}</span>
          <span style={{ color: '#6B7280' }}>until {new Date(data.expires_at).toLocaleDateString('ru-RU')}</span>
        </span>
      )
    case 'subscription_cancelled':
      return <span style={{ color: '#9CA3AF' }}>{data.plan_id}</span>
    case 'channel_connected':
    case 'channel_disconnected':
      return (
        <span className="flex items-center gap-2">
          <span style={{ color: '#9CA3AF' }}>{data.channel}</span>
          <span style={{ color: '#6B7280' }}>{truncateTarget(data.target)}</span>
        </span>
      )
    case 'sentiment_vote':
      return (
        <span className="flex items-center gap-2 text-xs">
          <span
            style={{
              color: data.vote_value === 1 ? '#34D399' : data.vote_value === -1 ? '#EF4444' : '#FBBF24',
            }}
          >
            {data.vote_value === 1 ? 'bullish' : data.vote_value === -1 ? 'bearish' : 'neutral'}
          </span>
          {data.index_at_vote !== undefined && (
            <span style={{ color: '#6B7280' }}>index: {data.index_at_vote}</span>
          )}
        </span>
      )
    default:
      return null
  }
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [eventType, setEventType] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const typeParam = eventType ? `&type=${encodeURIComponent(eventType)}` : ''
      const data = await adminApi.get(`/admin/events?hours=${hours}&limit=100${typeParam}`)
      setEvents(data.events || [])
      setLastUpdated(new Date())
      setVisibleCount(PAGE_SIZE)
    } catch (err) {
      console.error('Activity feed load error:', err)
    } finally {
      setLoading(false)
    }
  }, [hours, eventType])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  const visibleEvents = events.slice(0, visibleCount)
  const hasMore = events.length > visibleCount

  return (
    <div
      className="rounded-xl border overflow-hidden mb-6"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#222222' }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Activities List</h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#222222', color: '#9CA3AF' }}>
            {events.length} events
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs" style={{ color: '#6B7280' }}>
              updated {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="text-xs rounded-lg border px-2 py-1.5 focus:outline-none"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="text-xs rounded-lg border px-2 py-1.5 focus:outline-none"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
          >
            {HOUR_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Events list */}
      <div className="divide-y" style={{ borderColor: '#222222' }}>
        {loading && events.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={18} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
            <span className="text-sm" style={{ color: '#9CA3AF' }}>Loading activities...</span>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
            No events for the selected period
          </div>
        )}

        {visibleEvents.map(event => {
          const config = EVENT_CONFIG[event.event_type] || {
            label: event.event_type,
            color: '#9CA3AF',
            bgColor: '#9CA3AF15',
            icon: LogIn,
          }
          const Icon = config.icon
          return (
            <div
              key={event.id}
              className="px-4 py-3 flex items-center gap-3 hover:bg-[#161616] transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: config.bgColor }}
              >
                <Icon size={14} style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                    style={{ backgroundColor: config.bgColor, color: config.color }}
                  >
                    {config.label}
                  </span>
                  <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                    {event.username}
                  </span>
                  <span className="text-xs truncate" style={{ color: '#6B7280' }}>
                    {event.email}
                  </span>
                </div>
                <div className="mt-0.5 text-sm">
                  <EventDetails type={event.event_type} data={event.event_data} />
                </div>
              </div>
              <div
                className="text-xs shrink-0"
                style={{ color: '#6B7280' }}
                title={formatFullDate(event.created_at)}
              >
                {timeAgo(event.created_at)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {events.length > 0 && (
        <div className="px-4 py-3 border-t flex items-center justify-center gap-2" style={{ borderColor: '#222222' }}>
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="flex items-center gap-1 text-xs transition-colors hover:text-white"
              style={{ color: '#9CA3AF' }}
            >
              <ChevronDown size={14} />
              Show {Math.min(PAGE_SIZE, events.length - visibleCount)} more
            </button>
          )}
          {!hasMore && visibleCount > PAGE_SIZE && (
            <button
              onClick={() => setVisibleCount(PAGE_SIZE)}
              className="flex items-center gap-1 text-xs transition-colors hover:text-white"
              style={{ color: '#9CA3AF' }}
            >
              <ChevronUp size={14} />
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}

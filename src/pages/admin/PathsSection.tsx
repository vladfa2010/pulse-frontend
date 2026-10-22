import { RefreshCw } from 'lucide-react'
import { EVENT_TYPE_LABELS } from './UserDetailModal'

// ТЗ-124: секция «Пути пользователей» — таблица пользователей с активностью,
// точки выхода из сессий, цепочки к целям (оплата / активация / отмена
// подписки) и ветвления (куда идут после каждого события).
// Данные: GET /api/admin/metrics?section=paths&period=N (scope=all) +
// ленивый прямой fetch GET /api/admin/metrics/user-paths?period=N&scope=…
// только при переключении scope на «только функции».

export type PathsScope = 'all' | 'functions'

export interface PathUser {
  user_id: string
  email: string
  username: string | null
  plan: string | null
  subscription_active: boolean
  last_event_at: string | null
  last_event_type: string | null
  events_7d: number
  events_30d: number
  top_event_type: string | null
  top_transition: { from: string; to: string; count: number } | null
  ltv: number
}

export interface ExitPoint {
  event_type: string
  count: number
}

export interface ConversionPath {
  goal: string
  path: string[]
  count: number
}

export interface BranchNext {
  to: string
  count: number
  share: number
}

export interface BranchNode {
  from: string
  total_out: number
  next: BranchNext[]
}

export interface PathsMetrics {
  period: number
  scope: PathsScope
  users: PathUser[]
  exit_points: ExitPoint[]
  conversion_paths: ConversionPath[]
  branching: BranchNode[]
}

const GOALS: { goal: string; label: string; color: string }[] = [
  { goal: 'payment_completed', label: 'Оплата', color: '#34D399' },
  { goal: 'subscription_activated', label: 'Активация подписки', color: '#60A5FA' },
  { goal: 'subscription_cancelled', label: 'Отмена подписки', color: '#F87171' },
]

function eventLabel(type: string): string {
  if (type === 'other') return 'прочее'
  if (type.startsWith('admin_')) return EVENT_TYPE_LABELS[type] || 'Действие админа'
  return EVENT_TYPE_LABELS[type] || type
}

function formatMsk(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLtv(n: number): string {
  if (!n) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

function MethodologyNote() {
  return (
    <p className="text-[11px] mt-3" style={{ color: '#6B7280' }}>
      Сессия = разрыв ≤30 мин. Серии повторов схлопнуты. Связки с n&lt;3 — в «прочее». Проценты без n не показывать.
    </p>
  )
}

function UsersTable({ users, onSelectUser }: { users: PathUser[]; onSelectUser: (userId: string) => void }) {
  if (!users.length) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor: '#0A0A0A' }}>
            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Пользователь</th>
            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>План</th>
            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Последнее событие</th>
            <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>7д / 30д</th>
            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Топ-событие</th>
            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Топ-переход</th>
            <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>LTV</th>
          </tr>
        </thead>
        <tbody>
          {users.slice(0, 500).map((u) => (
            <tr
              key={u.user_id}
              data-user-id={u.user_id}
              onClick={() => onSelectUser(u.user_id)}
              className="cursor-pointer hover:bg-[#161616]"
              style={{ borderTop: '1px solid #1a1a1a' }}
            >
              <td className="px-4 py-3 text-sm" style={{ color: '#FFFFFF' }}>
                {u.email || u.username || '—'}
              </td>
              <td className="px-4 py-3 text-sm" style={{ color: '#9CA3AF' }}>
                {u.plan ? (
                  <span className="flex items-center gap-1.5">
                    {u.plan}
                    {u.subscription_active && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#0f2a1c', color: '#34D399', border: '1px solid #1f3d2b' }}
                      >
                        активна
                      </span>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-sm" style={{ color: '#9CA3AF' }}>
                {u.last_event_type ? (
                  <>
                    <span style={{ color: '#D1D5DB' }}>{eventLabel(u.last_event_type)}</span>
                    {u.last_event_at && (
                      <span className="block text-xs" style={{ color: '#6B7280' }}>
                        {formatMsk(u.last_event_at)} МСК
                      </span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-right text-sm font-mono whitespace-nowrap" style={{ color: '#FFFFFF' }}>
                {u.events_7d} / {u.events_30d}
              </td>
              <td className="px-4 py-3 text-sm" style={{ color: '#9CA3AF' }}>
                {u.top_event_type ? eventLabel(u.top_event_type) : '—'}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#9CA3AF' }}>
                {u.top_transition
                  ? `${eventLabel(u.top_transition.from)} → ${eventLabel(u.top_transition.to)} · n=${u.top_transition.count}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-sm font-mono" style={{ color: '#34D399' }}>
                {formatLtv(u.ltv)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExitPoints({ exitPoints }: { exitPoints: ExitPoint[] }) {
  if (!exitPoints.length) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
  }
  const max = Math.max(...exitPoints.map((e) => e.count))
  return (
    <div className="space-y-2">
      {exitPoints.map((e) => (
        <div key={e.event_type} className="flex items-center gap-3">
          <span className="text-xs font-medium w-36 truncate text-right" style={{ color: '#9CA3AF' }}>
            {eventLabel(e.event_type)}
          </span>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${max ? (e.count / max) * 100 : 0}%`, backgroundColor: '#00D4FF', minWidth: e.count ? 2 : 0 }}
            />
          </div>
          <span className="text-xs font-bold w-20 text-right whitespace-nowrap" style={{ color: '#FFFFFF' }}>
            {e.count} · n={e.count}
          </span>
        </div>
      ))}
    </div>
  )
}

function ConversionPaths({ conversionPaths }: { conversionPaths: ConversionPath[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {GOALS.map(({ goal, label, color }) => {
        const chains = conversionPaths.filter((c) => c.goal === goal)
        return (
          <div key={goal} className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>
              {label}
            </p>
            {chains.length ? (
              <div className="space-y-2">
                {chains.map((c, idx) => (
                  <p key={idx} className="text-xs leading-relaxed" style={{ color: '#D1D5DB' }}>
                    {c.path.map((step, i) => (
                      <span key={i}>
                        {i > 0 && <span style={{ color: '#6B7280' }}> → </span>}
                        {eventLabel(step)}
                      </span>
                    ))}
                    <span style={{ color: '#9CA3AF' }}> · n={c.count}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#6B7280' }}>за период целей не было</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScopeToggle({ scope, onScopeChange }: { scope: PathsScope; onScopeChange: (s: PathsScope) => void }) {
  return (
    <div className="flex items-center rounded-lg border p-1" style={{ borderColor: '#222222' }}>
      {(
        [
          { value: 'all', label: 'все события' },
          { value: 'functions', label: 'только функции' },
        ] as const
      ).map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onScopeChange(value)}
          className="px-3 py-1 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: scope === value ? '#222222' : 'transparent',
            color: scope === value ? '#FFFFFF' : '#6B7280',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Branching({ branching }: { branching: BranchNode[] }) {
  if (!branching.length) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
  }
  return (
    <div className="space-y-2">
      {branching.map((node) => (
        <details key={node.from} className="rounded-lg border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
          <summary className="px-4 py-3 text-sm cursor-pointer select-none" style={{ color: '#D1D5DB' }}>
            {eventLabel(node.from)} · {node.total_out} исходящих
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {node.next.map((n) => (
              <div key={n.to} className="flex items-center gap-3">
                <span className="text-xs font-medium w-36 truncate text-right" style={{ color: '#9CA3AF' }}>
                  {eventLabel(n.to)}
                </span>
                <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${n.share}%`, backgroundColor: '#00D4FF', minWidth: n.count ? 2 : 0 }}
                  />
                </div>
                <span className="text-xs font-bold w-28 text-right whitespace-nowrap" style={{ color: '#FFFFFF' }}>
                  {n.share}% · n={n.count}
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

export default function PathsSection({
  paths,
  loading,
  period,
  scope,
  onScopeChange,
  onSelectUser,
}: {
  paths: PathsMetrics | null
  loading: boolean
  period: number
  scope: PathsScope
  onScopeChange: (s: PathsScope) => void
  onSelectUser: (userId: string) => void
}) {
  if (loading && !paths) {
    return (
      <div className="flex items-center justify-center py-10">
        <RefreshCw size={16} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
        <span className="text-xs" style={{ color: '#9CA3AF' }}>Загрузка...</span>
      </div>
    )
  }

  const isEmpty =
    !paths ||
    (!paths.users.length && !paths.exit_points.length && !paths.conversion_paths.length && !paths.branching.length)

  if (isEmpty && !loading) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Недостаточно данных за период</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium mb-3" style={{ color: '#9CA3AF' }}>
          Пользователи (до 500 строк, за {period} дн)
        </p>
        {paths && <UsersTable users={paths.users} onSelectUser={onSelectUser} />}
        <MethodologyNote />
      </div>

      <div>
        <p className="text-xs font-medium mb-3" style={{ color: '#9CA3AF' }}>Куда уходят</p>
        {paths && <ExitPoints exitPoints={paths.exit_points} />}
        <p className="text-[11px] mt-2" style={{ color: '#6B7280' }}>
          последнее событие сессии. read_article как точка выхода — норма (дочитал и ушёл)
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-3" style={{ color: '#9CA3AF' }}>Пути к оплате и отмене</p>
        {paths && <ConversionPaths conversionPaths={paths.conversion_paths} />}
        <MethodologyNote />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Ветвления</p>
          <ScopeToggle scope={scope} onScopeChange={onScopeChange} />
        </div>
        {paths && <Branching branching={paths.branching} />}
        <MethodologyNote />
      </div>
    </div>
  )
}

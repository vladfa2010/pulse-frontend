/**
 * Админ-таба «Пуши» — дашборд push-контура.
 *
 * Источник: GET /api/admin/push/stats (adminMiddleware, ТЗ-120-стиль).
 * Карточки (сегодня/неделя/месяц/подписки), дневной график 7/30 дней,
 * разрез по типам отправлений, топ получателей, лента последних 50 отправлений,
 * здоровье подписок (FCM/Safari) и динамика новых подписок.
 * Автообновление 60 с — таба же отвечает на вопрос «живо ли прямо сейчас».
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

interface DailyPoint { day: string; count: number }
interface PushStats {
  totals: { today: number; week: number; month: number }
  daily: DailyPoint[]
  bySource: Array<{ source: string; count: number }>
  topUsers: Array<{ user_id: string; email: string | null; username: string | null; count: number }>
  recent: Array<{ user_id: string; email: string | null; title: string | null; source: string; sent_at: string }>
  subscriptions: {
    total: number
    active: number
    apple: number
    apple_active: number
    fcm: number
    fcm_active: number
    createdDaily: DailyPoint[]
    activeChannels: number
  }
}

const C = {
  bg: '#111111',
  border: '#222222',
  text: '#E5E7EB',
  muted: '#6B7280',
  accent: '#60A5FA',
  green: '#34D399',
}

function dayLabel(day: string): string {
  return String(day).slice(5, 10).split('-').reverse().join('.')
}

/** Последние n дней с нулями в днях без отправлений (сырые данные — только непустые). */
function fillDays(daily: DailyPoint[], days: number): DailyPoint[] {
  const map = new Map(daily.map(d => [String(d.day).slice(0, 10), d.count]))
  const out: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    out.push({ day: d, count: map.get(d) ?? 0 })
  }
  return out
}

function Bars({ data, color }: { data: DailyPoint[]; color: string }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map(d => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${dayLabel(d.day)} — ${d.count}`}>
          <div className="w-full rounded-sm" style={{ height: Math.max(2, (d.count / max) * 96), background: color, opacity: d.count ? 1 : 0.15 }} />
          <span className="text-[9px]" style={{ color: C.muted }}>{dayLabel(d.day).slice(0, 5)}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4 flex-1 min-w-[140px]" style={{ backgroundColor: C.bg, borderColor: C.border }}>
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: C.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: C.muted }}>{sub}</div>}
    </div>
  )
}

export default function PushTab() {
  const [stats, setStats] = useState<PushStats | null>(null)
  const [range, setRange] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await adminApi.get('/api/admin/push/stats')
      setStats(data)
    } catch (err) {
      console.error('Push stats load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const chartData = useMemo(() => (stats ? fillDays(stats.daily, range) : []), [stats, range])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin mr-2" style={{ color: C.accent }} />
        <span className="text-sm" style={{ color: C.muted }}>Loading push stats...</span>
      </div>
    )
  }
  if (!stats) return null

  const { totals, bySource, topUsers, recent, subscriptions } = stats

  return (
    <div>
      {/* Карточки */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Card label="Сегодня" value={totals.today} />
        <Card label="7 дней" value={totals.week} />
        <Card label="30 дней" value={totals.month} />
        <Card
          label="Подписки (активные)"
          value={`${subscriptions.active} / ${subscriptions.total}`}
          sub={`${subscriptions.activeChannels} пользователей с push-каналом`}
        />
      </div>

      {/* График по дням */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: C.bg, borderColor: C.border }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: C.text }}>Отправлено по дням</span>
          <div className="flex gap-1">
            {([7, 30] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1 rounded text-xs border"
                style={{
                  backgroundColor: range === r ? '#1E293B' : 'transparent',
                  borderColor: C.border,
                  color: range === r ? C.text : C.muted,
                }}
              >
                {r} дней
              </button>
            ))}
          </div>
        </div>
        <Bars data={chartData} color={C.accent} />
      </div>

      {/* Разрез по типам + топ получателей */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border p-4" style={{ backgroundColor: C.bg, borderColor: C.border }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>По типам отправлений (30 дней)</div>
          {bySource.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Нет данных</div>}
          {bySource.map(s => (
            <div key={s.source} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.text }}>{s.source}</span>
              <span style={{ color: C.accent }}>{s.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4" style={{ backgroundColor: C.bg, borderColor: C.border }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Топ получателей (7 дней)</div>
          {topUsers.length === 0 && <div className="text-xs" style={{ color: C.muted }}>Нет данных</div>}
          {topUsers.map((u, i) => (
            <div key={u.user_id} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="truncate mr-2" style={{ color: C.text }}>
                <span style={{ color: C.muted }}>{i + 1}. </span>
                {u.email || u.username || u.user_id.slice(0, 8)}
              </span>
              <span style={{ color: C.accent }}>{u.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Подписки */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: C.bg, borderColor: C.border }}>
        <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Подписки</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card label="Android / FCM" value={`${subscriptions.fcm_active} / ${subscriptions.fcm}`} />
          <Card label="Safari (Apple)" value={`${subscriptions.apple_active} / ${subscriptions.apple}`} />
          <Card label="Всего активных" value={subscriptions.active} />
          <Card label="Всего записей" value={subscriptions.total} />
        </div>
        <div className="text-xs mb-2" style={{ color: C.muted }}>Новые подписки по дням (30 дней)</div>
        <Bars data={fillDays(subscriptions.createdDaily, 30)} color={C.green} />
      </div>

      {/* Лента последних отправлений */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: C.bg, borderColor: C.border }}>
        <div className="text-sm font-semibold p-4 pb-2" style={{ color: C.text }}>Последние отправления</div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>
              <th className="text-left px-4 py-2 font-normal text-xs">Время (UTC)</th>
              <th className="text-left px-4 py-2 font-normal text-xs">Получатель</th>
              <th className="text-left px-4 py-2 font-normal text-xs">Тип</th>
              <th className="text-left px-4 py-2 font-normal text-xs">Заголовок</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td className="px-4 py-2 whitespace-nowrap" style={{ color: C.muted }}>
                  {new Date(r.sent_at).toISOString().slice(5, 19).replace('T', ' ')}
                </td>
                <td className="px-4 py-2" style={{ color: C.text }}>{r.email || '—'}</td>
                <td className="px-4 py-2">
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: '#1E293B', color: C.accent }}>{r.source}</span>
                </td>
                <td className="px-4 py-2 truncate max-w-[420px]" style={{ color: C.muted }}>{r.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

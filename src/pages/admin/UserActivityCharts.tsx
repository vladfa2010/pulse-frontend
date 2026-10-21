import { useEffect, useMemo, useRef, useState } from 'react'
import type { ECharts } from 'echarts'
import { Activity } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { loadECharts } from '@/lib/echartsLoader'
import { EVENT_TYPE_LABELS } from './UserDetailModal'

// ТЗ-122 Задача 3: bubble-график активности по часам + таймлайн событий
// пользователя. Данные — GET /api/admin/metrics/flow?period=30&user_id=<uuid>.

interface FlowBubble {
  hour: number // 0-23 UTC
  event_type: string
  count: number
}

interface FlowTimelineEvent {
  t: string // ISO
  type: string
}

interface FlowResponse {
  period: number
  user_id: string | null
  transitions: unknown[]
  session_starts: unknown[]
  bubbles: FlowBubble[]
  timeline: FlowTimelineEvent[]
}

function eventLabel(type: string): string {
  if (type.startsWith('admin_')) return EVENT_TYPE_LABELS[type] || 'Действие админа'
  return EVENT_TYPE_LABELS[type] || type
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Стабильная палитра: цвет типа определяется хешом строки, а не позицией
// в данных — при перезагрузках цвета не «поплывут».
const TYPE_PALETTE = [
  '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6',
  '#22D3EE', '#FB923C', '#4ADE80', '#E879F9', '#F87171',
]

function colorForType(type: string): string {
  let hash = 0
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0
  return TYPE_PALETTE[hash % TYPE_PALETTE.length]
}

// X = час 0-23 по Москве ((hour + 3) % 24 — бэк отдаёт UTC), Y = тип действия.
function BubbleChart({ bubbles }: { bubbles: FlowBubble[] }) {
  const ref = useRef<HTMLDivElement>(null)

  const types = useMemo(() => {
    const seen: string[] = []
    for (const b of bubbles) if (!seen.includes(b.event_type)) seen.push(b.event_type)
    return seen
  }, [bubbles])

  useEffect(() => {
    if (!ref.current || bubbles.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
          formatter: (p: any) => {
            const [mskHour, typeIdx, count] = p.value as [number, number, number]
            const utcHour = (mskHour + 21) % 24
            return `${eventLabel(types[typeIdx])}<br/>час ${mskHour}:00 мск (UTC ${utcHour}:00)<br/>${count} шт.`
          },
        },
        grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
        xAxis: {
          type: 'category',
          data: Array.from({ length: 24 }, (_, i) => String(i)),
          name: 'час (мск)',
          nameLocation: 'middle',
          nameGap: 22,
          nameTextStyle: { color: '#6B7280', fontSize: 10 },
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#6B7280', fontSize: 10, interval: 1 },
        },
        yAxis: {
          type: 'category',
          data: types.map(eventLabel),
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#9CA3AF', fontSize: 10 },
          splitLine: { show: false },
        },
        series: [
          {
            type: 'scatter',
            data: bubbles.map((b) => [(b.hour + 3) % 24, types.indexOf(b.event_type), b.count]),
            symbolSize: (val: any) => 6 + Math.sqrt((val as [number, number, number])[2]) * 6,
            itemStyle: { color: '#60A5FA', opacity: 0.75 },
          },
        ],
      })

      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(ref.current)
    })

    return () => {
      disposed = true
      ro?.disconnect()
      instance?.dispose()
    }
  }, [bubbles, types])

  return <div ref={ref} style={{ height: 260, width: '100%' }} />
}

// Ось X — time, точки — последние события пользователя, цвет по типу.
function TimelineChart({ timeline }: { timeline: FlowTimelineEvent[] }) {
  const ref = useRef<HTMLDivElement>(null)

  const types = useMemo(() => {
    const seen: string[] = []
    for (const e of timeline) if (!seen.includes(e.type)) seen.push(e.type)
    return seen
  }, [timeline])

  useEffect(() => {
    if (!ref.current || timeline.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
          formatter: (p: any) => {
            const [t, typeIdx] = p.value as [string, number]
            return `${eventLabel(types[typeIdx])}<br/>${formatDateTime(t)}`
          },
        },
        grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
        },
        yAxis: {
          type: 'category',
          data: types.map(eventLabel),
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#9CA3AF', fontSize: 10 },
          splitLine: { show: false },
        },
        series: [
          {
            type: 'scatter',
            symbolSize: 7,
            data: timeline.map((e) => ({
              value: [e.t, types.indexOf(e.type)] as [string, number],
              itemStyle: { color: colorForType(e.type), opacity: 0.8 },
            })),
          },
        ],
      })

      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(ref.current)
    })

    return () => {
      disposed = true
      ro?.disconnect()
      instance?.dispose()
    }
  }, [timeline, types])

  return <div ref={ref} style={{ height: 260, width: '100%' }} />
}

export default function UserActivityCharts({ userId }: { userId: string }) {
  const [flow, setFlow] = useState<FlowResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminApi
      .get(`/api/admin/metrics/flow?period=30&user_id=${userId}`)
      .then((res) => {
        if (cancelled) return
        setFlow(res)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Не удалось загрузить активность')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const emptyText = (
    <div className="text-xs py-8 text-center" style={{ color: '#6B7280' }}>
      Пока нет данных об активности
    </div>
  )

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} style={{ color: '#9CA3AF' }} />
        <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Активность</p>
      </div>
      {loading ? (
        <div className="text-xs" style={{ color: '#6B7280' }}>Loading...</div>
      ) : error ? (
        <div className="text-xs" style={{ color: '#EF4444' }}>{error}</div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[11px] mb-2" style={{ color: '#6B7280' }}>Действия по часам (30 дней)</p>
            {flow && flow.bubbles.length > 0 ? <BubbleChart bubbles={flow.bubbles} /> : emptyText}
          </div>
          <div>
            <p className="text-[11px] mb-2" style={{ color: '#6B7280' }}>Таймлайн событий</p>
            {flow && flow.timeline.length > 0 ? <TimelineChart timeline={flow.timeline} /> : emptyText}
          </div>
        </div>
      )}
    </div>
  )
}

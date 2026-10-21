import { useEffect, useMemo, useRef } from 'react'
import type { ECharts } from 'echarts'
import { loadECharts } from '@/lib/echartsLoader'
import { EVENT_TYPE_LABELS } from './UserDetailModal'

// ТЗ-122 Задача 4: секция «Сценарии» — Sankey переходов внутри сессий и топ-10
// точек старта сессий. Данные: GET /api/admin/metrics?section=flow&period=N
// (payload — внутри обёртки res.data).

export interface FlowTransition {
  from: string
  to: string
  count: number
}

export interface FlowSessionStart {
  event_type: string
  count: number
}

export interface FlowMetrics {
  transitions: FlowTransition[]
  session_starts: FlowSessionStart[]
}

function eventLabel(type: string): string {
  if (type.startsWith('admin_')) return EVENT_TYPE_LABELS[type] || 'Действие админа'
  return EVENT_TYPE_LABELS[type] || type
}

function SankeyChart({ transitions }: { transitions: FlowTransition[] }) {
  const ref = useRef<HTMLDivElement>(null)

  // Узлы — уникальные from/to (сырые типы как name, RU-лейбл — через formatter:
  // иначе два типа с одним лейблом слиплись бы в один узел).
  const nodes = useMemo(() => {
    const names: string[] = []
    for (const t of transitions) {
      if (!names.includes(t.from)) names.push(t.from)
      if (!names.includes(t.to)) names.push(t.to)
    }
    return names.map((name) => ({ name }))
  }, [transitions])

  useEffect(() => {
    if (!ref.current || transitions.length === 0) return
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
        },
        series: [
          {
            type: 'sankey',
            left: 16,
            right: 130,
            top: 12,
            bottom: 12,
            nodeWidth: 14,
            nodeGap: 10,
            emphasis: { focus: 'adjacency' },
            lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.35 },
            label: {
              color: '#9CA3AF',
              fontSize: 11,
              formatter: (p: any) => (p.name === 'other' ? 'Прочее' : eventLabel(p.name)),
            },
            data: nodes,
            links: transitions.map((t) => ({ source: t.from, target: t.to, value: t.count })),
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
  }, [transitions, nodes])

  return <div ref={ref} style={{ height: 500, width: '100%' }} />
}

function SessionStartsChart({ starts }: { starts: FlowSessionStart[] }) {
  const ref = useRef<HTMLDivElement>(null)

  // inverse: true — самый частый старт сверху
  const labels = useMemo(() => starts.map((s) => eventLabel(s.event_type)), [starts])

  useEffect(() => {
    if (!ref.current || starts.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
        },
        grid: { left: 8, right: 32, top: 8, bottom: 8, containLabel: true },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#1F2937' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: labels,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#9CA3AF', fontSize: 10 },
          splitLine: { show: false },
        },
        series: [
          {
            type: 'bar',
            data: starts.map((s) => s.count),
            barMaxWidth: 16,
            itemStyle: { color: '#34D399', borderRadius: [0, 4, 4, 0] },
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
  }, [starts, labels])

  return <div ref={ref} style={{ height: Math.max(200, starts.length * 30), width: '100%' }} />
}

export default function FlowCharts({ flow }: { flow: FlowMetrics }) {
  if (!flow.transitions?.length) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Недостаточно данных за период</p>
  }
  return (
    <div className="space-y-6">
      <div>
        <SankeyChart transitions={flow.transitions} />
        <p className="text-[11px] mt-2" style={{ color: '#6B7280' }}>
          Переходы внутри сессий (разрыв ≤ 30 мин = одна сессия), серии повторов схлопнуты
        </p>
      </div>
      <div>
        <p className="text-xs font-medium mb-3" style={{ color: '#9CA3AF' }}>Старты сессий (топ-10)</p>
        {flow.session_starts?.length ? (
          <SessionStartsChart starts={flow.session_starts} />
        ) : (
          <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
        )}
      </div>
    </div>
  )
}

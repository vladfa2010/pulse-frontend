/**
 * =============================================================================
 * PULSE — Вкладка «Граф»: force-граф каскадов + фон «звёздное поле» (ТЗ-93)
 * =============================================================================
 *
 * Данные — GET /market/cascade-graph?window=7d|30d:
 *   - узлы = новости каскадов (первоисточник — крупный узел ~15px с белой
 *     обводкой, дубли — убывающего размера), рёбра «первоисточник → дубль №N»
 *     по порядку items; ECharts type 'graph', layout 'force', roam (зум
 *     колёсиком / панорама drag), draggable;
 *   - цвет = сюжет (палитра мокапа по кругу), каскады без сюжета — серые;
 *   - фон — отдельный canvas под графом: по точке (rect ~1.6px, alpha ~0.045)
 *     на каждую новость окна из feed, ось X — время с дневной сеткой и
 *     подписями дат МСК, Y — детерминированный джиттер по хэшу (t, source).
 *     Фон статичен и НЕ масштабируется зумом графа;
 *   - клик по узлу → ?cluster=<id> (деталь-панель каскада).
 *
 * ОТЛИЧИЕ ОТ МОКАПА (зафиксировано §2.5 ТЗ-93): пунктирных «спутников сюжета»
 * (новостей сюжета вне каскадов, dashed-рёбра к хабу) в проде НЕТ — сюжет
 * состоит только из кластеров. Спутники не рисуем.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { ECharts } from 'echarts'
import type { CascadeGraphResponse, GraphFeedPoint } from '@/lib/cascadesApi'

/** Палитра мокапа — по кругу для сюжетов */
const STORY_PALETTE = ['#00D4FF', '#34D399', '#F59E0B', '#EF4444', '#A78BFA']
const NO_STORY_COLOR = '#6B7280'
const NO_STORY_CATEGORY = 'Каскады без сюжета'

const MSK_OFFSET_SEC = 3 * 3600
const DAY_SEC = 86400

/** Детерминированный джиттер 0..1 по хэшу (t, source) — как в мокапе drawFeedBg() */
function feedJitter(t: number, source: string): number {
  let h = t >>> 0
  for (let i = 0; i < source.length; i++) {
    h = (Math.imul(h, 31) + source.charCodeAt(i)) >>> 0
  }
  return (h % 10000) / 10000
}

/** Граница суток МСК (epoch-сек), содержащая момент t */
function mskDayStart(t: number): number {
  return Math.floor((t - MSK_OFFSET_SEC) / DAY_SEC) * DAY_SEC + MSK_OFFSET_SEC
}

function drawFeedBg(canvas: HTMLCanvasElement, feed: GraphFeedPoint[]) {
  if (feed.length === 0) return
  const parent = canvas.parentElement
  if (!parent) return
  const dpr = window.devicePixelRatio || 1
  const width = parent.clientWidth
  const height = parent.clientHeight
  if (width === 0 || height === 0) return
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  let tMin = Infinity
  let tMax = -Infinity
  for (const [t] of feed) {
    if (t < tMin) tMin = t
    if (t > tMax) tMax = t
  }
  const span = Math.max(tMax - tMin, 1)
  const padX = 10
  const padTop = 24 // сверху — место под легенду графа
  const padBottom = 24 // снизу — подписи дат

  const xOf = (t: number) => padX + ((t - tMin) / span) * (width - padX * 2)
  const yOf = (t: number, source: string) =>
    padTop + feedJitter(t, source) * Math.max(height - padTop - padBottom, 1)

  // Точка на новость (~1.6px, alpha ~0.045)
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (const [t, source] of feed) {
    ctx.fillRect(xOf(t), yOf(t, source), 1.6, 1.6)
  }

  // Дневная сетка: вертикальные линии на границах суток МСК + подписи дат
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = '9px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  const days = Math.ceil(span / DAY_SEC)
  // Чтобы подписи не сливались, показываем не чаще, чем раз в ~70px
  const labelEvery = Math.max(1, Math.ceil((days * 60) / Math.max(width, 1)))
  let dayIndex = 0
  for (let d = mskDayStart(tMin); d <= tMax + DAY_SEC; d += DAY_SEC) {
    const x = xOf(d)
    if (x >= padX && x <= width - padX) {
      ctx.beginPath()
      ctx.moveTo(x, padTop)
      ctx.lineTo(x, height - padBottom + 4)
      ctx.stroke()
      if (dayIndex % labelEvery === 0) {
        const label = new Date(d * 1000).toLocaleDateString('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: '2-digit',
          month: '2-digit',
        })
        ctx.fillText(label, x, height - 8)
      }
    }
    dayIndex++
  }
}

interface GraphNode {
  id: string
  name: string
  clusterId: string
  category: number
  symbolSize: number
  itemStyle: { color: string; borderColor?: string; borderWidth?: number }
  meta: { title: string; source: string; time: string }
}

interface Props {
  data: CascadeGraphResponse
  onNodeClick: (clusterId: string) => void
}

export default function CascadeGraph({ data, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  // Категории-сюжеты: палитра по кругу + финальная серая «Каскады без сюжета»
  const categories = useMemo(() => {
    const cats = data.stories.map((s, i) => ({
      name: s.title,
      itemStyle: { color: STORY_PALETTE[i % STORY_PALETTE.length] },
    }))
    cats.push({ name: NO_STORY_CATEGORY, itemStyle: { color: NO_STORY_COLOR } })
    return cats
  }, [data.stories])

  const storyIndex = useMemo(() => {
    const map = new Map<string, number>()
    data.stories.forEach((s, i) => map.set(s.story_id, i))
    return map
  }, [data.stories])

  // Узлы-новости и рёбра «первоисточник → дубль №N» (без спутников — см. шапку файла)
  const { nodes, links } = useMemo(() => {
    const nodes: GraphNode[] = []
    const links: { source: string; target: string }[] = []
    for (const cascade of data.cascades) {
      const cat = cascade.story_id != null
        ? storyIndex.get(cascade.story_id) ?? categories.length - 1
        : categories.length - 1
      const color = categories[cat].itemStyle.color
      cascade.items.forEach((item, i) => {
        const id = `${cascade.cluster_id}:${i}`
        const isFirst = i === 0
        nodes.push({
          id,
          name: item.title,
          clusterId: cascade.cluster_id,
          category: cat,
          symbolSize: isFirst ? 15 : Math.max(5, 12 - i * 1.5),
          itemStyle: isFirst
            ? { color, borderColor: '#FFFFFF', borderWidth: 1.5 }
            : { color },
          meta: {
            title: item.title,
            source: item.source,
            time: new Date(item.t * 1000).toLocaleString('ru-RU', {
              timeZone: 'Europe/Moscow',
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            }),
          },
        })
        if (!isFirst && cascade.items.length > 0) {
          links.push({ source: `${cascade.cluster_id}:0`, target: id })
        }
      })
    }
    return { nodes, links }
  }, [data.cascades, storyIndex, categories])

  // Фон «звёздное поле» — статичный canvas под графом (не реагирует на зум графа)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawFeedBg(canvas, data.feed)
    const ro = new ResizeObserver(() => drawFeedBg(canvas, data.feed))
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [data.feed])

  // Инициализация ECharts — ленивая: компонент монтируется при первом открытии вкладки
  useEffect(() => {
    if (!chartRef.current) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    import('echarts').then((echarts) => {
      if (disposed || !chartRef.current) return
      instance = echarts.init(chartRef.current, 'dark')
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
          formatter: (params: any) => {
            if (params.dataType !== 'node') return ''
            const meta = (params.data as GraphNode).meta
            return `${meta.title}<br/>${meta.source} · ${meta.time}`
          },
        },
        legend: {
          data: categories.map((c) => c.name),
          top: 2,
          left: 8,
          icon: 'circle',
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: '#9CA3AF', fontSize: 10 },
          inactiveColor: '#333',
        },
        series: [
          {
            type: 'graph',
            layout: 'force',
            roam: true,
            draggable: true,
            categories,
            data: nodes,
            links,
            force: {
              repulsion: 50,
              edgeLength: [18, 50],
              gravity: 0.08,
              friction: 0.25,
            },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 10, color: '#FFFFFF', position: 'right' },
            },
            lineStyle: { color: 'rgba(255,255,255,0.15)', width: 1 },
            itemStyle: { opacity: 0.9 },
          },
        ],
      })
      instance.on('click', (params: any) => {
        if (params.dataType === 'node' && params.data?.clusterId) {
          onNodeClick(params.data.clusterId)
        }
      })
      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(chartRef.current!)
    })

    return () => {
      disposed = true
      ro?.disconnect()
      instance?.dispose()
    }
    // option пересобирается только при смене окна (пересоздание компонента со сменой ключа)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative rounded-2xl border border-white/[0.06] overflow-hidden" style={{ height: 560 }}>
      {/* Звёздное поле — под графом, статично */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      {/* Force-граф поверх */}
      <div ref={chartRef} className="absolute inset-0" />
      <p className="absolute bottom-1.5 left-3 text-[10px] text-text-muted pointer-events-none">
        Точки фона — все новости окна (не масштабируются зумом графа). Клик по узлу — детали каскада.
      </p>
    </div>
  )
}

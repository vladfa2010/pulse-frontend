/**
 * =============================================================================
 * PULSE — График каскада: свечи + маркеры новостей (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Переиспользует форму InstrumentChart из ТЗ-3 (та же, что /news-chart).
 * Построен по образцу CandleChart.tsx с добавлением:
 *   - scatter-маркеры новостей кластера: первая видимая новость — акцентная точка
 *     (первоисточник), дубли — меньшего размера; новость вне торговой сессии
 *     (нет свечи в момент публикации) — пунктирная «пустая» метка у ближайшей
 *     свечи (логика ближайшей свечи — на клиенте, по массиву times инструмента);
 *   - вертикальные markLine границ дней (как в мокапе), с подписью даты DD.MM
 *     в таймзоне биржи (ТЗ-97 §4.2);
 *   - ТЗ-97 §4.3 (уточнение): при truncated === true (каскад длиннее крышки 14 дней)
 *     маркеры вне [первая свеча − 30 мин; covered_until + 30 мин] не рисуются
 *     (считаются в чип «+N вне графика» в панели). Без truncated клиппинга нет —
 *     маркеры вне сессии пунктиром у ближайшей свечи, как обещает легенда;
 *   - ТЗ-97 §6: маркеры на одной свече группируются — один символ с числом,
 *     тултип — списком новостей группы.
 *   - ТЗ-194: опциональный третий слой «настроение новостей» — накопительная
 *     ступенчатая кривая (дельта ±1 по сантименту, старт = 0, итог у конца)
 *     для графика недельного отчёта. БЕЗ пропа sentimentSeries компонент
 *     рендерится как раньше — два грида (цена+объём), каскадная деталь-панель
 *     не меняется. С пропом — три грида (~54/14/12%), dataZoom общий,
 *     ноль — пунктирная линия. Замещает гистограмму бакетов ПРАВКА-2 v1.
 */

import React, { useEffect, useMemo, useRef } from 'react'
import type { ECharts } from 'echarts'
import type { InstrumentChart } from '@/lib/newsChart'
import type { NewsMarker } from '@/lib/cascadesApi'
import { findNearestTimeIndex } from '@/lib/marketTime'

/** Маркер, привязанный к свече: индекс, цена (close) и признак «внутри торговой сессии» */
export interface MarkerPoint {
  marker: NewsMarker
  index: number
  price: number
  inSession: boolean
  /** ТЗ-97 §4.3 (уточнение): новость вне охвата графика ([первая свеча − 30 мин; covered_until + 30 мин]) —
   *  не рисуется, учитывается в чипе «+N вне графика». Клиппинг применяется ТОЛЬКО при
   *  truncated === true (каскад длиннее крышки 14 дней). Без truncated маркеры вне сессии
   *  привязываются к ближайшей свече и рисуются пунктиром — как обещает легенда. */
  clipped: boolean
}

/** Максимальный зазор до ближайшей свечи (5-мин бар), при котором новость считается «в сессии» */
const IN_SESSION_MAX_GAP_MS = 5 * 60 * 1000

/** Запас за пределы крайних свечей, в пределах которого маркер ещё рисуется (ТЗ-97 §4.3) */
const CLIP_PADDING_MS = 30 * 60 * 1000

/** Привязывает новости каскада к свечам инструмента (ближайшая свеча по времени).
 *  При truncated === true маркеры вне [первая свеча − 30 мин; covered_until + 30 мин]
 *  помечаются clipped: true и отрисовываться не должны. Без truncated клиппинга нет. */
export function buildMarkerPoints(instrument: InstrumentChart, markers: NewsMarker[]): MarkerPoint[] {
  const { times, ohlc, covered_until, truncated } = instrument
  if (times.length === 0) return []
  const firstCandleMs = new Date(times[0]).getTime()
  const coveredMs = truncated && covered_until ? new Date(covered_until).getTime() : null
  return markers.map((marker) => {
    const index = findNearestTimeIndex(times, marker.published_at)
    const candleMs = new Date(times[index]).getTime()
    const newsMs = new Date(marker.published_at).getTime()
    const clipped =
      coveredMs !== null &&
      (newsMs < firstCandleMs - CLIP_PADDING_MS || newsMs > coveredMs + CLIP_PADDING_MS)
    return {
      marker,
      index,
      price: ohlc[index] ? ohlc[index][1] : 0, // close
      inSession: Math.abs(candleMs - newsMs) <= IN_SESSION_MAX_GAP_MS,
      clipped,
    }
  })
}

/** ТЗ-97 §6: маркеры, привязанные к одной свече, рисуются одним символом с числом,
 *  тултип — списком новостей группы. Порядок групп — по первому вхождению. */
export interface MarkerGroup {
  index: number
  price: number
  points: MarkerPoint[]
}

export function groupMarkersByCandle(points: MarkerPoint[]): MarkerGroup[] {
  const groups = new Map<number, MarkerGroup>()
  for (const p of points) {
    const g = groups.get(p.index)
    if (g) g.points.push(p)
    else groups.set(p.index, { index: p.index, price: p.price, points: [p] })
  }
  return [...groups.values()]
}

/** ТЗ-98: элементы scatter-серии маркеров. Вынесено в чистую функцию — регрессионный
 *  страж на форму данных (координата только в value-паре, поле coord запрещено:
 *  ECharts игнорирует coord у series.data и слепливает маркеры у левого края). */
export interface ScatterDataItem {
  value: [number, number]
  symbolSize: number
  label: { show: boolean; formatter?: string; color?: string; fontSize?: number; fontWeight?: 'bold' }
  itemStyle: Record<string, unknown>
}

export function buildScatterDataItems(
  groups: MarkerGroup[],
  firstVisibleMarker: MarkerPoint['marker'] | null
): ScatterDataItem[] {
  return groups.map((g) => {
    const single = g.points.length === 1
    const p = g.points[0]
    const isFirst = p.marker === firstVisibleMarker
    const allInSession = g.points.every((pt) => pt.inSession)
    return {
      // scatter-серия НЕ понимает поле coord (это только markPoint/markLine) —
      // координаты передаём в value: [индекс свечи, цена], иначе x молча
      // становится порядковым номером маркера и всё слепляется у левого края (ТЗ-98).
      value: [g.index, g.price],
      // ТЗ-106: единый размер всех маркеров — размер ничего не кодирует
      // (порядок — в списке под графиком, первоисточник — белой обводкой).
      symbolSize: 12,
      label: single
        ? { show: false }
        : { show: true, formatter: String(g.points.length), color: '#060606', fontSize: 9, fontWeight: 'bold' },
      itemStyle: isFirst
        ? { color: '#00D4FF', borderColor: '#FFFFFF', borderWidth: 1.5 }
        : allInSession
          ? { color: 'rgba(0,212,255,0.7)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 0.5 }
          : {
              color: single ? 'transparent' : 'rgba(10,10,10,0.55)',
              borderColor: '#00D4FF',
              borderWidth: 1.5,
              borderType: 'dashed',
            },
    }
  })
}

/** ТЗ-194: точка накопительной кривой настроения из бэкенда
 *  (cum — баланс ПОСЛЕ новости; news_id — для клика/якоря к ленте тега) */
export interface SentimentPoint {
  t: string
  cum: number
  newsId?: string | null
}

/** ТЗ-194: точки-переломы цветом НОВОСТИ (--text-success / --text-error) */
const SENTIMENT_STEP_COLORS = { positive: '#34D399', negative: '#EF4444' } as const
/** Строка ступенчатой кривой — нейтральный --text-muted */
const SENTIMENT_LINE_COLOR = '#6B7280'

export interface SentimentStepItem {
  value: [number, number]
  /** мета для тултипа — из маркера той же новости (матч по published_at) */
  title: string
  source: string
  publishedAt: string
  /** id новости для клика; null — старые снапшоты (клик недоступен) */
  newsId: string | null
  itemStyle: { color: string }
}

export interface SentimentStepData {
  /** старт-точка [0-й свече, 0] + точки переломов: кривая от нуля по определению */
  items: SentimentStepItem[]
  /** автомасштаб оси Y (счёт; ноль внутри диапазона) */
  min: number
  max: number
  /** итог у конца кривой = последний cum = баланс тега за неделю */
  total: number
}

/** ТЗ-194: маппинг кривой на индексы свечей — step-данные с цветом точки по
 *  знаку дельты (цвет НОВОСТИ, не баланса). Вынесено в чистую функцию —
 *  регрессионный страж на форму данных. null — без свечей/пустая серия. */
export function buildSentimentStepData(
  times: string[],
  series: SentimentPoint[],
  markers: MarkerPoint[],
): SentimentStepData | null {
  if (times.length === 0 || series.length === 0) return null
  const byTime = new Map<string, NewsMarker>()
  for (const p of markers) byTime.set(p.marker.published_at, p.marker)
  const items: SentimentStepItem[] = [{ value: [0, 0], title: '', source: '', publishedAt: '', newsId: null, itemStyle: { color: 'transparent' } }]
  let prev = 0
  for (const p of series) {
    const idx = findNearestTimeIndex(times, p.t)
    const m = byTime.get(p.t)
    items.push({
      value: [idx, p.cum],
      title: m?.title ?? '',
      source: m?.source ?? '',
      publishedAt: p.t,
      newsId: p.newsId ?? null,
      itemStyle: { color: p.cum - prev >= 0 ? SENTIMENT_STEP_COLORS.positive : SENTIMENT_STEP_COLORS.negative },
    })
    prev = p.cum
  }
  const cums = series.map((p) => p.cum)
  let min = Math.min(0, ...cums)
  let max = Math.max(0, ...cums)
  if (min === max) { min -= 1; max += 1 }
  return { items, min, max, total: cums[cums.length - 1] }
}

function timeLabel(iso: string, tz: string): string {
  if (iso.length <= 10) return iso.slice(5, 10)
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

/** Подпись границы дня — DD.MM в таймзоне биржи (ТЗ-97 §4.2, как в мокапе cascades.html) */
function dayLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit' })
}

// Кэшируем промис динамического импорта echarts (паттерн CandleChart.tsx)
let echartsPromise: Promise<typeof import('echarts')> | null = null
function loadECharts() {
  if (!echartsPromise) echartsPromise = import('echarts')
  return echartsPromise
}

interface Props {
  instrument: InstrumentChart
  markers: MarkerPoint[]
  height?: number
  /** ТЗ-194: настроение новостей (накопительная кривая) — только недельный
   *  отчёт. Без пропа / null / пусто — макет как у каскадов (цена + объём),
   *  регрессии нет. */
  sentimentSeries?: SentimentPoint[] | null
  /** Клик по маркеру: все новости группы (ТЗ-97 §6 — маркеры на одной свече
   *  схлопнуты в один символ). Без пропа — маркеры некликабельны (каскады). */
  onMarkerGroupClick?: (markers: NewsMarker[]) => void
  /** ТЗ-194: клик по точке-перелому кривой — id новости для якоря к ленте
   *  тега. null — старые снапшоты без id (точка некликабельна). Без пропа —
   *  кривая некликабельна (каскады). */
  onSentimentPointClick?: (point: { newsId: string | null }) => void
}

function CascadeChart({ instrument, markers, height = 300, sentimentSeries, onMarkerGroupClick, onSentimentPointClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const labels = useMemo(
    () => instrument.times.map((t) => timeLabel(t, instrument.timezone)),
    [instrument.times, instrument.timezone]
  )

  // Границы дней — вертикальные markLine (индексы свечей, где меняется дата в таймзоне биржи)
  const dayBoundaries = useMemo(() => {
    const bounds: number[] = []
    let prevDate = ''
    instrument.times.forEach((iso, i) => {
      const date = new Date(iso).toLocaleDateString('ru-RU', { timeZone: instrument.timezone })
      if (i > 0 && date !== prevDate) bounds.push(i)
      prevDate = date
    })
    return bounds
  }, [instrument.times, instrument.timezone])

  // Видимые маркеры, сгруппированные по свече (ТЗ-97 §6: дубликаты — один символ с числом)
  const markerGroups = useMemo(
    () => groupMarkersByCandle(markers.filter((p) => !p.clipped)),
    [markers]
  )
  // Акцентная точка — первый видимый маркер (первоисточник; первый маркер может быть clipped)
  const firstVisibleMarker = useMemo(
    () => markers.find((p) => !p.clipped)?.marker ?? null,
    [markers]
  )

  // ТЗ-194: ступенчатая кривая настроения (null — без пропа/пусто: макет как у каскадов)
  const sentimentStep = useMemo(
    () => (sentimentSeries ? buildSentimentStepData(instrument.times, sentimentSeries, markers) : null),
    [instrument.times, sentimentSeries, markers]
  )

  useEffect(() => {
    if (!ref.current || instrument.times.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')

      // ТЗ-194: с пропом — три грида (цена/настроение/объём ~54/14/12%),
      // без — два как раньше (цена/объём ~62/14%), каскады не меняются
      const hasSent = sentimentStep !== null
      const grids = hasSent
        ? [
            { left: 34, right: 6, top: 16, height: '54%' },
            { left: 34, right: 6, top: '72%', height: '14%' },
            { left: 34, right: 6, top: '88%', height: '12%' },
          ]
        : [
            { left: 34, right: 6, top: 16, height: '62%' },
            { left: 34, right: 6, top: '82%', height: '14%' },
          ]
      const volumeGridIndex = hasSent ? 2 : 1

      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
        },
        grid: grids,
        xAxis: [
          { type: 'category', data: labels, scale: true, boundaryGap: false,
            axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#6B7280', fontSize: 10 } },
          ...(hasSent
            ? [{ type: 'category' as const, gridIndex: 1, data: labels,
                 axisLine: { lineStyle: { color: '#333' } }, axisLabel: { show: false } }]
            : []),
          { type: 'category', gridIndex: volumeGridIndex, data: labels,
            axisLine: { lineStyle: { color: '#333' } }, axisLabel: { show: false } },
        ],
        yAxis: [
          { scale: true, splitLine: { lineStyle: { color: '#1F2937' } }, axisLabel: { color: '#6B7280', fontSize: 10 } },
          ...(hasSent && sentimentStep
            ? [{ gridIndex: 1, min: sentimentStep.min, max: sentimentStep.max, splitLine: { show: false }, axisLabel: { show: false } }]
            : []),
          { gridIndex: volumeGridIndex, splitLine: { show: false }, axisLabel: { show: false } },
        ],
        dataZoom: [{ type: 'inside', xAxisIndex: hasSent ? [0, 1, 2] : [0, 1], filterMode: 'none' }],
        series: [
          {
            type: 'candlestick',
            data: instrument.ohlc,
            itemStyle: {
              color: '#16a34a', color0: '#dc2626',
              borderColor: '#16a34a', borderColor0: '#dc2626',
            },
            markLine: {
              silent: true,
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'solid' as const },
              // Подпись границы — дата (DD.MM) первой свечи нового дня в таймзоне биржи (ТЗ-97 §4.2)
              data: dayBoundaries.map((i) => ({
                xAxis: i,
                label: {
                  show: true,
                  formatter: () => dayLabel(instrument.times[i], instrument.timezone),
                  color: '#555',
                  fontSize: 9,
                },
              })),
            },
          },
          // ТЗ-194: накопительная кривая настроения — ступенчатая линия
          // (step-after: горизонталь от предыдущего значения, скачок в момент t),
          // точки-переломы цветом новости; ноль — пунктир; у конца — «итог: +N»
          ...(hasSent && sentimentStep
            ? [{
                type: 'line' as const, id: 'sentiment', xAxisIndex: 1, yAxisIndex: 1,
                step: 'end' as const,
                data: sentimentStep.items.map((it, i) =>
                  i === sentimentStep.items.length - 1
                    ? {
                        ...it,
                        label: {
                          show: true, position: 'right' as const,
                          formatter: `итог: ${sentimentStep.total > 0 ? '+' : ''}${sentimentStep.total}`,
                          color: sentimentStep.total >= 0 ? '#34D399' : '#EF4444',
                          fontSize: 10,
                        },
                      }
                    : it
                ),
                showSymbol: true, symbolSize: 5,
                lineStyle: { color: SENTIMENT_LINE_COLOR, width: 1 },
                markLine: {
                  silent: true, symbol: 'none', label: { show: false },
                  lineStyle: { color: 'rgba(255,255,255,0.25)', type: 'dashed' as const },
                  data: [{ yAxis: 0 }],
                },
                tooltip: {
                  formatter: (params: any) => {
                    const d = params.data
                    if (!d || !d.title) return ''
                    const time = new Date(d.publishedAt).toLocaleString('ru-RU', {
                      timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })
                    return `${d.title}<br/>${d.source} · ${time}`
                  },
                },
                z: 5,
              }]
            : []),
          {
            type: 'bar', xAxisIndex: volumeGridIndex, yAxisIndex: volumeGridIndex, data: instrument.volumes,
            itemStyle: { color: '#374151' },
          },
          {
            // Маркеры новостей: все одного размера (ТЗ-106), первая — акцентная
            // белой обводкой (первоисточник), вне сессии — «пустой» кружок с
            // пунктирной обводкой у ближайшей свечи.
            // ТЗ-97 §6: маркеры на одной свече группируются — один символ с числом,
            // тултип — списком новостей группы.
            type: 'scatter',
            data: buildScatterDataItems(markerGroups, firstVisibleMarker),
            tooltip: {
              formatter: (params: any) => {
                const g = markerGroups[params.dataIndex]
                if (!g) return ''
                const lines = g.points.map((p) => {
                  const time = new Date(p.marker.published_at).toLocaleString('ru-RU', {
                    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })
                  const suffix = p.inSession ? '' : ' · вне торговой сессии'
                  return `${p.marker.title}<br/>${p.marker.source} · ${time}${suffix}`
                })
                return lines.join(g.points.length > 1 ? '<br/><br/>' : '')
              },
            },
            z: 10,
          },
        ],
      })

      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(ref.current)

      // Клик по символу маркера — вся группа новостей свечи (схлопнутые)
      if (onMarkerGroupClick) {
        instance.on('click', (params: any) => {
          if (params.seriesType !== 'scatter') return
          const g = markerGroups[params.dataIndex]
          if (g) onMarkerGroupClick(g.points.map((p) => p.marker))
        })
      }
      // ТЗ-194: клик по точке-перелому кривой — якорь к новости в ленте тега
      if (onSentimentPointClick) {
        instance.on('click', (params: any) => {
          if (params.seriesId !== 'sentiment') return
          onSentimentPointClick({ newsId: params.data?.newsId ?? null })
        })
      }
    })

    return () => {
      disposed = true
      ro?.disconnect()
      instance?.dispose()
    }
  }, [instrument, labels, markers, dayBoundaries, markerGroups, firstVisibleMarker, sentimentStep, onMarkerGroupClick, onSentimentPointClick])

  if (instrument.times.length === 0) return null
  return <div ref={ref} style={{ width: '100%', height }} />
}

export default React.memo(CascadeChart)

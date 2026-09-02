import { useMemo, useRef, useState } from 'react'
import { CandlesPayload, HeatmapCell } from './types'
import { getVolumeDeltaColor } from './heatColors'

// ── Геометрия, 1:1 с YearGrid (не мини) ──────────────────────────────────────
// YearGrid: колонка дней недели width=14 + mr-2 (8px), затем недели flex gap=3,
// ячейка 14x14. Центр недели i: 22 + i*17 + 7.
const CELL = 14
const GAP = 3
const LEFT_PAD = 14 + 8        // колонка подписей Пн..Вс + её отступ
const STEP = CELL + GAP        // 17 — шаг недели

const CHART_HEIGHT = 200
const LABEL_H = 36             // верхняя зона: подпись тикера + значение
const BAND_H = 44              // нижняя зона: volume + дельта вокруг нулевой линии

interface WeekBar {
  date: string                 // понедельник недели
  ohlc: [number, number, number, number] | null
  pos: number
  neg: number
  stories: number
}

interface TopChartProps {
  candles: CandlesPayload | null   // null = режим «Без индекса»: только volume+дельта
  yearCells: HeatmapCell[]
  hoveredWeek?: string | null      // любая дата подсвеченной недели (из сетки)
  onHoverWeek?: (weekMonday: string | null) => void
  title?: string
  headerRight?: React.ReactNode    // сегмент «Без индекса | IMOEX | SPY"
}

export function weekMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().slice(0, 10)
}

export default function TopChart({
  candles,
  yearCells,
  hoveredWeek,
  onHoverWeek,
  title,
  headerRight,
}: TopChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null)

  const data = useMemo<WeekBar[]>(() => {
    const cellMap = new Map(yearCells.map((c) => [c.date, c]))
    const mondays = candles
      ? candles.full_dates
      : Array.from(new Set(yearCells.map((c) => weekMondayOf(c.date)))).sort()
    return mondays.map((monday, i) => {
      let pos = 0
      let neg = 0
      let stories = 0
      for (let d = 0; d < 7; d++) {
        const cur = new Date(monday + 'T00:00:00')
        cur.setDate(cur.getDate() + d)
        const c = cellMap.get(cur.toISOString().slice(0, 10))
        if (c) {
          pos += c.pos
          neg += c.neg
          stories += c.stories
        }
      }
      return {
        date: monday,
        ohlc: candles ? (candles.ohlc[i] as [number, number, number, number]) : null,
        pos,
        neg,
        stories,
      }
    })
  }, [candles, yearCells])

  const chartWidth = LEFT_PAD + data.length * STEP - GAP
  const weekX = (i: number) => LEFT_PAD + i * STEP + CELL / 2

  // Ценовая шкала (только если есть свечи)
  const prices = data.flatMap((d) => (d.ohlc ? d.ohlc : []))
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 1
  const priceRange = Math.max(maxPrice - minPrice, 0.0001)
  const priceTop = LABEL_H + 4
  const priceBottom = CHART_HEIGHT - BAND_H - 8
  const yPrice = (p: number) =>
    priceTop + (1 - (p - minPrice) / priceRange) * (priceBottom - priceTop)

  // Нижняя зона: нулевая линия по центру. Дельта и объём растут ОТ НУЛЯ
  // в сторону знака дельты (вверх — позитив, вниз — негатив), высоты ≤ половины полосы.
  const bandTop = CHART_HEIGHT - BAND_H
  const zeroY = bandTop + BAND_H / 2
  const maxStories = Math.max(...data.map((d) => d.stories), 1)
  const maxDelta = Math.max(...data.map((d) => Math.abs(d.pos - d.neg)), 1)
  const volH = (stories: number) => (stories / maxStories) * (BAND_H / 2 - 3)
  const deltaH = (delta: number) => (Math.abs(delta) / maxDelta) * (BAND_H / 2 - 3)

  const hoveredMonday = hoveredWeek ? weekMondayOf(hoveredWeek) : null
  const hoveredIdx = hoveredMonday ? data.findIndex((d) => d.date === hoveredMonday) : -1
  const tipData = tip ? data[tip.i] : null
  const last = data[data.length - 1]

  if (data.length === 0) {
    return (
      <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] p-6 text-center">
        <div className="text-sm text-text-muted">Нет данных по инструменту за выбранный период</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {(title || headerRight) && (
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </div>
          {headerRight && <div className="flex-shrink-0">{headerRight}</div>}
        </div>
      )}

      <div ref={wrapRef} className="relative w-full">
        <svg
          width="100%"
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMinYMid meet"
          onMouseLeave={() => {
            setTip(null)
            onHoverWeek?.(null)
          }}
        >
          {/* Подпись тикера: левый верхний угол поля графика (мастер-ТЗ п.4.2) */}
          {candles && (
            <>
              <text x={LEFT_PAD + 2} y={16} fontSize={14} fontWeight={700} fill="#fff">
                {candles.ticker}
              </text>
              {last?.ohlc && (
                <text x={LEFT_PAD + 2} y={30} fontSize={10} fill="rgba(255,255,255,0.55)">
                  {last.ohlc[1].toFixed(2)}
                </text>
              )}
            </>
          )}

          {/* Подсветка недели из сетки (обратная синхронизация) */}
          {hoveredIdx >= 0 && (
            <rect
              x={LEFT_PAD + hoveredIdx * STEP - GAP / 2}
              y={LABEL_H}
              width={STEP}
              height={CHART_HEIGHT - LABEL_H}
              fill="rgba(255,255,255,0.06)"
              rx={3}
            />
          )}

          {/* Нулевая линия нижней зоны */}
          <line
            x1={LEFT_PAD}
            y1={zeroY}
            x2={chartWidth}
            y2={zeroY}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const x = weekX(i)
            const delta = d.pos - d.neg
            const dColor = getVolumeDeltaColor(delta)
            const dh = deltaH(delta)
            return (
              <g key={d.date}>
                {/* volume: бледный бар ОТ НУЛЯ в сторону знака дельты ∝ stories (fix7).
                    Не пересекает нулевую линию — иначе серые «хвосты» по обе стороны. */}
                {(() => {
                  const vh = volH(d.stories)
                  const up = delta >= 0
                  return (
                    <rect
                      x={x - 3}
                      y={up ? zeroY - vh : zeroY}
                      width={6}
                      height={Math.max(vh, 1)}
                      fill="rgba(255,255,255,0.12)"
                      rx={1}
                    />
                  )
                })()}
                {/* дельта: от нулевой линии вверх (зелёная) или вниз (красная) ∝ |pos−neg|/maxD */}
                {delta !== 0 && (
                  <rect
                    x={x - 3}
                    y={delta > 0 ? zeroY - dh : zeroY}
                    width={6}
                    height={Math.max(dh, 1)}
                    fill={dColor}
                    opacity={0.9}
                    rx={1}
                  />
                )}
                {/* свеча */}
                {d.ohlc && (() => {
                  const [o, c, l, h] = d.ohlc!
                  return (
                    <>
                      <line
                        x1={x}
                        y1={yPrice(h)}
                        x2={x}
                        y2={yPrice(l)}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={1}
                      />
                      <rect
                        x={x - 2}
                        y={yPrice(Math.max(o, c))}
                        width={4}
                        height={Math.max(1, Math.abs(yPrice(o) - yPrice(c)))}
                        fill={o > c ? '#EF4444' : '#34D399'}
                        rx={1}
                      />
                    </>
                  )
                })()}
                {/* невидимая зона ховера на всю высоту колонки */}
                <rect
                  x={LEFT_PAD + i * STEP - GAP / 2}
                  y={0}
                  width={STEP}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const rect = wrapRef.current?.getBoundingClientRect()
                    setTip({
                      i,
                      x: rect ? e.clientX - rect.left : 0,
                      y: rect ? e.clientY - rect.top : 0,
                    })
                    onHoverWeek?.(d.date)
                  }}
                />
              </g>
            )
          })}
        </svg>

        {/* Всплывашка OHLC + новости недели (как в карточке тега) */}
        {tip && tipData && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-[#14161C]/95 px-3 py-2 text-[11px] leading-relaxed shadow-xl"
            style={{
              left: Math.min(Math.max(tip.x + 12, 8), (wrapRef.current?.clientWidth ?? 300) - 180),
              top: Math.max(tip.y - 10, 8),
              transform: 'translateY(-100%)',
            }}
          >
            <div className="text-white font-medium mb-0.5">{tipData.date} · неделя</div>
            {tipData.ohlc && (() => {
              const [o, c, l, h] = tipData.ohlc!
              const chg = o !== 0 ? ((c - o) / o) * 100 : 0
              return (
                <>
                  <div className="text-text-secondary">
                    О {o.toFixed(2)} · Макс {h.toFixed(2)} · Мин {l.toFixed(2)} · З {c.toFixed(2)}
                  </div>
                  <div style={{ color: chg >= 0 ? '#34D399' : '#EF4444' }}>
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)}% за неделю
                  </div>
                </>
              )
            })()}
            <div className="text-text-secondary">
              {tipData.stories} новостей · <span style={{ color: '#34D399' }}>+{tipData.pos}</span>
              {' / '}
              <span style={{ color: '#EF4444' }}>−{tipData.neg}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

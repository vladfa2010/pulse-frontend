/**
 * =============================================================================
 * ТЗ-143/144 — живой график инструмента в конспекте урока
 * =============================================================================
 *
 * Монтируется порталом в пустой div.chart-block (атом, свечи в БД не хранятся).
 * Запрос — ПЕРЕД рендером, лениво (IntersectionObserver, rootMargin 200px —
 * как NewsCard); ошибка/пустой ответ → ChartErrorCard (зеркало VideoErrorCard,
 * ТЗ-129). Используется на странице урока (LessonPage), в читалке (ReadMode)
 * и в описании курса (CoursePage) — везде, где sanitized HTML рендерится
 * через dangerouslySetInnerHTML (ТЗ-144).
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import CandleChart from '@/components/CandleChart'

export interface ChartBlockAttrs {
  ticker: string
  exchange: string
  name: string
  tf: string
  range: string
  width: string | null
}

interface ChartPayload {
  ticker: string
  exchange: string
  exchange_name: string
  tf: string
  range: string
  timezone: string
  times: string[]
  ohlc: number[][]
  volumes: number[]
}

/** Атрибуты из DOM-узла chart-block (data-* → пропсы). Единый парсер для
 *  всех поверхностей — чтобы не разъехались дефолты tf/range. */
export function readChartBlockAttrs(el: HTMLElement): ChartBlockAttrs {
  return {
    ticker: el.dataset.ticker || '',
    exchange: el.dataset.exchange || '',
    name: el.dataset.name || '',
    tf: el.dataset.tf || 'd1',
    range: el.dataset.range || '3M',
    width: el.dataset.width || null,
  }
}

export default function LessonChartBlock({ ticker, exchange, name, tf, range, width }: ChartBlockAttrs) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const { data, isError, refetch, isFetching } = useQuery<ChartPayload>({
    queryKey: ['lesson-chart', ticker, exchange, tf, range],
    queryFn: () => api.get(`/market/chart?ticker=${encodeURIComponent(ticker)}&exchange=${encodeURIComponent(exchange)}&tf=${encodeURIComponent(tf)}&range=${encodeURIComponent(range)}`),
    enabled: visible,
    staleTime: 60_000,
    retry: 1,
  })

  const tfLabel = tf === 'm5' ? '5 мин' : 'Дневки'

  return (
    <div ref={wrapRef} className="lesson-chart" style={width ? { width } : undefined}>
      {isError && (
        <ChartErrorCard ticker={ticker} exchange={exchange} onRetry={() => void refetch()} />
      )}
      {!isError && !data && (
        <div className="lesson-chart-skeleton">{visible ? 'Загружаем график…' : ''}</div>
      )}
      {!isError && data && data.times.length > 0 && (
        <>
          <div className="lesson-chart-head">
            <b>{ticker}</b>
            {name ? <span> · {name}</span> : null}
            <span className="lch-muted"> · {data.exchange_name} · {tfLabel} {range}</span>
            {isFetching && <span className="lch-muted"> · обновляем…</span>}
          </div>
          <CandleChart
            times={data.times}
            ohlc={data.ohlc}
            volumes={data.volumes}
            height={300}
            timezone={data.timezone}
            interactive
          />
        </>
      )}
      {!isError && data && data.times.length === 0 && (
        <ChartErrorCard ticker={ticker} exchange={exchange} onRetry={() => void refetch()} />
      )}
    </div>
  )
}

// Заставка недоступных данных — зеркало VideoErrorCard (ТЗ-129):
// тот же .player-err визуал, кнопки «Повторить» и «Написать в поддержку».
function ChartErrorCard({ ticker, exchange, onRetry }: { ticker: string; exchange: string; onRetry: () => void }) {
  return (
    <div className="player-err chart-err">
      <span className="pe-host">{ticker} · {exchange}</span>
      <div className="pe-ico">
        {/* chart-off: перечёркнутый график */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
          <path d="M3 3v16a2 2 0 0 0 2 2h16" strokeLinecap="round" />
          <path d="M7 14l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 3.5l17 17" strokeLinecap="round" />
        </svg>
      </div>
      <div className="pe-title">Данные недоступны</div>
      <div className="pe-text">
        Не удалось загрузить график {ticker} — это замедление на стороне
        поставщика рыночных данных, не у вас. Конспект урока доступен полностью.
      </div>
      <div className="pe-actions">
        <button type="button" className="btn-ghost-video" onClick={onRetry}>↻ Повторить</button>
        <a
          className="btn-accent-video"
          href="mailto:vladfa@yandex.ru?subject=%D0%93%D1%80%D0%B0%D1%84%D0%B8%D0%BA%20%D0%BD%D0%B5%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%B5%D0%BD%20%E2%80%94%20%D1%83%D1%80%D0%BE%D0%BA%20%D0%BA%D1%83%D1%80%D1%81%D0%B0"
        >
          Написать в поддержку
        </a>
      </div>
    </div>
  )
}

/**
 * =============================================================================
 * PULSE — Деталь-панель каскада (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Раскрывается кликом по строке таблицы или deep link ?cluster=<id> (сюда же
 * ведёт плашка на карточке новости из ТЗ-94). Данные — /market/cascade-chart:
 * свечи инструментов тегов кластера (переиспользуем форму InstrumentChart ТЗ-3)
 * + маркеры новостей кластера.
 *
 * Состав (по мокапу с учётом §2.5 ТЗ-93):
 *   - заголовок: факт первой новости + мета-строка (новостей · источников ·
 *     жизнь · ДИАПАЗОН цены в точках новостей, % от цены первой — считается
 *     на клиенте, свечи уже загружены);
 *   - график свечей с маркерами (первая — акцентная, дубли меньше, вне сессии
 *     — пунктирные метки) и легенда маркеров под графиком;
 *   - текстовый список новостей кластера (id у маркеров нет — ссылки невозможны,
 *     см. риски §4 ТЗ-93).
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useCascadeChart } from '@/lib/cascadesApi'
import { formatDecimal } from '@/lib/format'
import { formatLagMin, formatLifeMin, formatMskDateTime } from '@/lib/cascadeFormat'
import CascadeChart, { buildMarkerPoints } from '@/components/cascades/CascadeChart'

interface Props {
  clusterId: string
  onClose: () => void
}

export default function CascadeDetailPanel({ clusterId, onClose }: Props) {
  const { data, isLoading, isError, error, refetch } = useCascadeChart(clusterId)
  const [instrumentIdx, setInstrumentIdx] = useState(0)

  // При смене каскада сбрасываем выбранный инструмент
  useEffect(() => setInstrumentIdx(0), [clusterId])

  const instrument = data?.instruments?.[Math.min(instrumentIdx, (data?.instruments.length ?? 1) - 1)]

  // Привязка маркеров к свечам + диапазон цены в точках новостей (§2.5: только в детали)
  const markerPoints = useMemo(
    () => (instrument ? buildMarkerPoints(instrument, data?.news_markers ?? []) : []),
    [instrument, data?.news_markers]
  )

  const range = useMemo(() => {
    if (markerPoints.length === 0) return null
    let min = Infinity
    let max = -Infinity
    for (const p of markerPoints) {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
    }
    const firstPrice = markerPoints[0].price
    const pct = firstPrice > 0 ? ((max - min) / firstPrice) * 100 : 0
    return { min, max, pct }
  }, [markerPoints])

  const meta = useMemo(() => {
    const markers = data?.news_markers ?? []
    const sources = new Set(markers.map((m) => m.source))
    let lifeMin: number | null = null
    if (markers.length >= 2) {
      const first = new Date(markers[0].published_at).getTime()
      const last = new Date(markers[markers.length - 1].published_at).getTime()
      lifeMin = (last - first) / 60000
    }
    return { count: markers.length, sources: sources.size, lifeMin }
  }, [data?.news_markers])

  return (
    <section
      className="mt-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden scroll-mt-24"
      aria-label="Детали каскада"
    >
      {/* Шапка панели */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-primary mb-1">
            Каскад
          </div>
          <h3 className="text-sm font-semibold text-text-primary leading-snug">
            {data?.news_markers?.[0]?.title ?? 'Загрузка каскада…'}
          </h3>
          {data && (
            <p className="mt-1.5 text-xs text-text-muted">
              {meta.count} новостей · {meta.sources} источников
              {meta.lifeMin !== null && <> · жизнь {formatLifeMin(meta.lifeMin)}</>}
              {range && (
                <>
                  {' '}· диапазон {formatDecimal(range.min)}–{formatDecimal(range.max)}
                  {' '}({range.pct >= 0 ? '+' : ''}{formatDecimal(range.pct)}%)
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Закрыть детали каскада"
        >
          <X size={14} />
          Закрыть
        </button>
      </div>

      <div className="px-5 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent-primary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-10">
            <p className="text-sm text-text-secondary mb-3">
              {(error as Error)?.message?.includes('not found')
                ? 'Каскад не найден — возможно, он вышел из кэша окна.'
                : 'Не удалось загрузить график каскада.'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
            >
              Повторить
            </button>
          </div>
        )}

        {data && data.instruments.length === 0 && (
          <p className="text-sm text-text-muted py-6 text-center">
            У тегов каскада нет привязанных инструментов — график недоступен.
            Новости каскада — в списке ниже.
          </p>
        )}

        {data && instrument && (
          <>
            {/* Переключатель инструментов (до 3 тегов с инструментом) */}
            {data.instruments.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {data.instruments.map((inst, i) => (
                  <button
                    key={inst.tag_id}
                    onClick={() => setInstrumentIdx(i)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                      i === instrumentIdx
                        ? 'bg-white/[0.08] text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {inst.tag_name} · {inst.symbol}
                  </button>
                ))}
              </div>
            )}

            <CascadeChart instrument={instrument} markers={markerPoints} />

            {/* Легенда маркеров (как в мокапе) */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[11px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-accent-primary border border-white" />
                первоисточник
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-primary/70" />
                дубль
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-dashed border-accent-primary" />
                вне торговой сессии (метка у ближайшей свечи)
              </span>
            </div>
          </>
        )}

        {/* Список новостей кластера — текстовый (id у маркеров нет, риск §4 ТЗ-93) */}
        {data && data.news_markers.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Новости каскада ({data.news_markers.length})
            </div>
            <ol className="divide-y divide-white/[0.05]">
              {data.news_markers.map((m, i) => {
                const point = markerPoints[i]
                const lagMin = i === 0
                  ? null
                  : (new Date(m.published_at).getTime() - new Date(data.news_markers[0].published_at).getTime()) / 60000
                return (
                  <li key={i} className="flex items-baseline gap-3 py-2">
                    <span className="shrink-0 w-5 text-xs text-text-muted">{i + 1}</span>
                    <span className="shrink-0 text-xs text-text-muted w-[86px]">
                      {formatMskDateTime(m.published_at)}
                    </span>
                    <span className="shrink-0 text-xs text-text-secondary w-28 truncate">{m.source}</span>
                    <span className="flex-1 min-w-0 text-[13px] text-text-primary leading-snug">{m.title}</span>
                    {point && (
                      <span className="shrink-0 text-xs text-text-muted">{formatDecimal(point.price)}</span>
                    )}
                    <span className="shrink-0">
                      {i === 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-accent-primary/10 text-accent-primary">
                          первоисточник
                        </span>
                      ) : lagMin !== null ? (
                        <span className="text-[10px] text-text-muted">{formatLagMin(lagMin)}</span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

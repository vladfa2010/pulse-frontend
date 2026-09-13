/**
 * =============================================================================
 * PULSE — Вкладка «Ресерч: кто первый» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Живые числа — GET /market/cascade-research?window=7d|30d:
 * таблица «Кто чаще первый» + блок «Скорость каскада». Под числами —
 * статический редакционный блок «Выводы» / «Продуктовые следствия»: текст
 * обновляется ВРУЧНУЮ при пересмотре Методологии и может расходиться с живыми
 * числами (риск §4 ТЗ-93 — принято).
 */

import type { CascadeResearchResponse } from '@/lib/cascadesApi'
import { formatShare } from '@/lib/cascadeFormat'
import { formatDecimal } from '@/lib/format'

// ─── РЕДАКЦИОННЫЙ ТЕКСТ, обновлять при пересмотре Методологии ──────────────
// Дата редакции: 2026-09-13
const EDITORIAL = {
  conclusions: [
    'Первенство у источников прямого эфира: агентства новостей чаще всех открывают каскады, но список первоисточников зависит от темы — хардкодить «wire-источники» нельзя.',
    'Первый дубль в медиане приходит через десятки минут после первоисточника: у трейдера есть окно между первой публикацией и волной перепечаток.',
    'Высокий first-rate у издания не отменяет систематического отставания: у части источников медианный лаг «когда не первый» — десятки минут, для оперативной ленты такие источники вторичны.',
  ],
  product: [
    'Событие, подтверждённое каскадом (2+ независимых источника), надёжнее одиночной новости: страница «Каскады» и плашка каскада на карточке работают как встроенный фильтр достоверности.',
    '«Информационное отставание» источника (медианный лаг, когда он не первый) — кандидат в метрику качества источника для персональной ленты.',
    'Скорость каскада — ориентир для оповещений: по каскадам с медианным лагом первого дубля в пределах ~10 минут новость дочитывает половина рынка уже в момент публикации.',
  ],
}
// ─── конец редакционного блока ──────────────────────────────────────────────

const WINDOW_LABELS: Record<string, string> = { '7d': '7 дней', '30d': '30 дней' }

function formatMedianLag(min: number | null): string {
  if (min === null) return '—'
  return `${formatDecimal(min, min < 10 ? 1 : 0)} мин`
}

interface Props {
  data: CascadeResearchResponse
}

export default function ResearchTab({ data }: Props) {
  const { speed } = data

  return (
    <div className="space-y-6">
      {/* Таблица «Кто чаще первый»; в заголовке — живые «N каскадов, окно» */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Источник
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Первым
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Доля
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Участий
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">
                First-rate
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Лаг, когда не первый
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {data.sources.map((s) => (
              <tr key={s.source} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-2.5 text-[13px] text-text-primary">{s.source}</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-text-primary">{s.first_count}</td>
                <td className="px-4 py-2.5 text-right text-xs text-text-secondary">{formatShare(s.share)}</td>
                <td className="px-4 py-2.5 text-right text-xs text-text-secondary">{s.participations}</td>
                <td className="px-4 py-2.5 text-right text-xs text-text-secondary">{formatShare(s.first_rate)}</td>
                <td className="px-4 py-2.5 text-right text-xs text-text-muted whitespace-nowrap">
                  {formatMedianLag(s.median_lag_not_first)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[10px] text-text-muted border-t border-white/[0.05]">
          {data.clusters_total} каскадов, окно {WINDOW_LABELS[data.window] ?? data.window}
        </p>
      </div>

      {/* Блок «Скорость каскада» */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Скорость каскада</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SpeedCard
            label="Медиана первого дубля"
            value={speed.median_second_lag_min !== null ? `${formatDecimal(speed.median_second_lag_min, speed.median_second_lag_min < 10 ? 1 : 0)} мин` : '—'}
          />
          <SpeedCard
            label="Дубль ≤ 10 мин"
            value={formatShare(speed.dup_le_10m_share)}
            hint={`${speed.dup_le_10m} из ${speed.cascades_with_second}`}
          />
          <SpeedCard
            label="Дубль ≤ 60 мин"
            value={formatShare(speed.dup_le_60m_share)}
            hint={`${speed.dup_le_60m} из ${speed.cascades_with_second}`}
          />
          <SpeedCard
            label="Каскадов с дублем"
            value={String(speed.cascades_with_second)}
            hint={`из ${data.clusters_total} каскадов окна`}
          />
        </div>
      </div>

      {/* Редакционный блок — статика, см. пометку у константы EDITORIAL */}
      <div className="grid md:grid-cols-2 gap-4">
        <EditorialCard title="Выводы" paragraphs={EDITORIAL.conclusions} />
        <EditorialCard title="Продуктовые следствия" paragraphs={EDITORIAL.product} />
      </div>
    </div>
  )
}

function SpeedCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{label}</div>
      <div className="text-xl font-semibold text-text-primary">{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-1">{hint}</div>}
    </div>
  )
}

function EditorialCard({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
      <h4 className="text-sm font-semibold text-text-primary mb-2.5">{title}</h4>
      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-xs leading-relaxed text-text-secondary">{p}</p>
        ))}
      </div>
    </div>
  )
}

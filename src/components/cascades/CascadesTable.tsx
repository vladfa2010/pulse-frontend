/**
 * =============================================================================
 * PULSE — Таблица каскадов, вкладка «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Колонки по мокапу с учётом §2.5 (колонки «Вердикт» и «Диапазон» НЕ переносим):
 *   Начало (МСК) | Факт (первая новость + источник) | Теги | Разм. |
 *   Цепочка источников (стрелками, подряд идущие повторы схлопнуты) | Жизнь.
 * Сортировка — кликом по заголовку (клиентская, как data-sort в мокапе):
 * первый клик — по убыванию, второй — по возрастанию. Дефолт — size DESC
 * (как отдаёт бэкенд). Пустое окно — норма, не ошибка.
 */

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Cascade } from '@/lib/cascadesApi'
import { collapseSources, formatLifeMin, formatMskDateTime } from '@/lib/cascadeFormat'

type SortKey = 'first_published_at' | 'title' | 'size' | 'life_min'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey | null; label: string; className: string }[] = [
  { key: 'first_published_at', label: 'Начало', className: 'w-[92px]' },
  { key: 'title', label: 'Факт', className: '' },
  { key: null, label: 'Теги', className: 'w-[140px] hidden lg:table-cell' },
  { key: 'size', label: 'Разм.', className: 'w-[56px] text-right' },
  { key: null, label: 'Цепочка источников', className: 'w-[180px] hidden md:table-cell' },
  { key: 'life_min', label: 'Жизнь', className: 'w-[72px] text-right' },
]

function getValue(c: Cascade, key: SortKey): string | number {
  switch (key) {
    case 'first_published_at': return c.first_published_at ?? ''
    case 'title': return c.first_news?.title ?? ''
    case 'size': return c.size
    case 'life_min': return c.life_min ?? -1
  }
}

interface Props {
  cascades: Cascade[]
  selectedClusterId: string | null
  onSelect: (clusterId: string) => void
}

export default function CascadesTable({ cascades, selectedClusterId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('size')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      // второй клик по той же колонке — разворачиваем направление
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      // первый клик по новой колонке — по убыванию (как в мокапе)
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...cascades]
    arr.sort((a, b) => {
      const va = getValue(a, sortKey)
      const vb = getValue(b, sortKey)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [cascades, sortKey, sortDir])

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03]">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted ${col.className}`}
              >
                {col.key ? (
                  <button
                    onClick={() => handleSort(col.key!)}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-text-primary ${sortKey === col.key ? 'text-accent-primary' : ''}`}
                  >
                    {col.label}
                    {sortKey === col.key &&
                      (sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {sorted.map((c) => {
            const chain = collapseSources(c.sources)
            return (
              <tr
                key={c.cluster_id}
                onClick={() => onSelect(c.cluster_id)}
                className={`cursor-pointer transition-colors ${
                  selectedClusterId === c.cluster_id
                    ? 'bg-accent-primary/[0.07]'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                  {formatMskDateTime(c.first_published_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[13px] text-text-primary leading-snug line-clamp-2">
                    {c.first_news?.title ?? '—'}
                  </div>
                  {c.first_news?.source && (
                    <div className="text-[10px] text-text-muted mt-0.5">{c.first_news.source}</div>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.05] text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                    {c.tags.length > 3 && (
                      <span className="text-[9px] text-text-muted">+{c.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-text-primary">
                  {c.size}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-[11px] text-text-secondary leading-snug">
                    {chain.join(' → ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-text-muted whitespace-nowrap">
                  {formatLifeMin(c.life_min)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * =============================================================================
 * PULSE — Таблица сюжетов, вкладка «Сюжеты» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Колонки по мокапу с учётом §2.5 (колонка «Волат.» НЕ переносим):
 *   Сюжет | Новостей (сумма size входящих кластеров — свойство модели, §2.5) |
 *   Период (МСК) | Описание (summary).
 * Клик по строке → вкладка «Каскады» с раскрытым первым (крупнейшим) кластером
 * сюжета (?cluster=<id>).
 */

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Story } from '@/lib/cascadesApi'
import { formatMskPeriod } from '@/lib/cascadeFormat'

type SortKey = 'title' | 'news_count' | 'period'
type SortDir = 'asc' | 'desc'

function storyNewsCount(s: Story): number {
  return s.clusters.reduce((sum, c) => sum + c.size, 0)
}

/** Кластер для детальной панели: крупнейший по size (бэкенд отдаёт size DESC) */
export function storyLeadClusterId(s: Story): string | null {
  return s.clusters[0]?.cluster_id ?? null
}

interface Props {
  stories: Story[]
  onSelect: (clusterId: string) => void
}

export default function StoriesTable({ stories, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('news_count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...stories]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title, 'ru')
      else if (sortKey === 'news_count') cmp = storyNewsCount(a) - storyNewsCount(b)
      else cmp = (a.started_at ?? '').localeCompare(b.started_at ?? '')
      return sortDir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [stories, sortKey, sortDir])

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03]">
            <th className="px-4 py-2.5 text-left">
              <SortButton label="Сюжет" active={sortKey === 'title'} dir={sortDir} onClick={() => handleSort('title')} />
            </th>
            <th className="px-4 py-2.5 text-right w-[90px]">
              <SortButton label="Новостей" active={sortKey === 'news_count'} dir={sortDir} onClick={() => handleSort('news_count')} />
            </th>
            <th className="px-4 py-2.5 text-left w-[190px]">
              <SortButton label="Период" active={sortKey === 'period'} dir={sortDir} onClick={() => handleSort('period')} />
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Описание
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {sorted.map((s) => (
            <tr
              key={s.story_id}
              onClick={() => {
                const clusterId = storyLeadClusterId(s)
                if (clusterId) onSelect(clusterId)
              }}
              className={`cursor-pointer transition-colors ${
                storyLeadClusterId(s) ? 'hover:bg-white/[0.03]' : 'opacity-60 cursor-default'
              }`}
            >
              <td className="px-4 py-3">
                <div className="text-[13px] font-medium text-text-primary leading-snug">{s.title}</div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {s.clusters.length} {s.clusters.length === 1 ? 'каскад' : 'каскадов'}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-text-primary">
                {storyNewsCount(s)}
              </td>
              <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                {formatMskPeriod(s.started_at, s.last_seen_at)}
              </td>
              <td className="px-4 py-3 text-xs text-text-secondary leading-snug max-w-[380px]">
                <span className="line-clamp-3">{s.summary ?? '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-text-primary ${active ? 'text-accent-primary' : 'text-text-muted'}`}
    >
      {label}
      {active && (dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
    </button>
  )
}

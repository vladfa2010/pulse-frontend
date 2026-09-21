/**
 * PULSE — Радио: бегущая строка (ТЗ-44, задача 3).
 * Порт TickerBar.tsx как есть; марк severity → цвет по числовому score
 * (≥8.5 красный, ≥7 жёлтый, иначе серый) — severity больше нет.
 */
import type { RadioNewsItem } from '@/types/radio'

function markColor(score: number): string {
  if (score >= 8.5) return '#f87171'
  if (score >= 7) return '#facc15'
  return '#71717a'
}

export function TickerBar({ items }: { items: RadioNewsItem[] }) {
  const seq = [...items, ...items]
  return (
    <div className="overflow-hidden border-b border-zinc-800 bg-zinc-900/60">
      <div className="radio-ticker py-1.5 text-[10px] tracking-[0.08em]">
        {seq.map((n, i) => (
          <span key={n.id + i} className="mx-5 inline-flex items-center gap-2 text-zinc-500">
            <span style={{ color: markColor(n.score) }}>{n.score >= 8.5 ? '●' : n.score >= 7 ? '◆' : '·'}</span>
            <span className="text-zinc-200">{n.title}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

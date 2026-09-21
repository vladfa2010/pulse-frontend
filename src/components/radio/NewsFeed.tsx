/**
 * PULSE — Радио: лента новостей эфира (ТЗ-44, задача 3).
 * Порт NewsFeed.tsx: severity-чипы → цветной числовой score-чип (≥8.5 красный,
 * ≥7 жёлтый, иначе серый; score = 0 — ни чипа); «ПЕРЕПЕЧАТКА ×N» — по
 * item.sources; блок «Что это значит» — из ТЗ-43 (sentiment_reasoning +
 * строки tag_impact). Время — из ISO published_at.
 */
import { useState } from 'react'
import type { RadioNewsItem } from '@/types/radio'
import { shareText, newsShareText } from '@/lib/radio/share'
import { buildImpactLines } from '@/lib/radio/newsAdapter'
import type { TagMap } from '@/lib/radio/tagMap'

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function ShareButton({ item }: { item: RadioNewsItem }) {
  const [state, setState] = useState<'idle' | 'copied'>('idle')
  return (
    <button
      onClick={async () => {
        const s = newsShareText(item)
        const r = await shareText(s.title, s.text)
        if (r === 'copied') {
          setState('copied')
          setTimeout(() => setState('idle'), 1800)
        }
      }}
      className={`mt-0.5 shrink-0 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
        state === 'copied'
          ? 'border-emerald-400 text-emerald-400'
          : 'border-zinc-800 text-zinc-500 hover:border-cyan-400 hover:text-cyan-400'
      }`}
      title="Поделиться новостью"
    >
      {state === 'copied' ? '✓ скопировано' : '↗'}
    </button>
  )
}

export function scoreColorText(score: number): string {
  if (score >= 8.5) return '#f87171'
  if (score >= 7) return '#facc15'
  return '#71717a'
}

interface Props {
  items: RadioNewsItem[]
  freshIds: ReadonlySet<string>
  readIds: ReadonlySet<string>
  speakingId: string | null
  queuedIds: ReadonlySet<string>
  userTagIds: ReadonlySet<string>
  tagMap: TagMap
  onRead: (item: RadioNewsItem) => void
}

export function NewsFeed({
  items,
  freshIds,
  readIds,
  speakingId,
  queuedIds,
  userTagIds,
  tagMap,
  onRead,
}: Props) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-[#060606]/95 px-4 py-2 backdrop-blur">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Новостная лента
        </span>
        <span className="text-[9px] tabular-nums text-zinc-500">
          {items.length} сообщ. · {items.filter((n) => !readIds.has(n.id)).length} непрочитано
        </span>
      </div>
      <ul>
        {items.map((n) => {
          const speaking = speakingId === n.id
          const queued = queuedIds.has(n.id)
          const read = readIds.has(n.id)
          const impactLines = buildImpactLines(n, userTagIds, tagMap)
          const reasoningParagraphs = n.sentimentReasoning
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
          return (
            <li
              key={n.id}
              className={`group border-b border-zinc-800 px-4 py-3 transition-opacity hover:bg-zinc-900/60 ${
                freshIds.has(n.id) ? 'radio-news-in' : ''
              } ${speaking ? 'bg-zinc-900/60' : ''} ${read && !speaking ? 'opacity-45' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                {n.score > 0 && (
                  <span
                    className="shrink-0 border px-1.5 py-px text-[9px] font-bold tabular-nums tracking-[0.1em]"
                    style={{ color: scoreColorText(n.score), borderColor: scoreColorText(n.score) }}
                    title="Оценка важности"
                  >
                    {n.score}
                  </span>
                )}
                {n.reprint && (
                  <span className="shrink-0 border border-dashed border-yellow-400/70 px-1.5 py-px text-[8px] font-bold tracking-[0.16em] text-yellow-400">
                    ПЕРЕПЕЧАТКА{n.sources.length > 1 ? ` ×${n.sources.length}` : ''}
                  </span>
                )}
                <span className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                  {n.source}
                </span>
                <span className="ml-auto text-[9px] tabular-nums text-zinc-500">
                  {formatTime(n.time)}
                </span>
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold leading-snug text-white">
                    <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-cyan-300">
                      {n.title}
                    </a>
                  </h3>
                  {n.text && <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{n.text}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => onRead(n)}
                    className={`mt-0.5 shrink-0 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      speaking
                        ? 'border-cyan-400 text-cyan-400'
                        : queued
                          ? 'border-yellow-400 text-yellow-400'
                          : 'border-zinc-800 text-zinc-500 hover:border-cyan-400 hover:text-cyan-400'
                    }`}
                    title="Поставить новость в очередь на чтение"
                  >
                    {speaking ? 'звучит' : queued ? 'в очереди' : '▶ читать'}
                  </button>
                  <ShareButton item={n} />
                </div>
              </div>
              {(reasoningParagraphs.length > 0 || impactLines.length > 0) && (
                <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Что это значит
                  </div>
                  {reasoningParagraphs.map((p, i) => (
                    <p key={i} className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                      {p}
                    </p>
                  ))}
                  {impactLines.map((l, i) => (
                    <p key={`imp-${i}`} className="mt-1.5 text-[11px]">
                      <span className="text-cyan-400">{l.name}</span>
                      <span className={l.score >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                        {' '}
                        {l.score >= 0 ? '+' : ''}
                        {l.score}
                      </span>
                      <span className="text-zinc-500"> — {l.reasoning}</span>
                    </p>
                  ))}
                </div>
              )}
              {n.tags.length > 0 && (
                <div className="mt-1.5 flex gap-1.5">
                  {n.tags.map((t) => (
                    <span key={t} className="text-[9px] text-zinc-500">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

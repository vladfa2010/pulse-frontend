/**
 * =============================================================================
 * PULSE — Радио: клиентские саммари-фолбэки (ТЗ-44, задача 2)
 * =============================================================================
 *
 * Порт radio-app/src/lib/summary.ts, адаптированный на Pulse-поля:
 *   - у RadioNewsItem нет storyKey: «сюжетность» = перепечатки (reprint),
 *     уникальные сюжеты = не-перепечатки;
 *   - severity → числовые пороги score (≥8.5 «срочное», ≥7 «на заметку»);
 *   - userTags — ИМЕНА тегов юзера (для сверки с item.tags, lowercase);
 *   - summary → item.text.
 *
 * Остаётся ФОЛБЭКОМ, когда LLM-эндпоинты (/api/user/summary,
 * /api/user/summary-global) недоступны — основной путь SummaryBar → API.
 */
import type { RadioNewsItem, RadioQuote, RadioSegment } from '@/types/radio'
import { formatPrice } from '@/hooks/useMarket'
import { helloWord } from './greeting'

export interface MarketSummary {
  id: string
  text: string
  segments: RadioSegment[]
  createdAt: number
  freshCount: number
}

/** уникальные сюжеты: перепечатки не считаются отдельными новостями */
function uniqueStories(items: RadioNewsItem[]): RadioNewsItem[] {
  return items.filter((n) => !n.reprint)
}

const ORDINALS = ['Во-первых', 'Во-вторых', 'В-третьих', 'И наконец']

/** главные темы ленты по частоте тегов */
function topThemes(stories: RadioNewsItem[], count: number): string[] {
  const freq = new Map<string, number>()
  for (const n of stories) for (const t of n.tags) freq.set(t, (freq.get(t) ?? 0) + 1)
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([t]) => t)
}

/** «своё саммари»: что важного юзер пропустил + его наблюдение.
 *  Без интересов (userTagNames пуст) — общее саммари: главные сюжеты и темы дня. */
export function buildPersonalSummary(
  feed: RadioNewsItem[],
  readIds: ReadonlySet<string>,
  quotes: RadioQuote[],
  topN = 4,
  userTagNames: string[] = []
): RadioSegment[] {
  const unread = uniqueStories(feed.filter((n) => !readIds.has(n.id)))
  const segs: RadioSegment[] = []

  if (unread.length === 0) {
    segs.push({
      role: 'single',
      text: `${helloWord()}! Персональное саммари. Вы всё прочитали — непропущенных новостей нет. Рынок никуда не убежал.`,
    })
    return segs
  }

  const reprintsHidden = feed.filter((n) => !readIds.has(n.id)).length - unread.length
  const hiddenLine =
    reprintsHidden > 0 ? `Ещё ${reprintsHidden} перепечаток скрыто, чтобы не повторяться. ` : ''

  // --- режим без интересов: общее саммари, сюжеты и темы ---
  if (userTagNames.length === 0) {
    const themes = topThemes(unread, 3)
    const top = [...unread].sort((a, b) => b.score - a.score).slice(0, topN)
    segs.push({
      role: 'single',
      text: `${helloWord()}! Ваши интересы пока не заданы, поэтому расскажу общую картину: главные сюжеты и темы. Непрочитанных сюжетов: ${unread.length}. ${hiddenLine}`,
    })
    if (themes.length > 0) {
      segs.push({
        role: 'single',
        text: `Главные темы сейчас: ${themes.join(', ')}.`,
      })
    }
    top.forEach((n, i) => {
      segs.push({
        role: 'single',
        text: `${ORDINALS[Math.min(i, 3)]}: ${n.title}. ${n.text}`,
      })
    })
    segs.push({
      role: 'single',
      text: 'Это общая картина. Отметьте свои темы в портфеле — и я начну саммари с того, что важно именно вам.',
    })
    return segs
  }

  // --- персональный режим: сначала ваши темы ---
  const tagSet = new Set(userTagNames.map((t) => t.toLowerCase()))
  const matches = (n: RadioNewsItem) => n.tags.some((t) => tagSet.has(t.toLowerCase()))
  const mine = unread.filter(matches).sort((a, b) => b.score - a.score)
  const rest = unread.filter((n) => !matches(n)).sort((a, b) => b.score - a.score)
  const picked = [...mine, ...rest].slice(0, topN)

  segs.push({
    role: 'single',
    text: `${helloWord()}! Персональное саммари. Непрочитанных сюжетов: ${unread.length}. ${hiddenLine}${
      mine.length > 0
        ? `По вашим темам — ${userTagNames.slice(0, 3).join(', ')} — ${mine.length} сюжетов. Начну с них.`
        : 'По вашим темам сегодня тихо, расскажу главное в целом.'
    }`,
  })

  picked.forEach((n, i) => {
    const isMine = matches(n)
    segs.push({
      role: 'single',
      text: `${ORDINALS[Math.min(i, 3)]}${isMine ? ', ваша тема' : ''}: ${n.title}. ${n.text}`,
    })
  })

  if (mine.length > topN) {
    segs.push({
      role: 'single',
      text: `По вашим темам осталось ещё ${mine.length - topN} сюжетов — они ждут в ленте.`,
    })
  }

  if (quotes.length > 0) {
    const parts = quotes
      .slice(0, 3)
      .map(
        (q) =>
          `${q.name} — ${formatPrice(q.price)} долларов, ${q.changePct >= 0 ? 'плюс' : 'минус'} ${Math.abs(q.changePct).toFixed(1)} процента за сутки`
      )
      .join('; ')
    segs.push({ role: 'single', text: `В вашем наблюдении: ${parts}.` })
  }

  segs.push({
    role: 'single',
    text: 'Это главное лично для вас. Подробности — в ленте, перепечатки помечены.',
  })
  return segs
}

/** зачитать котировки наблюдения голосом */
export function buildQuotesSegments(quotes: RadioQuote[]): RadioSegment[] {
  if (quotes.length === 0) {
    return [{ role: 'single', text: 'Наблюдение пусто — добавьте активы, и я буду следить за ними.' }]
  }
  const segs: RadioSegment[] = [{ role: 'single', text: 'Котировки вашего наблюдения на текущий момент.' }]
  for (const q of quotes) {
    segs.push({
      role: 'single',
      text: `${q.name}: ${formatPrice(q.price)} долларов, ${q.changePct >= 0 ? 'плюс' : 'минус'} ${Math.abs(q.changePct).toFixed(2)} процента за сутки.`,
    })
  }
  const sorted = [...quotes].sort((a, b) => a.changePct - b.changePct)
  if (sorted.length >= 2) {
    segs.push({
      role: 'single',
      text: `Лидер дня в вашем списке — ${sorted[sorted.length - 1].name}. Слабее всех — ${sorted[0].name}. Слежу за резкими движениями — если что-то дёрнется, скажу сразу.`,
    })
  }
  return segs
}

/** «общее саммари рынка»: формируется, когда накопился порог свежих новостей.
 *  score ≥ 8.5 — «срочное», ≥7 — «на заметку» (бывшие critical/high). */
export function buildMarketSummary(
  feed: RadioNewsItem[],
  quotes: RadioQuote[],
  freshCount: number,
  threshold: number
): MarketSummary {
  const stories = uniqueStories(feed)
  const reprints = feed.length - stories.length
  const criticals = stories.filter((n) => n.score >= 8.5)
  const highs = stories.filter((n) => n.score >= 7 && n.score < 8.5)

  const tagFreq = new Map<string, number>()
  for (const n of stories) for (const t of n.tags) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1)
  const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

  const mood =
    criticals.length >= 3
      ? 'Тональность рынка — нервная: срочных сюжетов много, волатильность на входе.'
      : criticals.length >= 1
        ? 'Тональность рынка — напряжённая, но без паники.'
        : 'Тональность рынка — спокойная, срочных сюжетов не накопилось.'

  const quoteLine =
    quotes.length > 0
      ? 'Котировки сейчас: ' +
        quotes
          .slice(0, 4)
          .map(
            (q) =>
              `${q.name} ${formatPrice(q.price)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(1)}%)`
          )
          .join(', ') +
        '.'
      : ''

  const text = [
    `Проанализировано ${freshCount} свежих новостей; ${reprints} перепечаток отфильтровано — повторов в эфире не будет.`,
    mood,
    topTags.length > 0 ? `Главные темы периода: ${topTags.join(', ')}.` : '',
    criticals.length > 0 ? `Срочное: ${criticals[0].title}.` : '',
    highs.length > 0 ? `На заметку: ${highs[0].title}.` : '',
    quoteLine,
    `Следующее саммари — когда накопится ещё ${threshold} свежих.`,
  ]
    .filter(Boolean)
    .join(' ')

  const segments: RadioSegment[] = [
    {
      role: 'single',
      text: `Общее саммари рынка. Проанализировано ${freshCount} свежих новостей, ${reprints} перепечаток отфильтровано.`,
    },
    { role: 'single', text: mood },
    ...(topTags.length > 0
      ? [{ role: 'single' as const, text: `Главные темы периода: ${topTags.join(', ')}.` }]
      : []),
    ...criticals.slice(0, 2).map((n) => ({
      role: 'single' as const,
      text: `Срочное: ${n.title}. ${n.text}`,
    })),
    ...highs.slice(0, 1).map((n) => ({
      role: 'single' as const,
      text: `На заметку: ${n.title}.`,
    })),
    ...(quoteLine ? [{ role: 'single' as const, text: quoteLine }] : []),
    {
      role: 'single',
      text: `На этом саммари закончено. Следующее — когда накопится ещё ${threshold} свежих новостей.`,
    },
  ]

  return {
    id: `ms-${Date.now()}`,
    text,
    segments,
    createdAt: Date.now(),
    freshCount,
  }
}

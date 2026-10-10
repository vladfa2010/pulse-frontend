/**
 * =============================================================================
 * PULSE — Радио: адаптер новости Pulse → карточка эфира (ТЗ-43, задача 2;
 * ТЗ-54: чистка HTML из title/summary)
 * =============================================================================
 *
 * score (без severity!): max |tag_impact[].score| по тегам юзера →
 * иначе |sentiment_score| → иначе 0. score = 0 → хвост сортировки,
 * чип и голосовая фраза пропускаются (не выдумываем).
 *
 * ТЗ-54: источники (RSS/парсеры) присылают сырой HTML прямо в summary —
 * напр. <a href="https://…/150-символов…">. В ленте это мусорный текст,
 * непереносимый URL растягивал колонку (QueuePanel уезжал за экран),
 * в TTS разметка уходила голосом. stripHtml срезает теги, оставляя
 * текстовое содержимое («Далее» вместо тега ссылки).
 */
import type { NewsArticle } from '@/types/news'
import type { RadioNewsItem } from '@/types/radio'
import { tagName, type TagMap } from './tagMap'

/** Срезать HTML-теги, оставив текстовое содержимое. Без '<' — возврат как есть (дешёвый путь). */
export function stripHtml(s: string): string {
  if (!s || !s.includes('<')) return s
  const doc = new DOMParser().parseFromString(s, 'text/html')
  return (doc.body.textContent ?? '').replace(/[ \t]+\n/g, '\n').trim()
}

export function adaptPulseToNewsItem(
  article: NewsArticle,
  userTagIds: ReadonlySet<string>,
  tagMap: TagMap
): RadioNewsItem {
  const impacts = article.tag_impact ?? []
  const userImpacts = impacts.filter((i) => userTagIds.has(i.tag))

  let score: number
  if (userImpacts.length > 0) {
    // Импакты по тегам юзера есть — берём max |score|, даже если все 0
    // (LLM-фолбэк пайплайна: новость реально без оценки, не выдумываем)
    score = Math.max(0, ...userImpacts.map((i) => Math.abs(i.score ?? 0)))
  } else {
    score = Math.abs(article.sentiment_score ?? 0)
  }

  const sourceCount = article.source_count ?? 1

  return {
    id: article.id,
    time: article.published_at ?? '',
    title: stripHtml(article.title_ru ?? article.title_original ?? ''),
    text: stripHtml(article.summary_ru ?? article.summary_original ?? ''),
    source: article.source,
    url: article.url ?? '',
    tags: (article.matched_tags ?? []).map((id) => tagName(tagMap, id)),
    score,
    reprint: sourceCount > 1,
    sources: article.all_sources ?? [article.source],
    tagImpact: impacts,
    sentimentReasoning: article.sentiment_reasoning ?? '',
  }
}

/** Строки влияния для блока «Что это значит»: теги юзера первыми (по |score|), затем остальные */
export function buildImpactLines(
  item: RadioNewsItem,
  userTagIds: ReadonlySet<string>,
  tagMap: TagMap
): { name: string; score: number; reasoning: string }[] {
  return [...item.tagImpact]
    .filter((i) => i.reasoning?.trim())
    .sort((a, b) => {
      const aUser = userTagIds.has(a.tag) ? 1 : 0
      const bUser = userTagIds.has(b.tag) ? 1 : 0
      if (aUser !== bUser) return bUser - aUser
      return Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0)
    })
    .map((i) => ({
      name: tagName(tagMap, i.tag),
      score: i.score ?? 0,
      reasoning: i.reasoning!.trim(),
    }))
}

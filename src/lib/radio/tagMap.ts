/**
 * =============================================================================
 * PULSE — Радио: tagMap (ТЗ-43, задача 2)
 * =============================================================================
 *
 * Map<tag_id, tag_name> из GET /api/user/tags. matched_tags новостей и
 * tag_impact[].tag хранят tag_id — для карточек и речи нужны имена.
 * Неизвестный id (tagMap устарел между визитами) → показываем id, не падаем.
 */
import { api } from '@/lib/api'
import type { RadioUserTag } from '@/types/radio'

export type TagMap = Map<string, string>

export async function fetchUserTags(): Promise<RadioUserTag[]> {
  const data = await api.get('/user/tags')
  const tags: RadioUserTag[] = data?.tags ?? []
  return tags
}

export function buildTagMap(tags: RadioUserTag[]): TagMap {
  return new Map(tags.map((t) => [t.tag_id, t.tag_name || t.tag_id]))
}

export function tagName(tagMap: TagMap, tagId: string): string {
  return tagMap.get(tagId) ?? tagId
}

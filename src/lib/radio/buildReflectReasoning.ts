/**
 * =============================================================================
 * PULSE — Радио: источник «мысли» для режима reflect (ТЗ-43, задача 2)
 * =============================================================================
 *
 * Цепочка приоритетов (первый непустой результат wins):
 *   ① tag_impact[].reasoning по тегам юзера (убывание |score|, непустой текст,
 *      префикс «По вашей теме <tag_name>: »)
 *   ② tag_impact остальных тегов (та же сортировка, без префикса)
 *   ③ второй абзац sentiment_reasoning (разбивка по \n\n — «эффект для инвесторов»)
 *   ④ REFLECT_DEFAULT — шаблонные фразы прототипа (scripts.ts:43-46)
 *
 * Пустой результат уровня — молча идём ниже. Пустой tag_impact (LLM-фолбэк
 * пайплайна) → абзац из sentiment_reasoning или шаблон: фактуру не выдумываем.
 */
import type { RadioNewsItem } from '@/types/radio'
import { tagName, type TagMap } from './tagMap'

export const REFLECT_DEFAULT: readonly string[] = [
  'Размышление. Сама по себе эта новость не разворачивает рынок, но она — кирпич в общей картине. Смотрите, подтвердят ли её смежные индикаторы в ближайшие дни: одиночный сигнал шумит, повторяющийся — становится трендом.',
  'Размышление. Здесь важна реакция рынка, а не заголовок. Если цена не отвечает на хорошую новость — покупатели выдохлись; если игнорирует плохую — продавцы иссякли. Запишите реакцию первых часов, она скажет больше, чем сам текст.',
]

/** Детерминированный выбор фразы: по хэшу id карточки (а не Math.random — тестируемо) */
function pickDefault(item: RadioNewsItem): string {
  let hash = 0
  for (let i = 0; i < item.id.length; i++) {
    hash = (hash * 31 + item.id.charCodeAt(i)) >>> 0
  }
  return REFLECT_DEFAULT[hash % REFLECT_DEFAULT.length]
}

export function buildReflectReasoning(
  item: RadioNewsItem,
  userTagIds: ReadonlySet<string>,
  tagMap: TagMap
): string {
  const withReasoning = item.tagImpact.filter((i) => i.reasoning?.trim())

  // ① теги юзера, убывание |score|
  const userImpacts = withReasoning
    .filter((i) => userTagIds.has(i.tag))
    .sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))
  if (userImpacts.length > 0) {
    const top = userImpacts[0]
    return `По вашей теме ${tagName(tagMap, top.tag)}: ${top.reasoning!.trim()}`
  }

  // ② остальные теги
  const otherImpacts = withReasoning.sort(
    (a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0)
  )
  if (otherImpacts.length > 0) {
    return otherImpacts[0].reasoning!.trim()
  }

  // ③ второй абзац sentiment_reasoning (факты / эффект / каскад)
  const paragraphs = item.sentimentReasoning.split(/\n\s*\n/).map((p) => p.trim())
  if (paragraphs[1]) {
    return paragraphs[1]
  }

  // ④ шаблонный фолбэк прототипа
  return pickDefault(item)
}

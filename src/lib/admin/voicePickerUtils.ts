/**
 * PULSE — Админка: чистые helpers для VoicePicker (ТЗ68).
 * Вынесены из компонента для юнит-тестирования без DOM.
 */

export interface VoiceMetaLike {
  id: string
  inAccount?: boolean
}

/** Семейство голоса — префикс из латинских букв до "_" или "-" (English, male, …). */
export function voiceFamily(id: string): string {
  const m = id.match(/^([A-Za-z]+)/)
  return m ? m[1] : 'other'
}

/** Группировка по семейству с сохранением порядка появления. */
export function groupVoicesByFamily<T extends VoiceMetaLike>(
  voices: T[],
): Record<string, T[]> {
  return voices.reduce<Record<string, T[]>>((acc, v) => {
    const family = voiceFamily(v.id)
    if (!acc[family]) acc[family] = []
    acc[family].push(v)
    return acc
  }, {})
}

/**
 * Фильтр «Все / Только доступные»: недоступными считаются только голоса с
 * inAccount === false (probe измерил отсутствие в аккаунте). undefined —
 * неизмерено, показываем.
 */
export function filterVoices<T extends VoiceMetaLike>(
  voices: T[],
  filter: 'all' | 'available',
): T[] {
  return filter === 'all' ? voices : voices.filter((v) => v.inAccount !== false)
}

/** Количество доступных (inAccount !== false). */
export function countAvailable<T extends VoiceMetaLike>(voices: T[]): number {
  return voices.filter((v) => v.inAccount !== false).length
}

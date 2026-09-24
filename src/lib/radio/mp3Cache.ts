/**
 * PULSE — Радио: кеш mp3 для диалога (ТЗ-59, механизмы B+C).
 *
 * Единый кеш Promise<Blob> для префетча на mount (C) и конвейера во время
 * эфира (B) — автодедупликация: два параллельных load() с одним key дают
 * один serverTTS-запрос.
 *
 * Ключ = text + voice_id + speed + pitch. pitch входит в ключ, т.к. при
 * одинаковых голосах на обе роли гость звучит выше тембром (ТЗ-44).
 *
 * AbortSignal намеренно НЕ поддерживается: кешированный промис общий между
 * префетчем и плеером, оборвать его одним потребителем нельзя. Остановка
 * эфира отбрасывает результат через gen-check в useSpeech (stale blob).
 * LRU eviction при MAX_ENTRIES; blob-ы собирает GC.
 */
const cache = new Map<string, Promise<Blob>>()
const MAX_ENTRIES = 32 // ~10 МБ (32 × ~300 КБ)

function makeKey(text: string, voiceId: string, speed: number, pitch: number): string {
  return `${text}\x00${voiceId}\x00${speed}\x00${pitch}`
}

async function ttsFetch(
  text: string,
  voiceId: string,
  speed: number,
  pitch: number,
): Promise<Blob> {
  const { serverTTS } = await import('@/lib/radio/ttsApi')
  return serverTTS(text, { voiceId, speed, pitch })
}

export function loadMp3(
  text: string,
  voiceId: string,
  speed = 1.05,
  pitch = 0,
): Promise<Blob> {
  const key = makeKey(text, voiceId, speed, pitch)
  const hit = cache.get(key)
  if (hit) return hit

  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }

  const promise = ttsFetch(text, voiceId, speed, pitch).catch((err) => {
    cache.delete(key) // failed — не держать в кеше, повторный load попробует заново
    throw err
  })
  cache.set(key, promise)
  return promise
}

export function clearMp3Cache(): void {
  cache.clear()
}

export function getMp3CacheSize(): number {
  return cache.size
}

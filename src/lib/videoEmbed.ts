/**
 * =============================================================================
 * PULSE — Конвертация ссылок видео в embed-форму
 * =============================================================================
 *
 * Общий модуль ТЗ-188: один источник правды для плеера ученика
 * (LessonPage) и живого превью в форме урока (LessonForm) — расхождение
 * «у админа показало, у ученика нет» невозможно.
 */

/** YouTube watch/shorts/share → embed (остальное — как есть, бэк уже проверил домен). */
export function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') {
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    }
  } catch {
    /* не URL — отдадим как есть */
  }
  return url
}

// ТЗ-129: красивое имя хоста видео из video_embed_url (для карточки ошибки).
// Функция не падает — try/catch, fallback 'Видео'.
// Перенесена из LessonPage (ТЗ-188); экспорт для юнит-теста без монтирования
// страницы (прецедент ТЗ-164).
export function videoHostName(url: string | null): string {
  if (!url) return 'Видео'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (/^(youtube\.com|youtu\.be|youtube-nocookie\.com|m\.youtube\.com)$/.test(host)) return 'YouTube'
    if (/^(vkvideo\.ru|vk\.com)$/.test(host)) return 'VK Видео'
    if (host === 'vimeo.com') return 'Vimeo'
    if (host === 'rutube.ru') return 'Rutube' // ТЗ-164
    return host
  } catch {
    return 'Видео'
  }
}

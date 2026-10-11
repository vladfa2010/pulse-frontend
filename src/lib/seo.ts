// Общие формулы SEO-меты (ТЗ-140): единый источник для build-time пререндера
// (scripts/seo-prerender.mts, запускается через tsx) и клиентских Helmet-страниц
// (Education/CoursePage/LessonPage/Home). Файл без React- и Node-импортов —
// импортируется обеими сторонами.

export const BASE = 'https://pulse.inside-trade.ru'

export const VITRINE_TITLE = 'Образование — бесплатные и платные курсы | PULSE'

// ТЗ-163: мета главной. Статичный дубль лежит в index.html (шелл главной) —
// при правке формулировок менять в обоих местах.
export const HOME_TITLE = 'PULSE — инвестиционные новости и аналитика'
export const HOME_DESCRIPTION =
  'Актуальные инвестиционные новости с графиками реакции цен, индекс настроения рынка, инвесткалендарь и обучающие курсы. Всё для инвестора в одном приложении.'

/** Общий meta description витрины (150–160 символов) — пререндер и Education.tsx. */
export const VITRINE_DESCRIPTION =
  'Бесплатные и платные курсы по инвестициям и финансовым рынкам: мини-курсы по актуальным новостям, полные программы с уроками и материалами от редакции PULSE.'

export const OG_DEFAULT_IMAGE = '/og-default.png'

/** Title курса с правилом длины 50–60: суффикс «— курс на PULSE», затем «| PULSE», затем только название. */
export function courseTitle(name: string): string {
  const full = `${name} — курс на PULSE`
  if (full.length <= 60) return full
  const short = `${name} | PULSE`
  if (short.length <= 60) return short
  return name
}

/** Meta description: целимся в ~155 символов — окно 0..155, обрезка по последнему
 *  пробелу (но не короче 140, иначе жёсткие 155). Пустое описание → null (тег не выводить). */
export function metaDescription(htmlOrText: string | null | undefined): string | null {
  const text = htmlToPlainText(htmlOrText ?? '').replace(/\n+/g, ' ').trim()
  if (!text) return null
  if (text.length <= 160) return text
  const window = text.slice(0, 156)
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace >= 140) return window.slice(0, lastSpace)
  return window.slice(0, 155)
}

/** Canonical URL карточки курса. */
export function canonicalCourse(slug: string, base: string = BASE): string {
  return `${base}/education/${slug}`
}

/** Относительный путь или уже абсолютный URL → абсолютный URL. */
export function absoluteUrl(pathOrUrl: string | null | undefined, base: string = BASE): string {
  if (!pathOrUrl) return base
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  if (pathOrUrl.startsWith('/')) return `${base}${pathOrUrl}`
  return `${base}/${pathOrUrl}`
}

/** HTML → plain text: script/style вырезаем, границы блоков → переносы строк, теги удаляем,
 *  entities (&amp; &lt; &gt; &quot; &#39; &nbsp;) декодируем, пробелы схлопываем. */
export function htmlToPlainText(html: string): string {
  const noScripts = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const decoded = decodeEntities(noScripts)
  return decoded
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** Декодирование HTML-entities, которые реально встречаются в текстах курсов. */
export function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  }
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => named[name] ?? m)
}

/** HTML-escape для вставки произвольных строк в title/meta/тело статики (& < > " '). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

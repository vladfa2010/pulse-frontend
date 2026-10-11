// Build-time SEO-пререндер курсов (ТЗ-140). После `vite build` читает шелл
// dist/index.html и генерирует:
//   - dist/education/index.html — витрина с метой, OG, JSON-LD ItemList и
//     статическим списком ссылок на курсы (краул-граф без JS);
//   - dist/education/<slug>/index.html — карточка каждого публичного курса
//     (мета, OG/Twitter, JSON-LD Course + BreadcrumbList, plain-text контент
//     внутри #root — React очистит блок при старте SPA);
//   - dist/robots.txt и dist/sitemap.xml — в любом случае, даже при недоступном API.
// Формулы меты — из src/lib/seo.ts (единый источник с клиентским helmet).
//
// Env: SEO_BASE_URL (дефолт https://pulse.inside-trade.ru), SEO_API_URL — база API
// (дефолт тот же домен; эндпоинты /api/education/courses[...]). Флаг --strict:
// недоступность API = exit 1 (без флага — warning и сборка остаётся зелёной).

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASE,
  VITRINE_TITLE,
  VITRINE_DESCRIPTION,
  OG_DEFAULT_IMAGE,
  absoluteUrl,
  canonicalCourse,
  courseTitle,
  escapeHtml,
  htmlToPlainText,
  metaDescription,
} from '../src/lib/seo'

const base = (process.env.SEO_BASE_URL ?? BASE).replace(/\/$/, '')
const apiBase = (process.env.SEO_API_URL ?? BASE).replace(/\/$/, '')
const strict = process.argv.includes('--strict')

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

interface VitrineCourseLite {
  slug: string
  title: string
  price: number
  visibility?: string
  created_at?: string | null
}

interface CourseLesson {
  position: number
  title: string
  duration_min: number | null
}

interface CourseCard {
  slug: string
  title: string
  description: string | null
  cover_url: string | null
  price: number | null
  author: string | null
  created_at: string | null
  visibility?: string
  program?: CourseLesson[]
}

async function fetchJson(url: string, attempts = 2): Promise<unknown> {
  let lastErr: unknown = new Error('no attempts')
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

// ─── Манипуляции со шеллом ────────────────────────────────────────────────

function setTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
}

/** Существующий в шелле canonical (если остался) — заменяем, не дублируем. */
function stripCanonical(html: string): string {
  return html.replace(/\s*<link[^>]*rel="canonical"[^>]*\/?>/g, '')
}

/** OG/Twitter/description/canonical — сразу после <meta charset>: Meta-краулер
 *  парсит только первые ~60 КБ head. */
function injectMeta(html: string, snippet: string): string {
  return html.replace(/<meta charset[^>]*>/, (m) => `${m}\n    ${snippet}`)
}

function injectJsonLd(html: string, objects: object[]): string {
  const scripts = objects
    .map(
      (o) =>
        `    <script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n')
  return html.replace('</head>', `${scripts}\n  </head>`)
}

/** Статический plain-text блок внутрь #root, ПЕРЕД содержимым шелла
 *  (SPA очистит контейнер при старте). Все строки — через escapeHtml. */
function injectRoot(html: string, block: string): string {
  if (html.includes('<div id="root"></div>')) {
    return html.replace('<div id="root"></div>', `<div id="root">${block}</div>`)
  }
  return html.replace(/<div id="root">/, `<div id="root">${block}`)
}

// ─── Генераторы контента ──────────────────────────────────────────────────

function ogSnippet(opts: {
  title: string
  description: string | null
  canonical: string
  image: string
  imageAlt: string
}): string {
  const desc = escapeHtml(opts.description ?? '')
  const tags: string[] = [
    // Пустое описание → meta description не выводим вовсе (ТЗ-140).
    ...(opts.description
      ? [`<meta name="description" content="${desc}">`]
      : []),
    `<link rel="canonical" href="${escapeHtml(opts.canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(opts.title)}">`,
    ...(opts.description ? [`<meta property="og:description" content="${desc}">`] : []),
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(opts.canonical)}">`,
    `<meta property="og:site_name" content="PULSE">`,
    `<meta property="og:image" content="${escapeHtml(opts.image)}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:image:alt" content="${escapeHtml(opts.imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(opts.title)}">`,
    ...(opts.description ? [`<meta name="twitter:description" content="${desc}">`] : []),
    `<meta name="twitter:image" content="${escapeHtml(opts.image)}">`,
  ]
  return tags.join('\n    ')
}

function courseJsonLd(card: CourseCard, image: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: card.title,
    description: htmlToPlainText(card.description ?? ''),
    provider: { '@type': 'Organization', name: 'PULSE', sameAs: base },
    ...(card.price != null
      ? { offers: { '@type': 'Offer', price: card.price, priceCurrency: 'RUB' } }
      : {}),
    image,
    ...(card.program && card.program.length > 0
      ? {
          syllabusSections: [
            {
              '@type': 'Syllabus',
              name: 'Программа курса',
              children: card.program.map((l) => ({ '@type': 'Course', name: l.title })),
            },
          ],
        }
      : {}),
  }
}

function breadcrumbJsonLd(title: string, canonical: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Образование', item: `${base}/education` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ],
  }
}

function itemListJsonLd(courses: { slug: string; title: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: courses.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/education/${c.slug}`,
      item: {
        '@type': 'Course',
        name: c.title,
        provider: { '@type': 'Organization', name: 'PULSE' },
      },
    })),
  }
}

function courseBodyBlock(card: CourseCard): string {
  const paragraphs = htmlToPlainText(card.description ?? '')
    .split('\n')
    .filter(Boolean)
    .slice(0, 3)
  const priceText = card.price != null && card.price > 0 ? `${card.price.toLocaleString('ru-RU')} ₽` : 'Бесплатно'
  const authorText = card.author ? ` · Автор: ${escapeHtml(card.author)}` : ''
  const lessons = (card.program ?? [])
    .map(
      (l) =>
        `<li>${escapeHtml(`${l.position}. ${l.title}`)}${l.duration_min != null ? ` (${escapeHtml(String(l.duration_min))} мин)` : ''}</li>`,
    )
    .join('')
  return [
    '<div class="seo-prerender">',
    `<h1>${escapeHtml(card.title)}</h1>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    lessons ? '<h2>Программа курса</h2>' : '',
    lessons ? `<ol>${lessons}</ol>` : '',
    `<p><small>${escapeHtml(`Цена: ${priceText}`)}${authorText}</small></p>`,
    '<p><a href="/education">← Все курсы (Образование)</a></p>',
    '</div>',
  ]
    .filter(Boolean)
    .join('')
}

function vitrineBodyBlock(courses: VitrineCourseLite[]): string {
  const items = courses
    .map(
      (c) =>
        `<li><a href="/education/${escapeHtml(c.slug)}">${escapeHtml(c.title)}</a> — ${c.price > 0 ? 'платный' : 'бесплатный'}</li>`,
    )
    .join('')
  return [
    '<div class="seo-prerender">',
    '<h1>Образование</h1>',
    `<ul>${items}</ul>`,
    '</div>',
  ].join('')
}

// ─── robots.txt / sitemap.xml ─────────────────────────────────────────────

function robotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /profile',
    'Disallow: /api/',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}

function sitemapXml(courses: { slug: string; created_at: string | null }[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const staticUrls = ['/', '/education', '/pricing', '/instructions', '/sentiment', '/download']
  const rows: string[] = []
  for (const p of staticUrls) {
    rows.push(`  <url><loc>${esc(base + p)}</loc></url>`)
  }
  for (const c of courses) {
    const lastmod = c.created_at ? new Date(c.created_at) : null
    const lastmodTag =
      lastmod && !Number.isNaN(lastmod.getTime())
        ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`
        : ''
    rows.push(`  <url><loc>${esc(`${base}/education/${c.slug}`)}</loc>${lastmodTag}</url>`)
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    '</urlset>',
    '',
  ].join('\n')
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const shellPath = path.join(distDir, 'index.html')
  let shell: string
  try {
    shell = await readFile(shellPath, 'utf8')
  } catch {
    console.error(`[seo-prerender] ${shellPath} не найден — сначала выполните vite build`)
    return 1
  }

  const robotsAndSitemap = async (courses: { slug: string; created_at: string | null }[]) => {
    await writeFile(path.join(distDir, 'robots.txt'), robotsTxt())
    await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml(courses))
  }

  let vitrine: {
    shelves?: { hot?: VitrineCourseLite[]; recommended?: VitrineCourseLite[]; fresh?: VitrineCourseLite[] }
    catalog?: VitrineCourseLite[]
  }
  try {
    vitrine = (await fetchJson(`${apiBase}/api/education/courses`)) as typeof vitrine
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(
      `[seo-prerender] API недоступен (${apiBase}: ${msg}) — пропускаем пререндер курсов, генерируем только robots.txt и sitemap.xml со статическими URL`,
    )
    await robotsAndSitemap([])
    return strict ? 1 : 0
  }

  // Дедуп по slug: полки + каталог; только visibility === 'public'.
  const bySlug = new Map<string, VitrineCourseLite>()
  const shelves = vitrine.shelves ?? {}
  for (const list of [shelves.hot ?? [], shelves.recommended ?? [], shelves.fresh ?? [], vitrine.catalog ?? []]) {
    for (const c of list) {
      if (c && typeof c.slug === 'string' && !bySlug.has(c.slug)) bySlug.set(c.slug, c)
    }
  }
  const vitrineCourses = [...bySlug.values()].filter((c) => c.visibility === 'public')

  // Полные карточки: ошибка по отдельному курсу — warning и пропуск курса.
  // created_at есть в выдаче витрины, но не в карточке — мерджим для lastmod.
  const cards: CourseCard[] = []
  for (const c of vitrineCourses) {
    try {
      const full = (await fetchJson(`${apiBase}/api/education/courses/${encodeURIComponent(c.slug)}`)) as CourseCard
      cards.push({ ...full, created_at: full.created_at ?? c.created_at ?? null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[seo-prerender] не удалось загрузить курс ${c.slug} (${msg}) — пропускаем`)
    }
  }
  const publicCards = cards.filter((c) => c.visibility !== 'hidden' && c.slug && !c.slug.includes('/') && !c.slug.includes('..'))

  // Витрина.
  const vitrineMeta = ogSnippet({
    title: VITRINE_TITLE,
    description: VITRINE_DESCRIPTION,
    canonical: `${base}/education`,
    image: absoluteUrl(OG_DEFAULT_IMAGE, base),
    imageAlt: VITRINE_TITLE,
  })
  let vitrineHtml = stripCanonical(shell)
  vitrineHtml = setTitle(vitrineHtml, VITRINE_TITLE)
  vitrineHtml = injectMeta(vitrineHtml, vitrineMeta)
  vitrineHtml = injectJsonLd(vitrineHtml, [itemListJsonLd(publicCards.map((c) => ({ slug: c.slug, title: c.title })))])
  vitrineHtml = injectRoot(vitrineHtml, vitrineBodyBlock(publicCards))
  await mkdir(path.join(distDir, 'education'), { recursive: true })
  await writeFile(path.join(distDir, 'education', 'index.html'), vitrineHtml)

  // Карточки курсов.
  for (const card of publicCards) {
    const title = courseTitle(card.title)
    const description = metaDescription(card.description)
    const canonical = canonicalCourse(card.slug, base)
    const image = card.cover_url ? absoluteUrl(card.cover_url, base) : absoluteUrl(OG_DEFAULT_IMAGE, base)
    let html = stripCanonical(shell)
    html = setTitle(html, title)
    html = injectMeta(html, ogSnippet({ title, description, canonical, image, imageAlt: card.title }))
    html = injectJsonLd(html, [courseJsonLd(card, image), breadcrumbJsonLd(card.title, canonical)])
    html = injectRoot(html, courseBodyBlock(card))
    const dir = path.join(distDir, 'education', card.slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html)
  }

  await robotsAndSitemap(
    publicCards.map((c) => ({ slug: c.slug, created_at: c.created_at ?? null })),
  )
  console.log(
    `[seo-prerender] готово: витрина + ${publicCards.length} курсов, robots.txt, sitemap.xml`,
  )
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    console.error('[seo-prerender] неожиданная ошибка:', err)
    process.exitCode = strict ? 1 : 0
  })

// Публичный API LMS «Образование» (ТЗ-100/ТЗ-102) — публичный контур /api/education.
// Все запросы идут через api (Bearer pulse_token, единая обработка ошибок);
// multipart-загрузка файла — отдельным fetch (как adminApi.postForm: браузер
// сам ставит boundary, таймаут увеличен до 120 с — файл до 10 МБ).

import { api, API_BASE } from './api'
import { safeStorage } from './safeStorage'

// ─── Карточка курса (GET /api/education/courses/:slug) ─────────────────────

export type PublicMaterialKind = 'file' | 'link' | 'news'

export interface PublicCourseMaterial {
  id: string
  kind: PublicMaterialKind
  title: string
  url: string | null
  news_id: string | null
  is_free: boolean
  /** (ТЗ-102) происхождение: 'editorial' | 'user'. Разделение editorial/community. */
  origin?: 'editorial' | 'user'
  /** (ТЗ-102) автор user-материала для плашки «предложил @username»
   *  (контракт бэка: объект { id, username } | null). */
  submitted_by?: { id: string; username: string | null } | null
}

export interface PublicCourseLesson {
  id: string
  position: number
  title: string
  kind: 'text' | 'video' | 'video_text'
  duration_min: number | null
  is_free_preview: boolean
  unlock_after_days: number
  locked_by_drip: boolean
  unlock_in_days: number | null
}

export interface PublicCourseCard {
  id: string
  slug: string
  title: string
  description: string | null
  cover_url: string | null
  type: 'course' | 'situational'
  size: 'micro' | 'standard' | 'full'
  price: number
  badges: string[]
  author: string | null
  category: { id: string; name: string } | null
  tags: { id: string; label: string }[]
  is_expired: boolean
  relevant_until: string | null
  /** Только записанным: { source, created_at } — флаг для кнопки «Предложить материал». */
  my_enrollment: { source: string; created_at: string } | null
  /** Курс входит в активную подписку юзера (по тарифу). */
  access_via_subscription: boolean
  progress: { completed_lessons: number; total_lessons: number; percent: number } | null
  program: PublicCourseLesson[]
  /** Редакционные материалы (status='approved'; user-материалы — если бэк не отделил,
   *  выкидываем по origin === 'user'). */
  materials: (PublicCourseMaterial & { origin?: string })[]
  /** (ТЗ-102) Одобренные материалы сообщества — отдельным полем; фолбэк — фильтр по origin. */
  community_materials?: PublicCourseMaterial[]
  locked_materials_count: number
}

export function fetchPublicCourse(slug: string): Promise<PublicCourseCard> {
  return api.get(`/education/courses/${encodeURIComponent(slug)}`)
}

/** Самозапись на бесплатный курс (POST /courses/:slug/enroll).
 *  409 — платный курс (покупка появится с контуром оплаты); идемпотентно. */
export function enrollCourse(slug: string): Promise<{ enrolled: boolean; course_id: string }> {
  return api.post(`/education/courses/${encodeURIComponent(slug)}/enroll`, {})
}

// ─── Урок (GET /api/education/lessons/:id; ТЗ-100 критерии 4, 10, 13, 20) ──

export interface LessonTestQuestion {
  q: string
  options: string[]
}

export interface LessonContent {
  id: string
  course_id: string
  course_slug: string
  course_title: string
  position: number
  title: string
  kind: 'text' | 'video' | 'video_text'
  /** Санитизированный HTML (допустимые теги/атрибуты — на бэке) — рендерим как HTML. */
  text_content: string | null
  video_source: string | null
  video_embed_url: string | null
  duration_min: number | null
  unlock_after_days: number
  /** Тест без индексов правильных ответов (вырезаны на бэке, критерий 4). */
  test: {
    pass_score: number
    is_blocking: boolean
    questions: LessonTestQuestion[]
  } | null
  progress: { completed: boolean; test_score: number | null } | null
  prev_lesson_id: string | null
  next_lesson_id: string | null
}

export function fetchLesson(lessonId: string): Promise<LessonContent> {
  return api.get(`/education/lessons/${encodeURIComponent(lessonId)}`)
}

/** Грейдинг ответов (POST /lessons/:id/test): индексы → балл (считает бэк). */
export function submitLessonTest(
  lessonId: string,
  answers: number[],
): Promise<{ test_score: number; pass_score: number; passed: boolean }> {
  return api.post(`/education/lessons/${encodeURIComponent(lessonId)}/test`, { answers })
}

/** Отметить урок пройденным. Для урока с тестом — только с набранным test_score
 *  (бэк вернёт 422, если балл ниже pass_score). */
export function completeLesson(
  lessonId: string,
  testScore?: number,
): Promise<{ ok: boolean; passed: boolean }> {
  return api.post(`/education/lessons/${encodeURIComponent(lessonId)}/complete`,
    testScore !== undefined ? { test_score: testScore } : {})
}

// ─── Предложение материала (POST /api/education/courses/:slug/materials) ───

export interface SubmitLinkBody {
  kind: 'link'
  title: string
  url: string
}

export interface SubmitNewsBody {
  kind: 'news'
  news_id: string
  title?: string
}

export function submitCourseMaterial(
  slug: string,
  body: SubmitLinkBody | SubmitNewsBody,
): Promise<{ status: 'pending' }> {
  return api.post(`/education/courses/${encodeURIComponent(slug)}/materials`, body)
}

/** Файл — multipart: kind='file', title + file. 201 { status: 'pending' }.
 *  403 незаписанным, 429 rate limit, 400 расширение/размер, 415 magic bytes. */
export async function submitCourseFile(
  slug: string,
  title: string,
  file: File,
): Promise<{ status: 'pending' }> {
  const fd = new FormData()
  fd.append('kind', 'file')
  fd.append('title', title)
  fd.append('file', file)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(
      `${API_BASE}/education/courses/${encodeURIComponent(slug)}/materials`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${safeStorage.get('pulse_token') || ''}` },
        body: fd,
        signal: controller.signal,
      },
    )
    clearTimeout(timeoutId)
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      const err: any = new Error(data.error || data.message || 'Слишком много предложений за сегодня. Попробуйте завтра.')
      err.status = 429
      throw err
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err: any = new Error(data.error || data.message || `Ошибка ${res.status}`)
      err.status = res.status
      throw err
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      const e: any = new Error('Сервер не отвечает. Попробуйте снова.')
      e.isTransportError = true
      throw e
    }
    throw err
  }
}

// ─── Мои предложения (GET /api/education/my/submissions) ───────────────────

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface MySubmission {
  id: string
  /** 'material' | 'news-suggestion' — тип сущности; type — link/file/news. */
  kind: string
  type?: PublicMaterialKind
  title?: string | null
  /** Для предложений-новостей — заголовок новости. */
  news_title?: string | null
  course: { slug: string; title: string }
  status: SubmissionStatus
  reject_reason?: string | null
  created_at: string
}

export function fetchMySubmissions(): Promise<MySubmission[]> {
  return api.get('/education/my/submissions')
}

// ─── Поиск новостей (публичный, НЕ admin) ──────────────────────────────────

export interface PublicNewsItem {
  id: string
  slug: string | null
  title_ru: string
  published_at: string | null
}

/** Публичный поиск новостей ленты: GET /api/news/search?q=… (НЕ /news-search админки). */
export async function searchNewsPublic(q: string): Promise<PublicNewsItem[]> {
  const data = await api.get(`/news/search?q=${encodeURIComponent(q)}&limit=10`)
  return data?.articles || []
}

// ─── Скачивание материала (редирект 302 на signed URL) ─────────────────────

/** Ссылка на download-эндпоинт материала; открытие — скачивание (Content-Disposition: attachment). */
export function materialDownloadPath(id: string): string {
  return `${API_BASE}/education/materials/${id}/download`
}

// ─── Календарный мэтчинг «курс ↔ событие» (ТЗ-103 v2) ──────────────────────
// Все три эндпоинта под фичефлагом EDUCATION_MATCH_ENABLED: выключен → 404 —
// фронт молча не рендерит блоки (пустой { events: [] } тоже = блока нет).

/** Курс, сматчившийся с событием календаря по общим тегам. */
export interface MatchedCourse {
  slug: string
  title: string
  type: 'course' | 'situational'
  size: 'micro' | 'standard' | 'full'
  price: number
  cover_url: string | null
  badges: string[]
  /** Названия общих тегов — «причина» мэтча для UI. */
  matched_tags: string[]
}

/** Событие календаря в ответах мэтчинга (натуральный ключ: date+title+kind+ticker). */
export interface CalendarMatchEvent {
  date: string // YYYY-MM-DD (бизнес-дата, МСК)
  title: string
  kind: string
  status: 'confirmed' | 'expected'
  company: string | null
  ticker: string | null
}

/** Событие сегодня/завтра с ≥1 подходящим курсом (блок «Сегодня в календаре»). */
export interface CalendarTodayEvent extends CalendarMatchEvent {
  matched_courses: MatchedCourse[]
}

/** GET /api/education/calendar-today → { events: [...] }. 404 — флаг выключен. */
export function fetchCalendarToday(): Promise<{ events: CalendarTodayEvent[] }> {
  return api.get('/education/calendar-today')
}

/** GET /api/education/for-event?date=&title=&kind=&ticker= → { courses: [...] }.
 *  Событие адресуется натуральным ключом (id нестабилен — конвейер пересобирает
 *  таблицу); событие не найдено → 404. */
export function fetchCoursesForEvent(key: {
  date: string
  title: string
  kind: string
  ticker?: string | null
}): Promise<{ courses: MatchedCourse[] }> {
  const qs = new URLSearchParams({ date: key.date, title: key.title, kind: key.kind })
  if (key.ticker) qs.set('ticker', key.ticker)
  return api.get(`/education/for-event?${qs.toString()}`)
}

/** GET /api/education/courses/:slug/events?days=14 → блок «Связанные события». */
export function fetchCourseEvents(
  slug: string,
  days = 14,
): Promise<{ events: CalendarMatchEvent[] }> {
  return api.get(`/education/courses/${encodeURIComponent(slug)}/events?days=${days}`)
}

// ─── Витрина (GET /api/education/courses) ──────────────────────────────────

/** Публичная карточка курса из каталога/полок витрины. */
export interface VitrineCourse {
  id: string
  slug: string
  title: string
  type: 'course' | 'situational'
  size: 'micro' | 'standard' | 'full'
  price: number
  badges: string[]
  cover_url: string | null
  category: { id: string; name: string } | null
  tags: { id: string; label: string }[]
  lessons_count: number
  author: string | null
  is_expired: boolean
  created_at: string
}

export interface VitrineResponse {
  shelves: { hot: VitrineCourse[]; recommended: VitrineCourse[]; fresh: VitrineCourse[] }
  catalog: VitrineCourse[]
}

export function fetchVitrine(): Promise<VitrineResponse> {
  return api.get('/education/courses')
}

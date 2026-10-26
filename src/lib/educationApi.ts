// Публичный API LMS «Образование» (ТЗ-100/ТЗ-102) — публичный контур /api/education.
// Все запросы идут через api (Bearer pulse_token, единая обработка ошибок);
// multipart-загрузка файла — отдельным fetch (как adminApi.postForm: браузер
// сам ставит boundary, таймаут увеличен до 120 с — файл до 10 МБ).

import { api, API_BASE } from './api'
import { safeStorage } from './safeStorage'
import { serverTTS } from './radio/ttsApi'

// ─── ТЗ-132: озвучка конспекта («Слушать») ─────────────────────────────────
// Переиспользует серверный прокси TTS радио (POST /api/radio/tts): голос
// фиксирован (audiobook_male_1), ключ серверного кэша — текст+голос+speed,
// поэтому конспекты попадают в общий кэш радио бесплатно. Ошибки —
// RadioTtsError со status/message (503 tts_not_configured, 503
// radio_service_disabled, 502 tts_upstream) — обрабатывает useLessonAudio.
export function fetchTtsSegment(text: string, speed: number): Promise<Blob> {
  return serverTTS(text, { voiceId: 'audiobook_male_1', speed })
}

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
  /** ТЗ-171: админ без enrollment смотрит превью — витрина показывает все материалы. */
  admin_preview?: boolean
  /** Курс входит в активную подписку юзера (по тарифу). */
  access_via_subscription: boolean
  /** ТЗ-121: активные тарифы, включающие курс (анонимам тоже). price/billing_frequency —
   *  сырые данные плана; цену «₽/мес» показываем только для monthly-тарифов. */
  included_tariffs?: { id: string; name: string; price?: number; billing_frequency?: string }[]
  progress: { completed_lessons: number; total_lessons: number; percent: number } | null
  program: PublicCourseLesson[]
  /** Редакционные материалы (status='approved'; user-материалы — если бэк не отделил,
   *  выкидываем по origin === 'user'). */
  materials: (PublicCourseMaterial & { origin?: string })[]
  /** (ТЗ-102) Одобренные материалы сообщества — отдельным полем; фолбэк — фильтр по origin. */
  community_materials?: PublicCourseMaterial[]
  locked_materials_count: number
  /** ТЗ-140: видимость карточки (бэк отдаёт; 'hidden' → клиентский noindex). */
  visibility?: 'public' | 'hidden'
  /** ТЗ-131: режим открытия уроков для записи по подписке ('drip' — по мере подписки). */
  subscription_unlock_mode?: 'drip' | 'all_at_once' | null
  /** ТЗ-131: ближайшая дата открытия заблокированного урока (ISO) или null. */
  next_unlock_date?: string | null
  /** ТЗ-105 v2: «Входит в программы» — published-программы с этим курсом. */
  paths?: { slug: string; title: string }[]
}

export function fetchPublicCourse(slug: string, previewToken?: string | null): Promise<PublicCourseCard> {
  // ТЗ-189: preview_token (admin JWT) — единственный ключ к draft/archived-курсу
  // на бэке; без проброса гейт отдаёт 404 (ТЗ-101 Задача 2).
  const q = previewToken ? `?preview_token=${encodeURIComponent(previewToken)}` : ''
  return api.get(`/education/courses/${encodeURIComponent(slug)}${q}`)
}

/** Самозапись на бесплатный курс (POST /courses/:slug/enroll).
 *  409 — платный курс (покупка появится с контуром оплаты); идемпотентно. */
export function enrollCourse(slug: string): Promise<{ enrolled: boolean; course_id: string }> {
  return api.post(`/education/courses/${encodeURIComponent(slug)}/enroll`, {})
}

/** ТЗ-185: самоотписка студента (DELETE /courses/:slug/enroll).
 *  204 — отписан (или записи не было); 409 — курс куплен (purchase). Прогресс
 *  на бэке не трогается — при повторной записи вернётся. */
export function unenrollCourse(slug: string): Promise<void> {
  return api.delete(`/education/courses/${encodeURIComponent(slug)}/enroll`)
}

// ─── Урок (GET /api/education/lessons/:id; ТЗ-100 критерии 4, 10, 13, 20) ──
/** ТЗ-124: CTA-кнопка урока (контракт совпадает с админским LessonButton). */
export interface LessonButton {
  label: string
  url: string
  color: 'accent' | 'violet' | 'green' | 'ghost'
  target: 'self' | 'new_tab'
}

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
  /** ТЗ-124: CTA-кнопки урока (после конспекта, перед материалами). */
  buttons: LessonButton[]
  /** ТЗ-123: материалы урока (approved; url только для link/is_free — файл через download-эндпоинт). */
  materials: { id: string; kind: 'file' | 'link' | 'news'; title: string; is_free: boolean; url: string | null; news_id: string | null }[]
  /** ТЗ-123: enrolled/admin — видит и качает не-is_free материалы; иначе locked-строки. */
  has_full_access: boolean
  /** Тест без индексов правильных ответов (вырезаны на бэке, критерий 4). */
  test: {
    pass_score: number
    is_blocking: boolean
    questions: LessonTestQuestion[]
  } | null
  progress: { completed: boolean; test_score: number | null } | null
  /** ТЗ-127 Задача 0: программа курса целиком (completed — только для залогиненного). */
  total_lessons: number
  program: {
    id: string
    position: number
    title: string
    kind: 'text' | 'video' | 'video_text'
    duration_min: number | null
    completed: boolean
  }[]
  /** Прогресс по курсу (completed/total/percent) — одинаков для всех уроков курса. */
  course_progress: { completed_lessons: number; total_lessons: number; percent: number }
  prev_lesson: { id: string; position: number; title: string } | null
  /** ТЗ-147: kind + доступность (для CTA «Следующий урок» без 403-сюрпризов). */
  next_lesson: {
    id: string
    position: number
    title: string
    kind?: 'text' | 'video' | 'video_text'
    access?: 'ok' | 'drip' | 'no_access' // undefined = старый бэк, считаем 'ok'
    unlock_in_days?: number | null
  } | null
  prev_lesson_id: string | null
  next_lesson_id: string | null
}

export function fetchLesson(lessonId: string): Promise<LessonContent> {
  return api.get(`/education/lessons/${encodeURIComponent(lessonId)}`)
}

/** Грейдинг ответов (POST /lessons/:id/test): индексы → балл (считает бэк).
 *  auto_enrolled — ТЗ-184: бэк автоматически записал пользователя на курс. */
export function submitLessonTest(
  lessonId: string,
  answers: number[],
): Promise<{ test_score: number; pass_score: number; passed: boolean; auto_enrolled?: boolean }> {
  return api.post(`/education/lessons/${encodeURIComponent(lessonId)}/test`, { answers })
}

/** Отметить урок пройденным. Для урока с тестом — только с набранным test_score
 *  (бэк вернёт 422, если балл ниже pass_score). auto_enrolled — ТЗ-184. */
export function completeLesson(
  lessonId: string,
  testScore?: number,
): Promise<{ ok: boolean; passed: boolean; auto_enrolled?: boolean }> {
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
  // Бэкенд отдаёт ОБЪЁКТ { submissions: [...] }, а не голый массив — разворачиваем.
  // (Регрессия ТЗ-102: tab получал объект, Array.isArray() отбрасывал его в
  // пустое состояние «Пока нет предложений» даже при живых подачах.)
  return api.get('/education/my/submissions').then((d) => d?.submissions ?? [])
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
  /** ТЗ-131: мета карточки по мокапу (бэк отдаёт с витрины). */
  total_minutes: number
  students_count: number
  visibility: 'public' | 'hidden'
  /** Самый дешёвый активный тариф, включающий курс («или от тарифа PRO»); null — не входит ни в один. */
  tariff_name: string | null
  /** Situational: источник-новость («по новости: «…»»). */
  source?: { type: 'news'; id: string; title: string | null } | null
  /** Залогиненному бэкенд дочисляет факт записи (ТЗ-126). */
  my_enrollment?: boolean
  enrollment_source?: string | null
}

export interface VitrineResponse {
  shelves: { hot: VitrineCourse[]; recommended: VitrineCourse[]; fresh: VitrineCourse[] }
  catalog: VitrineCourse[]
}

export type VitrineFilter = 'all' | 'free' | 'paid' | 'hot' | 'mine'

export function fetchVitrine(filter: VitrineFilter = 'all'): Promise<VitrineResponse> {
  return api.get(`/education/courses?filter=${filter}`)
}

// ─── Мои курсы (GET /api/education/my) ─────────────────────────────────────

export interface MyCourse {
  id: string
  slug: string
  title: string
  cover_url: string | null
  price: number
  enrollment_source: string
  enrolled_at: string
  progress: { completed_lessons: number; total_lessons: number; percent: number }
  /** Первый непройденный урок (ТЗ-126 Задача 3); null — всё пройдено или уроков нет. */
  next_lesson_id: string | null
  /** ТЗ-154: метка последней активности (MAX lesson_progress.completed_at);
   *  null — ни один урок ещё не пройден. */
  last_activity: string | null
  /** ТЗ-105 v2: курс записан только через программу — фронт прячет из общего
   *  списка «Моих курсов» (он живёт в блоке «Мои программы»). */
  via_path?: boolean
}

// ТЗ-105 v2: «Мои программы» — записи на программы с прогрессом.
export interface MyPath {
  slug: string
  title: string
  cover_url: string | null
  percent: number
  done_courses: number
  total_courses: number
}

// ТЗ-105 v2: бэкенд отдаёт {courses, paths}; старый формат — голый массив
// курсов (совместимость на период деплоя — см. бэкенд-фикс ТЗ-105).
export interface MyCoursesResponse {
  courses: MyCourse[]
  paths: MyPath[]
}

export function fetchMyCourses(): Promise<MyCoursesResponse> {
  return api.get('/education/my').then((d: any) =>
    Array.isArray(d)
      ? { courses: d as MyCourse[], paths: [] as MyPath[] }
      : { courses: (d?.courses ?? []) as MyCourse[], paths: (d?.paths ?? []) as MyPath[] })
}

// ─── Программы (ТЗ-105 v2) ──────────────────────────────────────────────────

// Полка витрины: published-программы; my — только для записанных (после кэша).
export interface PathShelfItem {
  slug: string
  title: string
  cover_url: string | null
  courses_count: number
  total_lessons: number
  total_minutes: number
  my?: { percent: number; done_courses: number } | null
}

export function fetchPaths(): Promise<PathShelfItem[]> {
  return api.get('/education/paths')
}

export type PathItemStatus = 'completed' | 'in_progress' | 'available' | 'needs_purchase' | 'locked_hidden'

export interface PathItem {
  position: number
  slug: string
  title: string
  size: string
  cover_url: string | null
  price: number
  lessons_count: number
  total_minutes: number
  /** Самый дешёвый активный тариф, включающий курс («или от тарифа PRO»). */
  included_tariffs: string | null
  my_status: PathItemStatus
  progress: { done_lessons: number; total_lessons: number }
}

// ТЗ-105 v2: my — только для залогиненных (бэк не отдаёт анонимам).
export interface PathMy {
  enrolled: boolean
  percent: number
  done_courses: number
  total_courses: number
  completed: boolean
  next_slug: string | null
}

export interface PathDetail {
  slug: string
  title: string
  description: string
  cover_url: string | null
  status: string
  archived: boolean
  courses_count: number
  hidden_count: number
  total_lessons: number
  total_minutes: number
  items: PathItem[]
  my?: PathMy
}

export function fetchPath(slug: string): Promise<PathDetail> {
  return api.get(`/education/paths/${encodeURIComponent(slug)}`)
}

// Запись на программу: бесплатные → free, по тарифу → subscription, уже
// записан → already, платный без доступа → needs_purchase. Slug'и курсов.
export function enrollPath(slug: string): Promise<{ enrolled: string[]; already: string[]; needs_purchase: string[] }> {
  return api.post(`/education/paths/${encodeURIComponent(slug)}/enroll`, {})
}

// Отписка: только запись на программу; курсы и прогресс сохраняются (204).
export function unenrollPath(slug: string): Promise<null> {
  return api.delete(`/education/paths/${encodeURIComponent(slug)}/enroll`)
}

// ─── Граф знаний (ТЗ-107 v3) ───────────────────────────────────────────────
// Оба эндпоинта под фичефлагом EDUCATION_GRAPH_ENABLED: выключен → 404 —
// компоненты молча не рендерят секции (пустой graph: null — то же самое).

/** Состояние урока в графе: open — записан, урок доступен, но не текущий. */
export type GraphLessonState = 'done' | 'current' | 'locked' | 'open'

export interface GraphCourseNode {
  id: string
  slug: string
  title: string
  situational: boolean
  lessons_count: number
  students: number
  included_tariffs: string[]
}

export interface GraphLessonNode {
  id: string
  course_id: string
  title: string
}

/** Глобальная карта: GET /api/education/graph → { graph: KnowledgeGraph | null }. */
export interface KnowledgeGraph {
  nodes: {
    courses: GraphCourseNode[]
    lessons: GraphLessonNode[]
  }
  edges: {
    courses: { a: string; b: string; sim: number }[]
    lessons: { a: string; b: string; sim: number }[]
  }
  /** lesson_id → состояние; только для авторизованного (гостю не приходит). */
  my_progress?: Record<string, GraphLessonState>
  /** id курсов записанного юзера; только для авторизованного. */
  my_courses?: string[]
}

export function fetchGraph(): Promise<{ graph: KnowledgeGraph | null }> {
  return api.get('/education/graph')
}

export interface CourseGraphLesson {
  id: string
  title: string
  position: number
  state: GraphLessonState
}

export interface CourseGraphRecommendation {
  lesson_id: string
  title: string
  course: { slug: string; title: string }
  sim: number
  /** До 3 общих тегов курсов — подпись «почему связаны» (если есть). */
  shared_tags?: string[]
}

/** Локальный граф курса: GET /api/education/courses/:slug/graph.
 *  { graph: null } → 404; курс не published → 404. Секция не рендерится. */
export interface CourseKnowledgeGraph {
  lessons: CourseGraphLesson[]
  edges_structural: number[][]
  edges_semantic: { a: string; b: string; sim: number }[]
  recommendations: CourseGraphRecommendation[]
}

export function fetchCourseGraph(slug: string): Promise<{ graph: CourseKnowledgeGraph | null }> {
  return api.get(`/education/courses/${encodeURIComponent(slug)}/graph`)
}

// ─── Шеринг инвестиционного пути (ТЗ-100 v8; маршрут /education/path/:token) ──

/** Текущая публичная ссылка юзера: { token, url } или { token: null, url: null }. */
export interface PathShare {
  token: string | null
  url: string | null
}

export function fetchPathShare(): Promise<PathShare> {
  return api.get('/education/my/path-share')
}

/** Создать/перевыпустить токен: старая ссылка немедленно умирает. */
export function createPathShare(): Promise<PathShare> {
  return api.post('/education/my/path-share', {})
}

/** Отозвать ссылку (204). */
export function revokePathShare(): Promise<null> {
  return api.delete('/education/my/path-share')
}

/** Узел публичного пути — курс с прогрессом владельца. */
export interface SharedPathItem {
  slug: string
  title: string
  type: string
  size: string
  cover_url: string | null
  progress_percent: number
  completed: boolean
}

/** Публичный ответ GET /education/shared/:token (без авторизации). 404 — ссылка отозвана/нет. */
export interface SharedPathData {
  owner: { username: string }
  stats: { courses: number; lessons_done: number; minutes: number }
  items: SharedPathItem[]
}

export function fetchSharedPath(token: string): Promise<SharedPathData> {
  return api.get(`/education/shared/${encodeURIComponent(token)}`)
}

// ─── ТЗ-187: «Меджик-линк» — разовый шеринг урока гостю ────────────────────
// Квота 2 ссылки/12 ч (429 с retry_after_hours), ссылка живёт 1 час и
// сгорает при первом открытии (410 used/expired). Гость видит только текст.

/** Ответ POST /education/lessons/:id/share — готовая ссылка для гостя. */
export interface LessonShareCreated {
  url: string
}

export function shareLesson(lessonId: string): Promise<LessonShareCreated> {
  return api.post(`/education/lessons/${encodeURIComponent(lessonId)}/share`, {})
}

/** Публичный ответ GET /education/shared-lessons/:token (без авторизации). */
export interface SharedLessonData {
  lesson: { title: string; content_html: string; position: number }
  course: { title: string; slug: string }
}

export function fetchSharedLesson(token: string): Promise<SharedLessonData> {
  return api.get(`/education/shared-lessons/${encodeURIComponent(token)}`)
}

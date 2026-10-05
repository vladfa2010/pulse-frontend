// Общие типы LMS «Образование» (ТЗ-101) — зеркалят контракт pulse-backend/src/routes/adminEducation.ts

export type CourseType = 'course' | 'situational'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type CourseSize = 'micro' | 'standard' | 'full'
export type CourseVisibility = 'public' | 'hidden'
export type UnlockMode = 'full' | 'drip'
export type CourseBadge = 'new' | 'popular' | 'recommended'
export type LessonKind = 'text' | 'video' | 'video_text'
export type MaterialKind = 'file' | 'link' | 'news'
export type SourceType = 'news' | 'cascade' | 'storyline' | 'topic'
export type EnrollmentSource = 'free' | 'purchase' | 'subscription' | 'admin_grant'

/** Строка таблицы курсов (GET /courses). */
export interface CourseListItem {
  id: string
  slug: string
  title: string
  type: CourseType
  size: CourseSize
  status: CourseStatus
  visibility: CourseVisibility
  price: number
  badges: CourseBadge[]
  cover_url: string | null
  category_id: string | null
  category_name: string | null
  source_type: SourceType | null
  source_news_id: string | null
  is_orphan: boolean
  deleted_at: string | null
  lessons_count: number
  enrollments_count: number
  created_at: string
  updated_at: string
}

export interface TestQuestion {
  q: string
  options: string[]
  correct: number
}

export interface LessonTest {
  id: string
  pass_score: number
  is_blocking: boolean
  questions: TestQuestion[]
}

/** ТЗ-124: CTA-кнопка урока. */
export interface LessonButton {
  label: string
  url: string
  color: 'accent' | 'violet' | 'green' | 'ghost'
  target: 'self' | 'new_tab'
}

export interface Lesson {
  id: string
  position: number
  title: string
  kind: LessonKind
  text_content: string | null
  video_source: string | null
  video_embed_url: string | null
  video_file_url: string | null
  duration_min: number | null
  is_free_preview: boolean
  unlock_after_days: number
  test?: LessonTest | null
  /** ТЗ-124: CTA-кнопки урока (0–3, поле урока — работают и для несохранённого). */
  buttons?: LessonButton[]
  /** ТЗ-141: маркеры на плашке урока. materials_count — в обоих payload'ах;
   * has_test/test_is_blocking — только в лёгком list-эндпоинте (полный несёт test). */
  has_test?: boolean
  test_is_blocking?: boolean
  materials_count?: number
}

export interface Material {
  id: string
  kind: MaterialKind
  title: string
  url: string | null
  news_id: string | null
  is_free: boolean
  position: number
  /** ТЗ-123: null = материал курса, идентификатор = материал урока. */
  lesson_id?: string | null
}

export interface LinkedNews {
  id: string
  slug: string | null
  title_ru: string
  published_at: string | null
}

export interface CourseTag {
  id: string
  label: string
}

export interface PickedSource {
  source_type: SourceType
  id: string
  title: string | null
}

/** Полная карточка курса для редактора (GET /courses/:id). */
export interface CourseCard {
  id: string
  slug: string
  title: string
  description: string | null
  cover_url: string | null
  type: CourseType
  size: CourseSize
  price: number
  badges: CourseBadge[]
  status: CourseStatus
  visibility: CourseVisibility
  subscription_unlock_mode: UnlockMode
  category_id: string | null
  category_name: string | null
  author: string | null
  relevant_until: string | null
  source_type: SourceType | null
  source_news_id: string | null
  source: PickedSource | null
  is_orphan: boolean
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  tariff_ids: string[]
  subscription_enrollments_count: number
  lessons: Lesson[]
  materials: Material[]
  linked_news: LinkedNews[]
  tags: CourseTag[]
}

export interface Category {
  id: string
  name: string
  description: string | null
  position: number
  courses_count: number
}

export interface Plan {
  id: string
  name: string
  price: number
  plan_level: number | null
}

export interface NewsSearchItem {
  id: string
  slug: string | null
  title_ru: string
  published_at: string | null
}

export interface Enrollment {
  user_id: string
  username: string | null
  email: string | null
  is_blocked: boolean
  source: EnrollmentSource
  payment_id: string | null
  created_at: string
  progress: {
    completed_lessons: number
    total_lessons: number
    percent: number
  }
}

export interface UserSearchItem {
  id: string
  email: string
  username: string | null
  is_blocked: boolean
}

export interface TagSearchItem {
  tag_id: string
  tag_name: string
  tag_type: string | null
}

/** Ошибки бэкенда LMS — формат { error: string }. */
export interface EduError extends Error {
  status?: number
}

// ─── Модерация UGC (ТЗ-102) ────────────────────────────────────────────────

/** kind очереди: material — предложенный материал; news-suggestion — предложенная новость. */
export type ModerationKind = 'material' | 'news-suggestion'

export interface ModerationItem {
  kind: ModerationKind
  id: string
  type: 'link' | 'file' | 'news'
  title: string
  /** Для ссылок. */
  url?: string | null
  /** Для файлов — человекочитаемое имя/размер (для кнопки «Скачать»). */
  file_name?: string | null
  file_size?: number | null
  /** Для новостей — заголовок и дата. */
  news_title?: string | null
  news_published_at?: string | null
  course: { id: string; title: string }
  author: { id: string; username: string | null }
  created_at: string
  /** (ТЗ-102 v2) clamd недоступен — файл на проверке, скачивание закрыто. */
  av_unavailable?: boolean
  /** ТЗ-142: история модерации (вкладка «Обработанные»). */
  status?: 'pending' | 'approved' | 'rejected'
  reviewed_at?: string | null
  reviewed_by?: { username: string | null } | null
  reject_reason?: string | null
}

export interface ModerationQueue {
  total: number
  items: ModerationItem[]
}

// ─── Мэтчинг курсов (ТЗ-103) ────────────────────────────────────────────────

/** Источник рекомендации: общий тег / близость эмбеддингов / оба сигнала. */
export type MatchSource = 'tag' | 'embedding' | 'both'

/** Строка course_match_suggestions + join news (GET /courses/:id/suggestions). */
export interface MatchSuggestion {
  id: string
  news: {
    id: string
    slug: string | null
    title: string
    published_at: string | null
    source: string | null
  }
  /** 0..1 от LLM; NULL — LLM не оценивал (дневной лимит), показана только тег-пара. */
  score: number | null
  reason: string | null
  source: MatchSource
  created_at: string
}

/** Событие календаря, сматчившееся с курсом (events-preview, ТЗ-103 v2). */
export interface MatchedCalendarEvent {
  date: string // YYYY-MM-DD (бизнес-дата, МСК)
  title: string
  kind: string
  status: 'confirmed' | 'expected'
  company: string | null
  ticker: string | null
  /** Общие теги курса и события — «причина» мэтча. */
  matched_tags: string[]
}

export interface EventsPreviewResponse {
  events: MatchedCalendarEvent[]
  /** 'no_tags' — у курса нет тегов, мэтчинг не работает. */
  warning?: string
}

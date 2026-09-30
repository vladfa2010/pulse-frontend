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
}

export interface Material {
  id: string
  kind: MaterialKind
  title: string
  url: string | null
  news_id: string | null
  is_free: boolean
  position: number
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

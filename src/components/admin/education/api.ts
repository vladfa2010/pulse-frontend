import { adminApi } from '@/lib/api'
import { safeStorage } from '@/lib/safeStorage'
import type {
  Category,
  CourseCard,
  CourseListItem,
  CourseTag,
  Enrollment,
  EventsPreviewResponse,
  Lesson,
  LinkedNews,
  MatchSuggestion,
  Material,
  ModerationKind,
  ModerationQueue,
  NewsSearchItem,
  PickedSource,
  Plan,
  TagSearchItem,
  UserSearchItem,
} from './types'

// Все запросы админ-контура LMS идут через adminApi (Bearer pulse_token).
// Пути — относительно корня: adminApi сам подставляет ADMIN_BASE.
const EDU = '/api/admin/education'

export function getAdminToken(): string {
  return safeStorage.get('pulse_token') || ''
}

/** Относительные пути storage (/media/...) → абсолютный URL публичной раздачи. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `https://pulse.inside-trade.ru${path}`
}

// ─── Справочники ────────────────────────────────────────────────────────────

export function fetchTags(q: string): Promise<TagSearchItem[]> {
  return adminApi.get(`${EDU}/tags?q=${encodeURIComponent(q)}`)
}

export function fetchPlans(): Promise<Plan[]> {
  return adminApi.get(`${EDU}/plans`)
}

export function searchNews(q: string): Promise<NewsSearchItem[]> {
  return adminApi.get(`${EDU}/news-search?q=${encodeURIComponent(q)}`)
}

export function resolveSource(url: string): Promise<PickedSource> {
  return adminApi.post(`${EDU}/resolve-source`, { url })
}

// ─── Категории ──────────────────────────────────────────────────────────────

export function fetchCategories(): Promise<Category[]> {
  return adminApi.get(`${EDU}/categories`)
}

export function createCategory(body: {
  id: string
  name: string
  description?: string
}): Promise<Category> {
  return adminApi.post(`${EDU}/categories`, body)
}

export function updateCategory(
  id: string,
  body: { name?: string; description?: string },
): Promise<Category> {
  return adminApi.put(`${EDU}/categories/${id}`, body)
}

export function reorderCategories(ids: string[]): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/categories/reorder`, { ids })
}

export function deleteCategory(id: string): Promise<{ ok: boolean }> {
  return adminApi.delete(`${EDU}/categories/${id}`)
}

// ─── Курсы ──────────────────────────────────────────────────────────────────

export interface CourseListParams {
  orphans?: boolean
  includeDeleted?: boolean
}

export function fetchCourses(params: CourseListParams = {}): Promise<CourseListItem[]> {
  const qs = new URLSearchParams()
  if (params.orphans) qs.set('orphans', '1')
  if (params.includeDeleted) qs.set('include_deleted', '1')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return adminApi.get(`${EDU}/courses${suffix}`)
}

export interface CreateCourseBody {
  title: string
  type: 'course' | 'situational'
  price?: number
  tag_ids?: string[]
  source_url?: string
  relevant_until?: string | null
}

export function createCourse(body: CreateCourseBody): Promise<CourseCard> {
  return adminApi.post(`${EDU}/courses`, body)
}

export function fetchCourse(id: string): Promise<CourseCard> {
  return adminApi.get(`${EDU}/courses/${id}`)
}

export function updateCourse(id: string, body: Record<string, unknown>): Promise<CourseCard> {
  return adminApi.put(`${EDU}/courses/${id}`, body)
}

export function publishCourse(id: string): Promise<CourseCard> {
  return adminApi.post(`${EDU}/courses/${id}/publish`, {})
}

export function archiveCourse(id: string): Promise<CourseCard> {
  return adminApi.post(`${EDU}/courses/${id}/archive`, {})
}

export function deleteCourse(id: string): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/courses/${id}/delete`, {})
}

export function restoreCourse(id: string): Promise<CourseCard> {
  return adminApi.post(`${EDU}/courses/${id}/restore`, {})
}

export function uploadCover(
  id: string,
  file: File,
  onProgress?: (percent: number, waiting: boolean) => void,
): Promise<{ cover_url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  return adminApi.postForm(`${EDU}/courses/${id}/cover`, fd, p => {
    if (!onProgress) return
    onProgress(p.percent, p.loaded === -1)
  })
}

// ТЗ-136: картинка для вставки в текст урока/описание курса.
// Ответ { url: '/media/content/<uuid>.<ext>' } — kind 'content' публичный,
// путь вставляется в HTML и живёт там навсегда (signed URL не подходит).
export function uploadContentImage(file: File): Promise<{ url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  return adminApi.postForm(`${EDU}/content-image`, fd)
}

export function replaceCourseTags(id: string, tagIds: string[]): Promise<{ tag_ids: string[] }> {
  return adminApi.put(`${EDU}/courses/${id}/tags`, { tag_ids: tagIds })
}

// ─── Уроки и тесты ──────────────────────────────────────────────────────────

export function fetchLessons(courseId: string): Promise<Lesson[]> {
  return adminApi.get(`${EDU}/courses/${courseId}/lessons`)
}

export function createLesson(
  courseId: string,
  body: Record<string, unknown>,
): Promise<{ id: string; position: number }> {
  return adminApi.post(`${EDU}/courses/${courseId}/lessons`, body)
}

export function updateLesson(lessonId: string, body: Record<string, unknown>): Promise<Lesson> {
  return adminApi.put(`${EDU}/lessons/${lessonId}`, body)
}

export function deleteLesson(lessonId: string): Promise<{ ok: boolean; removed_progress: number }> {
  return adminApi.delete(`${EDU}/lessons/${lessonId}`)
}

export function reorderLessons(courseId: string, lessonIds: string[]): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/courses/${courseId}/lessons/reorder`, { lesson_ids: lessonIds })
}

export function saveTest(
  lessonId: string,
  body: { pass_score: number; is_blocking: boolean; questions: unknown[] },
): Promise<{ ok: boolean }> {
  return adminApi.put(`${EDU}/lessons/${lessonId}/test`, body)
}

export function deleteTest(lessonId: string): Promise<{ ok: boolean }> {
  return adminApi.delete(`${EDU}/lessons/${lessonId}/test`)
}

// ─── Материалы ──────────────────────────────────────────────────────────────

export function fetchMaterials(courseId: string): Promise<Material[]> {
  return adminApi.get(`${EDU}/courses/${courseId}/materials`)
}

export function createMaterial(
  courseId: string,
  body: Record<string, unknown>,
): Promise<Material> {
  return adminApi.post(`${EDU}/courses/${courseId}/materials`, body)
}

export function uploadMaterial(
  courseId: string,
  file: File,
  onProgress?: (percent: number, waiting: boolean) => void,
  lessonId?: string | null,
): Promise<Material> {
  const fd = new FormData()
  fd.append('file', file)
  // ТЗ-123: материал урока — пробрасываем multipart-полем, бэк валидирует принадлежность
  if (lessonId) fd.append('lesson_id', lessonId)
  return adminApi.postForm(`${EDU}/courses/${courseId}/materials/upload`, fd, p => {
    if (!onProgress) return
    onProgress(p.percent, p.loaded === -1)
  })
}

export function patchMaterial(
  id: string,
  body: Record<string, unknown>,
): Promise<Material> {
  return adminApi.patch(`${EDU}/materials/${id}`, body)
}

export function deleteMaterial(courseId: string, materialId: string): Promise<{ ok: boolean }> {
  return adminApi.delete(`${EDU}/courses/${courseId}/materials/${materialId}`)
}

// ─── Привязка новостей ──────────────────────────────────────────────────────

export function fetchNewsLinks(courseId: string): Promise<LinkedNews[]> {
  return adminApi.get(`${EDU}/courses/${courseId}/news-links`)
}

export function addNewsLink(courseId: string, newsId: string): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/courses/${courseId}/news-links`, { news_id: newsId })
}

export function removeNewsLink(courseId: string, newsId: string): Promise<{ ok: boolean }> {
  return adminApi.delete(`${EDU}/courses/${courseId}/news-links/${newsId}`)
}

// ─── Записавшиеся ───────────────────────────────────────────────────────────

export function fetchEnrollments(courseId: string): Promise<Enrollment[]> {
  return adminApi.get(`${EDU}/courses/${courseId}/enrollments`)
}

export function searchUsers(q: string): Promise<UserSearchItem[]> {
  return adminApi.get(`${EDU}/users-search?q=${encodeURIComponent(q)}`)
}

export function enrollUser(
  courseId: string,
  userId: string,
): Promise<{ ok: boolean; already_enrolled?: boolean }> {
  return adminApi.post(`${EDU}/courses/${courseId}/enrollments`, { user_id: userId })
}

export function unenrollUser(courseId: string, userId: string): Promise<null> {
  return adminApi.delete(`${EDU}/courses/${courseId}/enrollments/${userId}`)
}

// ─── Модерация UGC (ТЗ-102) ────────────────────────────────────────────────

/** Очередь модерации: материалы + предложения новостей. status='pending' — FIFO
 *  очередь (как до ТЗ-142); 'approved'|'rejected' — история; 'all' — всё. */
export function fetchModeration(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
): Promise<ModerationQueue> {
  return adminApi.get(`${EDU}/moderation?status=${status}`)
}

export function approveModeration(kind: ModerationKind, id: string): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/moderation/${kind}/${id}/approve`, {})
}

export function rejectModeration(
  kind: ModerationKind,
  id: string,
  reason: string,
): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/moderation/${kind}/${id}/reject`, { reason })
}

// ─── Мэтчинг курсов (ТЗ-103) ────────────────────────────────────────────────

/** Рекомендации новостей к курсу (pending, score DESC NULLS LAST).
 *  404 — фичефлаг EDUCATION_MATCH_ENABLED выключен: секцию не рендерим. */
export function fetchSuggestions(courseId: string): Promise<MatchSuggestion[]> {
  return adminApi.get(`${EDU}/courses/${courseId}/suggestions?status=pending`)
}

/** Прикрепить рекомендованную новость (на бэке — в транзакции: news_course_links + status=attached). */
export function attachSuggestion(id: string): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/suggestions/${id}/attach`, {})
}

/** Отклонить рекомендацию (обратимо — повторный мэтчинг пару не воскрешает). */
export function dismissSuggestion(id: string): Promise<{ ok: boolean }> {
  return adminApi.post(`${EDU}/suggestions/${id}/dismiss`, {})
}

/** События календаря на 14 дней вперёд, сматчившиеся с курсом по тегам (read-only). */
export function fetchEventsPreview(courseId: string, days = 14): Promise<EventsPreviewResponse> {
  return adminApi.get(`${EDU}/courses/${courseId}/events-preview?days=${days}`)
}

// Для удобства импорта типов в одном месте (переэкспорт).
export type { CourseTag, LinkedNews }

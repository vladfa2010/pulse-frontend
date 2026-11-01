/**
 * =============================================================================
 * PULSE — Карточка урока в поисковой выдаче (ТЗ-215)
 * =============================================================================
 *
 * Компактная карточка раздела «Уроки по теме» (/feed, 4-й блок выдачи).
 * Клик ведёт на страницу КУРСА — гейт урока (checkLessonAccess: аноним 401,
 * не записан 403) не обходим и не дублируется; на странице курса LMS сам
 * предложит запись/подписку.
 */
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { resolveMediaUrl } from '@/lib/media'

export interface SearchLesson {
  lesson_id: string
  title: string
  course_slug: string
  course_title: string
  duration_min: number | null
  cover_url: string | null
  similarity: number
}

const easeOutExpo = [0.16, 1, 0.3, 1] as const

// ТЗ-215: карточка 1:1 по мокапу v7 — обложка курса 40×40, заголовок урока
// в две строки (кламп), мета-строка: плашка «Урок» + курс + длительность.
export default function SearchLessonCard({ lesson, index }: { lesson: SearchLesson; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: easeOutExpo }}
    >
      <Link
        to={`/education/${lesson.course_slug}`}
        className="flex items-center gap-3 no-underline text-inherit"
        style={{
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 12,
          padding: '12px 14px',
          transition: 'border-color .2s, transform .3s cubic-bezier(0.16,1,0.3,1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,212,255,.25)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {lesson.cover_url ? (
          <img
            src={resolveMediaUrl(lesson.cover_url)}
            alt={lesson.course_title}
            loading="lazy"
            className="shrink-0 object-cover"
            style={{ width: 40, height: 40, borderRadius: 8 }}
          />
        ) : (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'linear-gradient(135deg, hsl(200 55% 14%), hsl(240 45% 22%))',
              fontSize: 14,
              fontWeight: 700,
              color: 'rgba(255,255,255,.7)',
            }}
          >
            {lesson.course_title.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold text-white"
            style={{
              fontSize: 12.5,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {lesson.title}
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ fontSize: 10, color: '#6B7280' }}
          >
            <span
              className="shrink-0 rounded-full"
              style={{
                padding: '1px 7px',
                color: 'rgba(0,212,255,.7)',
                border: '1px solid rgba(0,212,255,.2)',
                backgroundColor: 'rgba(0,212,255,.05)',
                fontWeight: 600,
              }}
            >
              Урок
            </span>
            <span className="overflow-hidden text-ellipsis">из курса «{lesson.course_title}»</span>
            {lesson.duration_min != null && lesson.duration_min > 0 && (
              <span className="shrink-0">≈{lesson.duration_min} мин</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

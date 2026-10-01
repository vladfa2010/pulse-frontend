import { Link } from 'react-router'
import type { MatchedCourse } from '@/lib/educationApi'

// Мини-карточки курсов «Подготовиться» / «Изучить перед событием» (ТЗ-103 v2) —
// общий компонент блока «Сегодня в календаре» на витрине и подсказки на странице
// календаря. Клик ведёт на публичную страницу курса /education/:slug.

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро-курс',
  standard: 'Курс',
  full: 'Полный курс',
}

export default function MatchedCourseChips({
  courses,
  caption = 'Подготовиться',
  max = 3,
}: {
  courses: MatchedCourse[]
  caption?: string
  max?: number
}) {
  if (courses.length === 0) return null
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: '#6B7280' }}
      >
        {caption}
      </div>
      <div className="flex flex-col gap-2">
        {courses.slice(0, max).map(c => (
          <Link
            key={c.slug}
            to={`/education/${c.slug}`}
            className="block rounded-xl px-3.5 py-3 transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="flex-1 min-w-0 text-[13px] font-medium text-white truncate">
                {c.title}
              </span>
              <span className="text-[11px] text-[#6B7280] flex-none">
                {c.price > 0 ? `${c.price.toLocaleString('ru-RU')} ₽` : 'бесплатно'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B7280]">
                {SIZE_LABEL[c.size] || 'Курс'}
              </span>
              {(c.matched_tags || []).length > 0 && (
                <span className="flex-1 min-w-0 truncate text-[10px]" style={{ color: '#4B5563' }}>
                  общие теги: {c.matched_tags.join(' · ')}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

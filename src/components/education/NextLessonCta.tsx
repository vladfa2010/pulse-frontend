import { Link } from 'react-router'
import { ArrowRight, Clock } from 'lucide-react'

interface Props {
  next: {
    id: string
    position: number
    title: string
    access?: 'ok' | 'drip' | 'no_access'
    unlock_in_days?: number | null
  } | null
  courseSlug: string
  /** 'page' — на странице урока (большая), 'reader' — внизу читалки (компактная) */
  variant: 'page' | 'reader'
}

/** ТЗ-147/149: CTA перехода к следующему уроку.
 *  next === null → экран «Курс пройден».
 *  access 'drip' → карточка «через N дн.» без навигации.
 *  Всё остальное ('ok', 'no_access', undefined) — ссылка на урок:
 *  гейт доступа показывает сама страница урока (ТЗ-149). */
export default function NextLessonCta({ next, courseSlug, variant }: Props) {
  if (!next) {
    // Последний урок курса — «Курс пройден»
    return (
      <div className={`nl-cta done-course ${variant}`}>
        <div className="nl-cta-title">Поздравляем — это был последний урок курса! 🎉</div>
        <Link to={`/education/${encodeURIComponent(courseSlug)}`} className="nl-cta-btn">
          К программе курса
        </Link>
      </div>
    )
  }
  if (next.access === 'drip') {
    return (
      <div className={`nl-cta locked ${variant}`}>
        <Clock size={16} />
        <span>
          Следующий урок «{next.title}» откроется через {next.unlock_in_days} дн.
        </span>
      </div>
    )
  }
  // 'ok', 'no_access' или undefined (старый бэк) — всегда ведём на урок (ТЗ-149).
  // В читалке — короткий лейбл «Следующий урок» (полное название не влезает),
  // на странице урока — полный.
  return (
    <Link to={`/education/lesson/${next.id}`} className={`nl-cta-btn ${variant}`}>
      {variant === 'reader'
        ? 'Следующий урок'
        : `Следующий урок: ${next.position}. ${next.title}`}
      <ArrowRight size={14} />
    </Link>
  )
}

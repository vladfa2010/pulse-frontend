import { Link } from 'react-router'
import { ArrowRight, Lock, Clock } from 'lucide-react'

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

/** ТЗ-147: CTA перехода к следующему уроку по вилке доступности.
 *  next === null → экран «Курс пройден». */
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
  if (next.access === 'no_access') {
    return (
      <div className={`nl-cta locked ${variant}`}>
        <Lock size={16} />
        <span>Урок «{next.title}» доступен в полной версии курса.</span>
        <Link to={`/education/${encodeURIComponent(courseSlug)}`} className="nl-cta-link">
          Подробнее
        </Link>
      </div>
    )
  }
  // access 'ok' или undefined (старый бэк)
  return (
    <Link to={`/education/lesson/${next.id}`} className={`nl-cta-btn ${variant}`}>
      Следующий урок: {next.position}. {next.title}
      <ArrowRight size={14} />
    </Link>
  )
}

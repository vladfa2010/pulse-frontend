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
}

/** ТЗ-147/149/150: CTA перехода к следующему уроку — ТОЛЬКО в читалке
 *  (на странице урока убрано ТЗ-150, там есть нижняя навигация ТЗ-127).
 *  next === null → экран «Курс пройден» (мокап, сцена 4).
 *  access 'drip' → пилюля «через N дн.» без навигации (сцена 5).
 *  Всё остальное ('ok', 'no_access', undefined) — ссылка на урок:
 *  гейт доступа показывает сама страница урока (ТЗ-149).
 *  position/title в разметке не нужны, но остаются в Props — поля приходят
 *  от бэка (ТЗ-147) и нужны для совместимости типов с ReadMode. */
export default function NextLessonCta({ next, courseSlug }: Props) {
  if (!next) {
    return (
      <div className="rm-course-done">
        <div className="t">🎉 Поздравляем — это был последний урок курса!</div>
        <Link to={`/education/${encodeURIComponent(courseSlug)}`} className="nl-cta-btn">
          К программе курса
        </Link>
      </div>
    )
  }
  if (next.access === 'drip') {
    return (
      <div className="rm-drip">
        <Clock size={14} />
        Следующий урок — через {next.unlock_in_days} дн.
      </div>
    )
  }
  // 'ok', 'no_access' или undefined (старый бэк) — всегда ведём на урок (ТЗ-149).
  return (
    <Link to={`/education/lesson/${next.id}`} className="nl-cta-btn reader">
      Следующий урок
      <ArrowRight size={14} />
    </Link>
  )
}

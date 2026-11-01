/**
 * =============================================================================
 * PULSE — Карточка курса (общий компонент, ТЗ-214)
 * =============================================================================
 *
 * Вынесена из Education.tsx: карточка 1:1 по витрине используется и в поиске
 * (NewsFeed.tsx, раздел «Курсы по теме») — вторую копию не плодим, при правках
 * проверять оба контекста (критерий 7 ТЗ-214).
 *
 * Поисковый эндпоинт /api/news/search (поле courses, ТЗ-214) отдаёт ровно
 * набор CourseCardData; витринный VitrineCourse его покрывает структурно.
 * mine / my_enrollment — только витринный контекст (прогресс, «Скрытый курс»).
 */
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { resolveMediaUrl } from '@/lib/media'

/** Минимальный набор полей карточки: что ест компонент и что отдаёт поиск. */
export interface CourseCardData {
  slug: string
  title: string
  cover_url: string | null
  type: string
  size: string
  price: number
  badges: string[]
  category: { id: string; name: string } | null
  source?: { title: string | null } | null
  lessons_count: number
  total_minutes: number
  students_count: number
  visibility?: string
  my_enrollment?: boolean
  tariff_name?: string | null
}

const easeOutExpo = [0.16, 1, 0.3, 1] as const

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро-курс',
  standard: 'Курс',
  full: 'Полный курс',
}

// ТЗ-131: маппинг бейджей карточки по мокапу education.html (максимум 2 шт.;
// неизвестные бейджи не рендерим). Ключ класса → { label, kind }.
const BADGE_MAP: Record<string, { label: string; kind: 'new' | 'rec' | 'pop' }> = {
  new: { label: 'Новое', kind: 'new' },
  rec: { label: 'Рекомендуем', kind: 'rec' },
  recommended: { label: 'Рекомендуем', kind: 'rec' },
  pop: { label: 'Популярное', kind: 'pop' },
  popular: { label: 'Популярное', kind: 'pop' },
  hot: { label: 'Популярное', kind: 'pop' },
}

// ТЗ-131: склонения и формат минут для меты карточки («12 уроков · 45 мин · 128 уч.»).
function plural(n: number, one: string, few: string, many: string): string {
  const m = n % 10
  const h = n % 100
  if (m === 1 && h !== 11) return one
  if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return few
  return many
}

function formatMin(m: number): string {
  if (m <= 0) return '0 мин'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} ч` : `${h} ч ${r} мин`
}

// ТЗ-131: карточка курса 1:1 по мокапу education.html. mine — прогресс
// записи (percent) из /education/my; полоса показывается при percent > 0.
// onSelectCategory — витринный фильтр; в поиске клик по категории ведёт на витрину.
export default function CourseCard({ course, index, mine, onSelectCategory }: {
  course: CourseCardData
  index: number
  mine?: number
  onSelectCategory?: (cat: { id: string; name: string }) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: easeOutExpo }}
    >
      <Link to={`/education/${course.slug}`} className="edu-card">
        <div className="edu-card-cover">
          {course.cover_url ? (
            <img src={resolveMediaUrl(course.cover_url)} alt={course.title} loading="lazy" />
          ) : (
            <div className="edu-card-cover-ph" />
          )}
          <span className={`card-type${course.type === 'situational' ? ' hot' : ''}`}>
            {course.type === 'situational' ? 'Ситуационный' : SIZE_LABEL[course.size] || 'Курс'}
          </span>
          {course.category && (
            <button
              type="button"
              className="card-cat"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (onSelectCategory) onSelectCategory(course.category!)
              }}
            >
              {course.category.name}
            </button>
          )}
        </div>
        <div className="card-body">
          {course.type === 'situational' && course.source?.title && (
            <div className="card-src"><i />по новости: <span>«{course.source.title}»</span></div>
          )}
          <div className="card-title">{course.title}</div>
          <div className="card-meta">
            {course.lessons_count} {plural(course.lessons_count, 'урок', 'урока', 'уроков')}
            {' · '}{formatMin(course.total_minutes)}
            {' · '}{course.students_count} {plural(course.students_count, 'ученик', 'ученика', 'учеников')}
          </div>
          {mine !== undefined && mine > 0 && (
            <div className="progress-line">
              <div className="progress"><i style={{ width: `${mine}%` }} /></div>
              <span className="pct">{mine}%</span>
            </div>
          )}
          {course.visibility === 'hidden' && course.my_enrollment && (
            <>
              <span className="secret-pill">Скрытый курс</span>
              <span className="secret-note">Не виден на витрине — вы записаны администратором</span>
            </>
          )}
          {course.tariff_name && !course.my_enrollment && (
            <div className="card-tariff">или от тарифа {course.tariff_name}</div>
          )}
          <div className="card-foot">
            <span className={`card-price${course.price === 0 ? ' free' : ''}`}>
              {course.price === 0 ? 'Бесплатно' : `${course.price.toLocaleString('ru-RU')} ₽`}
            </span>
            <span className="card-badges">
              {course.badges.slice(0, 2).map(b => {
                const badge = BADGE_MAP[b]
                if (!badge) return null
                return (
                  <span key={b} className={`badge ${badge.kind}`}>
                    <i />{badge.label}
                  </span>
                )
              })}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

import { useMemo, useState } from 'react'
import { getAdminToken, mediaUrl } from './api'
import {
  BadgePill,
  Btn,
  C,
  coverGradient,
  IconBtn,
  SizeLabel,
  StatusPill,
  TypePill,
  inputBlur,
  inputCls,
  inputFocus,
  inputStyle,
} from './ui'
import type { CourseListItem } from './types'

// Экран 1 — список курсов (мокап admin.html: .page-head + #course-table).

export default function CourseTable({
  courses,
  loading,
  orphanCount,
  orphanOnly,
  onToggleOrphan,
  includeDeleted,
  onToggleIncludeDeleted,
  onReload,
  onOpenCourse,
  onOpenCreate,
  onOpenCategories,
  onPublish,
  onArchive,
  onRestore,
  toast,
}: {
  courses: CourseListItem[]
  loading: boolean
  orphanCount: number
  orphanOnly: boolean
  onToggleOrphan: () => void
  includeDeleted: boolean
  onToggleIncludeDeleted: () => void
  onReload: () => void
  onOpenCourse: (id: string) => void
  onOpenCreate: () => void
  onOpenCategories: () => void
  onPublish: (c: CourseListItem) => void
  onArchive: (c: CourseListItem) => void
  onRestore: (c: CourseListItem) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(c => c.title.toLowerCase().includes(q))
  }, [courses, search])

  const total = courses.filter(c => !c.deleted_at).length
  const published = courses.filter(c => c.status === 'published' && !c.deleted_at).length
  const hidden = courses.filter(c => c.visibility === 'hidden' && !c.deleted_at).length

  const openVitrine = (c: CourseListItem) => {
    // Для draft витрина откроется с ?preview_token=<admin JWT> (ТЗ-101 Задача 2).
    const suffix = c.status === 'draft' ? `?preview_token=${encodeURIComponent(getAdminToken())}` : ''
    window.open(`/education/${c.slug}${suffix}`, '_blank')
  }

  return (
    <div>
      {/* Шапка страницы (мокап .page-head) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: C.accent,
              boxShadow: '0 0 10px rgba(0,212,255,.55)',
            }}
          />
          Курсы{' '}
          <span style={{ color: C.textMuted, fontWeight: 500, fontSize: 14 }}>
            {total} всего · {published} опубликовано · {hidden} скрытых
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию…"
            className={inputCls}
            style={{ ...inputStyle, width: 220, height: 38 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <Btn
            onClick={() => {
              onToggleOrphan()
              toast(
                orphanOnly
                  ? 'Фильтр «Потеряли источник» снят'
                  : 'Фильтр «Потеряли источник»: situational-курсы с удалённым источником (ON DELETE SET NULL)',
              )
            }}
            title="situational-курсы с удалённым источником (ON DELETE SET NULL) — сейчас таких нет"
          >
            Потеряли источник · {orphanCount}
          </Btn>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: C.textMuted,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={() => {
                onToggleIncludeDeleted()
                onReload()
              }}
            />
            показывать удалённые
          </label>
          <Btn onClick={onOpenCategories}>Категории</Btn>
          <Btn variant="accent" onClick={onOpenCreate}>
            + Новый курс
          </Btn>
        </div>
      </div>

      {/* Таблица (мокап .table-card) */}
      <div
        style={{
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderRadius: '.75rem',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Загружаем курсы…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            {orphanOnly
              ? 'Сирот нет — у всех ситуационных курсов живой источник'
              : 'Курсов пока нет — создайте первый.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Обложка', 'Курс', 'Статус', 'Цена', 'Метки', 'Уроки', 'Записано', 'Действия'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: C.textMuted,
                        padding: '14px 16px',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <Row
                    key={c.id}
                    course={c}
                    onOpen={() => onOpenCourse(c.id)}
                    onPublish={() => onPublish(c)}
                    onArchive={() => onArchive(c)}
                    onRestore={() => onRestore(c)}
                    onVitrine={() => openVitrine(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  course: c,
  onOpen,
  onPublish,
  onArchive,
  onRestore,
  onVitrine,
}: {
  course: CourseListItem
  onOpen: () => void
  onPublish: () => void
  onArchive: () => void
  onRestore: () => void
  onVitrine: () => void
}) {
  const deleted = !!c.deleted_at
  return (
    <tr
      onClick={onOpen}
      style={{
        cursor: 'pointer',
        transition: 'background .15s',
        opacity: deleted ? 0.55 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#111111')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Обложка 64px; без файла — generative-заглушка от slug */}
      <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle' }}>
        {c.cover_url ? (
          <img
            src={mediaUrl(c.cover_url)}
            alt=""
            style={{ width: 64, height: 40, borderRadius: '.375rem', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 40,
              borderRadius: '.375rem',
              background: coverGradient(c.slug),
              display: 'grid',
              placeItems: 'center',
              fontSize: 9,
              color: C.textMuted,
            }}
          >
            заглушка
          </div>
        )}
      </td>
      <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle' }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={deleted ? { textDecoration: 'line-through' } : undefined}>{c.title}</span>
          <SizeLabel size={c.size} />
          {c.type === 'situational' &&
            (c.is_orphan ? (
              <TypePill color={C.amber}>источник удалён</TypePill>
            ) : (
              <TypePill color={C.accent}>по новости</TypePill>
            ))}
          {c.visibility === 'hidden' && (
            <TypePill color={C.textSecondary} border="rgba(156,163,175,.4)">
              Скрытый
            </TypePill>
          )}
          {c.category_name && (
            <TypePill color={C.textSecondary} border="rgba(255,255,255,.14)" dim>
              {c.category_name}
            </TypePill>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>/education/{c.slug}</div>
      </td>
      <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle' }}>
        <StatusPill status={c.status} />
      </td>
      <td
        className="num"
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.borderRow}`,
          verticalAlign: 'middle',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {c.price === 0 ? 'Бесплатно' : `${c.price.toLocaleString('ru-RU')} ₽`}
      </td>
      <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle' }}>
        {c.badges.length > 0 ? (
          c.badges.map(b => <BadgePill key={b} badge={b} />)
        ) : (
          <span style={{ color: C.textMuted }}>—</span>
        )}
      </td>
      <td
        className="num"
        style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}
      >
        {c.lessons_count}
      </td>
      <td
        className="num"
        style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}
      >
        {c.enrollments_count}
      </td>
      <td
        style={{ padding: '14px 16px', borderBottom: `1px solid ${C.borderRow}`, verticalAlign: 'middle' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {deleted ? (
            <Btn sm onClick={onRestore}>
              Восстановить
            </Btn>
          ) : (
            <>
              {c.status === 'published' ? (
                <Btn sm onClick={onArchive}>
                  Архив
                </Btn>
              ) : (
                <Btn sm variant="accent" onClick={onPublish}>
                  Опубл.
                </Btn>
              )}
              <Btn sm onClick={onVitrine} title="Открыть витрину в новой вкладке">
                Витрина ↗
              </Btn>
              <IconBtn title="Редактировать" onClick={onOpen}>
                ✎
              </IconBtn>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

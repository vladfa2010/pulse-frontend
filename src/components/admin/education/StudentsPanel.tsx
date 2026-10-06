import { useEffect, useRef, useState } from 'react'
import { enrollUser, fetchEnrollments, searchUsers, unenrollUser } from './api'
import { Btn, C, SourcePill, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { CourseCard, Enrollment, UserSearchItem } from './types'

// Вкладка «Записавшиеся» (ТЗ-101 Задача 4): поиск юзеров (debounce 300 мс),
// запись админом (в т.ч. платный курс без оплаты — source='admin_grant'),
// таблица с прогрессом, «Выписать» с confirm «Прогресс сохранится».

export default function StudentsPanel({
  course,
  toast,
}: {
  course: CourseCard
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<UserSearchItem[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [picked, setPicked] = useState<UserSearchItem | null>(null)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const reload = async () => {
    try {
      setEnrollments(await fetchEnrollments(course.id))
    } catch (err: any) {
      toast(err?.message || 'Не удалось загрузить слушателей', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  // Debounce 300 мс (ТЗ-101 Задача 4); минимум 2 символа (400 на бэкенде).
  useEffect(() => {
    const query = q.trim()
    setPicked(null)
    if (query.length < 2) {
      setOptions([])
      setDropOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const list = await searchUsers(query)
        const enrolledIds = new Set(enrollments.map(e => e.user_id))
        setOptions(list.filter(u => !enrolledIds.has(u.id)))
        setDropOpen(true)
      } catch {
        setOptions([])
        setDropOpen(true)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, enrollments])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleEnroll = async () => {
    if (!picked) {
      toast('Найдите и выберите пользователя', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await enrollUser(course.id, picked.id)
      toast(
        res.already_enrolled
          ? `${picked.username || picked.email} уже записан на курс`
          : `${picked.username || picked.email} записан на курс (без оплаты)`,
        'success',
      )
      setPicked(null)
      setQ('')
      await reload()
    } catch (err: any) {
      // 404 юзер/курс, 409 курс удалён, 422 blocked — текстом бэкенда.
      toast(err?.message || 'Не удалось записать пользователя', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleUnenroll = async (e: Enrollment) => {
    const name = e.username || e.email || e.user_id
    if (!window.confirm(`Выписать ${name} с курса? Прогресс сохранится.`)) return
    try {
      await unenrollUser(course.id, e.user_id)
      setEnrollments(prev => prev.filter(x => x.user_id !== e.user_id))
      toast(`${name} выписан с курса`, 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось выписать пользователя', 'error')
    }
  }

  const paid = course.price > 0

  return (
    <div>
      {course.visibility === 'hidden' && (
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
          Скрытый курс: пользователи не могут записаться сами, только через эту панель.
        </div>
      )}
      {/* Шапка панели (мокап .students-bar). */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: C.textSecondary,
            flex: 'none',
          }}
        >
          Записано: {enrollments.length}
        </span>
        <div ref={rootRef} style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 420 }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Email или никнейм пользователя…"
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          {dropOpen && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 5,
                background: '#101010',
                border: `1px solid ${C.border}`,
                borderRadius: '.625rem',
                overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(0,0,0,.6)',
              }}
            >
              {options.length === 0 ? (
                <div style={{ padding: '11px 14px', fontSize: 12, color: C.textMuted }}>Не найдено</div>
              ) : (
                options.map(u => (
                  <div
                    key={u.id}
                    onMouseDown={ev => {
                      ev.preventDefault()
                      setPicked(u)
                      // Подставляем email, а не никнейм: никнеймы не уникальны
                      // («test», «Влад» у нескольких аккаунтов) — после выбора в поле
                      // должно быть однозначно, кого записываем.
                      setQ(u.email || u.username || '')
                      setDropOpen(false)
                    }}
                    style={{
                      padding: '11px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'baseline',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = C.bgHover)}
                    onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                  >
                    <span>{u.username || '—'}</span>
                    <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>
                      {u.email}
                      {u.is_blocked ? ' · заблокирован' : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <Btn variant="accent" disabled={busy || !picked} onClick={handleEnroll}>
          Записать
        </Btn>
        {paid && (
          <div style={{ fontSize: 11, color: C.amber, width: '100%', marginTop: -4 }}>
            Курс платный — пользователь, записанный админом, получит доступ без оплаты.
          </div>
        )}
      </div>

      {/* Таблица слушателей (мокап p-students). */}
      <div
        style={{
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderRadius: '.75rem',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Загружаем…
          </div>
        ) : enrollments.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Пока никто не записан
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Пользователь', 'Источник', 'Прогресс', 'Дата записи', ''].map((h, i) => (
                    <th
                      key={i}
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
                {enrollments.map(e => {
                  const name = e.username || e.email || e.user_id
                  return (
                    <tr key={e.user_id}>
                      <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderRow}`, fontSize: 13 }}>
                        <div>{name}</div>
                        {e.email && e.username && (
                          <div style={{ fontSize: 11, color: C.textMuted }}>{e.email}</div>
                        )}
                        {e.is_blocked && (
                          <div style={{ fontSize: 11, color: C.error }}>заблокирован</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderRow}` }}>
                        <SourcePill source={e.source} />
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          borderBottom: `1px solid ${C.borderRow}`,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 13,
                        }}
                      >
                        {e.progress.percent}%
                        <span style={{ fontSize: 11, color: C.textMuted }}>
                          {' '}
                          ({e.progress.completed_lessons}/{e.progress.total_lessons})
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          borderBottom: `1px solid ${C.borderRow}`,
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {new Date(e.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderRow}` }}>
                        <button
                          type="button"
                          title="Выписать"
                          onClick={() => handleUnenroll(e)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '.375rem',
                            border: `1px solid ${C.border}`,
                            background: 'transparent',
                            color: C.textSecondary,
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            transition: 'all .15s',
                            fontSize: 12,
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = C.error
                            ev.currentTarget.style.color = C.error
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = C.border
                            ev.currentTarget.style.color = C.textSecondary
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

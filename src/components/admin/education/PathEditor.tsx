import { useEffect, useRef, useState } from 'react'
import {
  archivePath,
  deletePath,
  enrollPathUser,
  fetchAllCourses,
  fetchPath,
  getAdminToken,
  mediaUrl,
  publishPath,
  searchUsers,
  updatePath,
  uploadPathCover,
} from './api'
import { Btn, C, Field, StatusPill, coverGradient, inputCls, inputStyle } from './ui'
import type { CourseSearchItem, PathCourseItem, PathDetail, UserSearchItem } from './types'

// Редактор программы (ТЗ-105 v2 Задача 5.3, мокап admin.html #path-editor):
// поля (название/описание/обложка), список курсов со стрелками ↑↓ и ✕
// (паттерн LessonList, НЕ dnd), комбобокс courses-search (debounce 300 мс),
// «Записать пользователя…» (users-search), publish/archive, soft-delete.
// Строка «курс снят» (removed) при сохранении выкидывается — с тостом.

export default function PathEditor({
  pathId,
  toast,
  toastError,
  onClose,
}: {
  pathId: string
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
  toastError: (msg: string) => void
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PathDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<PathCourseItem[]>([])
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const removedCount = items.filter(i => i.removed).length

  // Комбобокс «Добавить курс» (ТЗ-168): полный список живых курсов грузится
  // один раз по первому фокусу (fetchAllCourses), дальше фильтрация ЛОКАЛЬНАЯ —
  // ноль сети при вводе, список мал (критерий 5 ТЗ: один courses-search на
  // сессию редактора). Кэш живёт в стейте редактора, перечитываний нет.
  const [q, setQ] = useState('')
  const [allCourses, setAllCourses] = useState<CourseSearchItem[] | null>(null)
  const [allTotal, setAllTotal] = useState<number | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  const openCourseDrop = () => {
    setDropOpen(true)
    if (allCourses !== null) return
    fetchAllCourses()
      .then(res => {
        if (Array.isArray(res)) setAllCourses(res)
        else {
          setAllCourses(res.items)
          setAllTotal(res.total)
        }
      })
      .catch(() => setAllCourses([]))
  }

  // Уже добавленные курсы исключаем и из полного списка, и из фильтра.
  const existingIds = new Set(items.map(i => i.course_id))
  const query = q.trim().toLowerCase()
  const options = (allCourses ?? []).filter(
    c => !existingIds.has(c.id) && (!query || c.title.toLowerCase().includes(query)),
  )

  // Комбобокс «Записать пользователя…»
  const [uq, setUq] = useState('')
  const [uOptions, setUOptions] = useState<UserSearchItem[]>([])
  const [uDropOpen, setUDropOpen] = useState(false)
  const [uPicked, setUPicked] = useState<UserSearchItem | null>(null)
  const uRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ТЗ-167: тост-колбэки меняют идентичность на каждый тост (контекст
  // провайдера пересоздавался) — эффект первичной загрузки должен висеть
  // только на pathId, иначе показ/исчезновение тоста затирало форму данными
  // из БД. Системный фикс — мемоизация контекста в Toast.tsx (Задача 2 ТЗ).
  const toastErrorRef = useRef(toastError)
  toastErrorRef.current = toastError

  useEffect(() => {
    let cancelled = false
    fetchPath(pathId)
      .then(p => {
        if (cancelled) return
        setDetail(p)
        setTitle(p.title)
        setDescription(p.description || '')
        setItems(p.items)
        setCoverUrl(p.cover_url)
      })
      .catch(err => toastErrorRef.current(err?.message || 'Не удалось открыть программу'))
    return () => { cancelled = true }
  }, [pathId])

  useEffect(() => {
    const query = uq.trim()
    setUPicked(null)
    if (query.length < 2) {
      setUOptions([])
      setUDropOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        setUOptions(await searchUsers(query))
        setUDropOpen(true)
      } catch {
        setUOptions([])
        setUDropOpen(true)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [uq])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setDropOpen(false)
      if (uRef.current && !uRef.current.contains(e.target as Node)) setUDropOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const move = (idx: number, dir: -1 | 1) => {
    setItems(prev => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const addCourse = (c: CourseSearchItem) => {
    setItems(prev => [...prev, {
      course_id: c.id,
      position: prev.length + 1,
      title: c.title,
      slug: '',
      status: c.status,
      price: c.price,
      removed: false,
    }])
    setQ('')
    setDropOpen(false)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toastError('Название программы обязательно')
      return
    }
    const alive = items.filter(i => !i.removed)
    const dropped = items.length - alive.length
    setBusy(true)
    try {
      await updatePath(pathId, {
        title: title.trim(),
        description,
        course_ids: alive.map(i => i.course_id),
      })
      if (dropped > 0) {
        toast(`Курс снят с публикации — ${dropped} ${dropped === 1 ? 'позиция выкинута' : 'позиций выкинуто'} из программы`, 'info')
      }
      toast('Программа сохранена — полка на витрине обновлена (кэш инвалидирован)', 'success')
      // Перечитываем: бэк переписал position 1..N.
      const p = await fetchPath(pathId)
      setDetail(p)
      setItems(p.items)
    } catch (err: any) {
      // 400 (1 курс/дубли/несуществующие) — текстом бэкенда.
      toastError(err?.message || 'Не удалось сохранить программу')
    } finally {
      setBusy(false)
    }
  }

  const handleCover = async (file: File) => {
    setBusy(true)
    try {
      const res = await uploadPathCover(pathId, file)
      setCoverUrl(res.cover_url)
      toast('Обложка программы обновлена', 'success')
    } catch (err: any) {
      toastError(err?.message || 'Не удалось загрузить обложку')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleEnrollUser = async () => {
    if (!uPicked) {
      toastError('Найдите и выберите пользователя')
      return
    }
    setBusy(true)
    try {
      const res = await enrollPathUser(pathId, uPicked.id)
      toast(
        `${uPicked.username || uPicked.email} записан на программу (доступ выдан к ${res.granted_courses} курсам)`,
        'success',
      )
      setUPicked(null)
      setUq('')
    } catch (err: any) {
      // 404 юзер/программа, 422 blocked — текстом бэкенда.
      toastError(err?.message || 'Не удалось записать пользователя')
    } finally {
      setBusy(false)
    }
  }

  const openPreview = () => {
    if (!detail) return
    const suffix = detail.status !== 'published' ? `?preview_token=${encodeURIComponent(getAdminToken())}` : ''
    window.open(`/education/paths/${detail.slug}${suffix}`, '_blank')
  }

  const handleDelete = async () => {
    if (!detail) return
    if (!window.confirm(`Удалить программу «${detail.title}»? Она уйдёт из всех публичных выдач (восстановление возможно).`)) return
    setBusy(true)
    try {
      await deletePath(pathId)
      toast('Программа удалена', 'success')
      onClose()
    } catch (err: any) {
      toastError(err?.message || 'Не удалось удалить программу')
      setBusy(false)
    }
  }

  if (!detail) {
    return (
      <div style={{ marginTop: 24, padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
        Загружаем программу…
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24, animation: 'fadeUp .35s cubic-bezier(0.16,1,0.3,1)' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: '.75rem', overflow: 'hidden' }}>
        {/* Шапка редактора (мокап .editor-head). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10 }}>
            {detail.title}
            <StatusPill status={detail.status} />
          </div>
          <Btn sm onClick={openPreview}>Глазами ученика ↗</Btn>
          {detail.status !== 'published' && (
            <Btn
              sm
              variant="accent"
              onClick={async () => {
                try {
                  await publishPath(pathId)
                  toast('Программа опубликована — видна на витрине', 'success')
                  setDetail(await fetchPath(pathId))
                } catch (err: any) {
                  // 422 <2 живых курсов — текстом бэкенда, не «успех».
                  toastError(err?.message || 'Не удалось опубликовать')
                }
              }}
            >
              Опубликовать
            </Btn>
          )}
          {detail.status === 'published' && (
            <Btn
              sm
              onClick={async () => {
                try {
                  await archivePath(pathId)
                  toast('Программа в архиве: с витрины убрана, записанные прогресс видят', 'success')
                  setDetail(await fetchPath(pathId))
                } catch (err: any) {
                  toastError(err?.message || 'Не удалось отправить в архив')
                }
              }}
            >
              В архив
            </Btn>
          )}
          <Btn sm onClick={handleDelete}>Удалить</Btn>
          <Btn sm onClick={onClose}>Закрыть</Btn>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Обложка */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {coverUrl ? (
              <img src={mediaUrl(coverUrl)} alt="" style={{ width: 132, height: 56, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
            ) : (
              <div style={{ width: 132, height: 56, borderRadius: 8, background: coverGradient(detail.slug), border: `1px solid ${C.border}` }} />
            )}
            <div>
              <Btn sm onClick={() => fileRef.current?.click()} disabled={busy}>
                {coverUrl ? 'Сменить обложку' : 'Загрузить обложку'}
              </Btn>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                jpg/png/webp до 5 МБ — как у курсов (21:9 на полке)
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleCover(f)
              }}
            />
          </div>

          <Field label="Название программы">
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Описание">
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} style={inputStyle} />
          </Field>

          {/* Список курсов (мокап .path-item: позиция, обложка, название,
              статус, стрелки ↑↓, ✕). Порядок — рекомендация, dnd не нужен. */}
          <Field label={`Курсы в программе (${items.length}) — порядок рекомендуемый, стрелками`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.length === 0 && (
                <div style={{ fontSize: 12, color: C.textMuted }}>Курсов нет — добавьте через поиск ниже (минимум 2 для публикации).</div>
              )}
              {items.map((item, idx) => (
                <div key={item.course_id} className="path-item">
                  <span className="pi-pos">{idx + 1}</span>
                  <span className="pi-img-ph" />
                  <span className="pi-t">{item.title}</span>
                  <span className={`pi-st${item.removed ? ' removed' : ''}`}>
                    {item.removed ? 'курс снят' : item.status}
                  </span>
                  <button type="button" className="pi-move" disabled={idx === 0} onClick={() => move(idx, -1)} title="Выше">↑</button>
                  <button type="button" className="pi-move" disabled={idx === items.length - 1} onClick={() => move(idx, 1)} title="Ниже">↓</button>
                  <button
                    type="button"
                    className="pi-move"
                    title="Убрать"
                    onClick={() => setItems(prev => prev.filter(i => i.course_id !== item.course_id))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </Field>

          {/* Добавление курса + действия (мокап .students-bar). */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div ref={addRef} style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <input
                value={q}
                onChange={e => {
                  setQ(e.target.value)
                  setDropOpen(true)
                }}
                onFocus={openCourseDrop}
                onClick={openCourseDrop}
                placeholder="Добавить курс — кликните для списка или начните вводить…"
                className={inputCls}
                style={{ ...inputStyle, width: '100%' }}
              />
              {dropOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: C.bgSurface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    // ТЗ-168: скролл внутри дроплиста при >8 строк (~38px/строка).
                    maxHeight: 320,
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,.5)',
                  }}
                >
                  {allCourses === null ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted }}>Загрузка курсов…</div>
                  ) : options.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted }}>Ничего не найдено</div>
                  ) : (
                    <>
                      {options.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => addCourse(c)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#E5E7EB',
                            font: 'inherit',
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bgHover }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          {c.title}
                          <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>
                            {c.status}{c.price > 0 ? ` · ${c.price.toLocaleString('ru-RU')} ₽` : ''}
                          </span>
                        </button>
                      ))}
                      {allTotal !== null && (
                        <div style={{ padding: '8px 12px', fontSize: 11, color: C.textMuted, borderTop: `1px solid ${C.border}` }}>
                          Показаны первые 200 из {allTotal.toLocaleString('ru-RU')} — уточните запрос
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <Btn variant="accent" onClick={handleSave} disabled={busy}>Сохранить</Btn>

            {/* Записать пользователя… (users-search). */}
            <div ref={uRef} style={{ position: 'relative', minWidth: 240, flex: '1 1 240px' }}>
              <input
                value={uq}
                onChange={e => setUq(e.target.value)}
                placeholder="Записать пользователя — имя или email…"
                className={inputCls}
                style={{ ...inputStyle, width: '100%' }}
              />
              {uDropOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: C.bgSurface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    maxHeight: 220,
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,.5)',
                  }}
                >
                  {uOptions.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted }}>Никого не найдено</div>
                  ) : (
                    uOptions.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setUPicked(u)
                          setUq(u.username || u.email)
                          setUDropOpen(false)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 12px',
                          background: uPicked?.id === u.id ? C.bgHover : 'transparent',
                          border: 'none',
                          color: '#E5E7EB',
                          font: 'inherit',
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bgHover }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = uPicked?.id === u.id ? C.bgHover : 'transparent' }}
                      >
                        {u.username || u.email}
                        <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>{u.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Btn onClick={handleEnrollUser} disabled={busy || !uPicked}>Записать</Btn>
          </div>

          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
            Публикация требует ≥2 живых (не удалённых) курсов. Мягкая последовательность: порядок — рекомендация, блокировок нет.
            {removedCount > 0 && ` Снятых курсов в списке: ${removedCount} — при сохранении будут выкинуты.`}
          </div>
        </div>
      </div>
    </div>
  )
}

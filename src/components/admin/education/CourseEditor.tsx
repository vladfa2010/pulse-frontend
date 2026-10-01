import { useEffect, useState } from 'react'
import { Hint } from '@/components/admin/Hint'
import EventsPreviewPanel from './EventsPreviewPanel'
import LessonList from './LessonList'
import MaterialsEditor from './MaterialsEditor'
import NewsLinkPicker from './NewsLinkPicker'
import StudentsPanel from './StudentsPanel'
import SuggestionsPanel from './SuggestionsPanel'
import TagInput from './TagInput'
import {
  addNewsLink,
  archiveCourse,
  deleteCourse,
  fetchCategories,
  fetchCourse,
  fetchNewsLinks,
  fetchPlans,
  fetchSuggestions,
  getAdminToken,
  mediaUrl,
  publishCourse,
  removeNewsLink,
  replaceCourseTags,
  restoreCourse,
  updateCourse,
  uploadCover,
} from './api'
import {
  BadgePill,
  Btn,
  C,
  Check,
  Field,
  coverGradient,
  fromLocalInput,
  inputBlur,
  inputCls,
  inputFocus,
  inputStyle,
  toLocalInput,
} from './ui'
import type {
  Category,
  CourseBadge,
  CourseCard,
  CourseSize,
  CourseVisibility,
  LinkedNews,
  MatchSuggestion,
  PickedSource,
  Plan,
} from './types'

// Экран 2 — редактор курса (мокап admin.html: #editor + вкладки-панели).
// Вкладки: Основное / Уроки / Материалы / Новости / Записавшиеся.

const SUBTABS = [
  { key: 'main', label: 'Основное' },
  { key: 'lessons', label: 'Уроки' },
  { key: 'materials', label: 'Материалы' },
  { key: 'news', label: 'Новости' },
  { key: 'students', label: 'Записавшиеся' },
] as const

type SubTab = (typeof SUBTABS)[number]['key']

export default function CourseEditor({
  course,
  onClose,
  onUpdated,
  onReloadList,
  toast,
}: {
  course: CourseCard
  onClose: () => void
  /** Новая карточка после мутации — синк состояния редактора и таблицы. */
  onUpdated: (card: CourseCard) => void
  onReloadList: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [tab, setTab] = useState<SubTab>('main')

  // Рекомендации мэтчинга (ТЗ-103) — грузим на уровне редактора, чтобы бейдж
  // pending показывать на табе «Новости» без открытия вкладки. null — фича
  // недоступна (404: EDUCATION_MATCH_ENABLED выключен) или запрос ещё не прошёл.
  const [suggestions, setSuggestions] = useState<MatchSuggestion[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSuggestions(course.id)
      .then(list => { if (!cancelled) setSuggestions(Array.isArray(list) ? list : []) })
      // 404 (флаг выкл) и прочие ошибки — секция «Рекомендованные» не рендерится.
      .catch(() => { if (!cancelled) setSuggestions(null) })
    return () => { cancelled = true }
  }, [course.id])

  return (
    <div
      style={{
        marginTop: 24,
        animation: 'fadeUp .35s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        style={{
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderRadius: '.75rem',
          overflow: 'hidden',
        }}
      >
        {/* Шапка редактора (мокап .editor-head) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '18px 20px',
            borderBottom: `1px solid ${C.border}`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 200 }}>{course.title}</div>
          <EditorActions
            course={course}
            onUpdated={onUpdated}
            onReloadList={onReloadList}
            onClose={onClose}
            toast={toast}
          />
        </div>

        {/* Суб-вкладки (мокап .subtabs) */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '12px 20px 0',
            borderBottom: `1px solid ${C.border}`,
            flexWrap: 'wrap',
          }}
        >
          {SUBTABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                padding: '10px 14px',
                cursor: 'pointer',
                color: tab === t.key ? C.accent : C.textMuted,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t.key ? C.accent : 'transparent'}`,
                transition: 'all .2s',
              }}
            >
              {t.label}
              {t.key === 'lessons' && ` (${course.lessons.length})`}
              {t.key === 'news' && suggestions !== null && suggestions.length > 0 && ` (${suggestions.length})`}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 20px' }}>
          {tab === 'main' && (
            <MainPane
              course={course}
              onUpdated={onUpdated}
              onReloadList={onReloadList}
              toast={toast}
            />
          )}
          {tab === 'lessons' && (
            <LessonList
              course={course}
              onUpdated={onUpdated}
              toast={toast}
            />
          )}
          {tab === 'materials' && (
            <MaterialsEditor course={course} onUpdated={onUpdated} toast={toast} />
          )}
          {tab === 'news' && (
            <NewsPane
              course={course}
              toast={toast}
              suggestions={suggestions}
              onSuggestionsChange={setSuggestions}
            />
          )}
          {tab === 'students' && (
            <StudentsPanel course={course} toast={toast} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Кнопки над курсом (публикация/архив/удаление/восстановление) ───────────

function EditorActions({
  course,
  onUpdated,
  onReloadList,
  onClose,
  toast,
}: {
  course: CourseCard
  onUpdated: (card: CourseCard) => void
  onReloadList: () => void
  onClose: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<CourseCard>, successMsg: string) => {
    setBusy(true)
    try {
      const card = await fn()
      onUpdated(card)
      onReloadList()
      toast(successMsg, 'success')
    } catch (err: any) {
      // 409 «курс с активными покупками, только архив» и 422 — текстом бэкенда.
      toast(err?.message || 'Операция не удалась', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openPreview = () => {
    const suffix = course.status === 'draft' ? `?preview_token=${encodeURIComponent(getAdminToken())}` : ''
    window.open(`/education/${course.slug}${suffix}`, '_blank')
  }

  const handleDelete = async () => {
    if (!window.confirm(`Удалить курс «${course.title}»? Курс уйдёт из всех публичных выдач (восстановление возможно).`)) return
    setBusy(true)
    try {
      await deleteCourse(course.id)
      onReloadList()
      toast('Курс удалён (soft delete) — доступен восстановление', 'success')
      onClose()
    } catch (err: any) {
      // 409 «курс с активными покупками, только архив».
      toast(err?.message || 'Не удалось удалить курс', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Btn sm onClick={openPreview}>
        Глазами ученика ↗
      </Btn>
      {course.deleted_at ? (
        <Btn
          sm
          disabled={busy}
          onClick={() => run(() => restoreCourse(course.id), 'Курс восстановлен')}
        >
          Восстановить
        </Btn>
      ) : (
        <>
          {course.status === 'draft' && (
            <Btn
              sm
              variant="accent"
              disabled={busy}
              onClick={() =>
                run(() => publishCourse(course.id), 'Курс опубликован — виден на витрине')
              }
            >
              Опубликовать
            </Btn>
          )}
          {course.status === 'published' && (
            <Btn
              sm
              disabled={busy}
              onClick={() =>
                run(() => archiveCourse(course.id), 'Курс в архиве: с витрины убран, ученики доступ сохраняют')
              }
            >
              Архивировать
            </Btn>
          )}
          {course.status === 'archived' && (
            <Btn
              sm
              variant="accent"
              disabled={busy}
              onClick={() =>
                run(() => publishCourse(course.id), 'Курс снова опубликован — виден на витрине')
              }
            >
              Опубликовать
            </Btn>
          )}
          <Btn sm variant="danger" disabled={busy} onClick={handleDelete}>
            Удалить
          </Btn>
        </>
      )}
      <Btn sm onClick={onClose}>
        Закрыть
      </Btn>
    </>
  )
}

// ─── Вкладка «Основное» ─────────────────────────────────────────────────────

function MainPane({
  course,
  onUpdated,
  onReloadList,
  toast,
}: {
  course: CourseCard
  onUpdated: (card: CourseCard) => void
  onReloadList: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description || '')
  const [price, setPrice] = useState(String(course.price))
  const [author, setAuthor] = useState(course.author || 'Редакция PULSE')
  const [badges, setBadges] = useState<CourseBadge[]>(course.badges)
  const [size, setSize] = useState<CourseSize>(course.size)
  const [visibility, setVisibility] = useState<CourseVisibility>(course.visibility)
  const [categoryId, setCategoryId] = useState<string>(course.category_id || '')
  const [type, setType] = useState<'course' | 'situational'>(course.type)
  const [source, setSource] = useState<PickedSource | null>(course.source)
  const [relevantUntil, setRelevantUntil] = useState(toLocalInput(course.relevant_until))
  const [tariffIds, setTariffIds] = useState<string[]>(course.tariff_ids)
  const [unlockMode, setUnlockMode] = useState<'full' | 'drip'>(course.subscription_unlock_mode)
  const [saving, setSaving] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [cats, setCats] = useState<Category[]>([])
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    let cancelled = false
    fetchCategories().then(c => { if (!cancelled) setCats(c) }).catch(() => {})
    fetchPlans().then(p => { if (!cancelled) setPlans(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const totalMin = course.lessons.reduce((s, l) => s + (l.duration_min || 0), 0)
  const lessonsCount = course.lessons.length

  // Живая авто-подсказка по объёму (ТЗ-101 v7): не валидация, только подсказка.
  const sizeHint = (() => {
    if (lessonsCount === 0) return 'Уроков пока нет — подсказка появится после добавления уроков.'
    const likely: CourseSize =
      lessonsCount <= 3 ? 'micro' : lessonsCount >= 10 || totalMin >= 60 ? 'full' : 'standard'
    const names: Record<CourseSize, string> = { micro: 'Микро', standard: 'Стандарт', full: 'Полный' }
    return `Сейчас ${lessonsCount} ${pluralLessons(lessonsCount)}, ≈${totalMin} мин — похоже на «${names[likely]}»`
  })()

  const toggleBadge = (b: CourseBadge) => {
    setBadges(prev => {
      if (prev.includes(b)) return prev.filter(x => x !== b)
      if (prev.length >= 2) {
        toast('Максимум две метки на курс', 'error')
        return prev
      }
      return [...prev, b]
    })
  }

  const toggleTariff = (p: Plan) => {
    setTariffIds(prev => {
      if (prev.includes(p.id)) {
        // Снятие ранее сохранённой галки — предупреждение с числом subscription-слушателей.
        if (course.tariff_ids.includes(p.id) && course.subscription_enrollments_count > 0) {
          const ok = window.confirm(
            `Подписчики тарифа ${p.name}, записанные по подписке (${course.subscription_enrollments_count} чел.), потеряют доступ до продления/покупки. Снять галку?`,
          )
          if (!ok) return prev
        } else if (course.tariff_ids.includes(p.id)) {
          toast(`Подписчики тарифа ${p.name}, записанные по подписке (${course.subscription_enrollments_count} чел.), потеряют доступ до продления/покупки`)
        }
        return prev.filter(x => x !== p.id)
      }
      toast(`Курс будет включён в тариф ${p.name}`)
      return [...prev, p.id]
    })
  }

  const switchType = (next: 'course' | 'situational') => {
    if (next === type) return
    if (type === 'situational' && next === 'course') {
      // Подтверждение последствий (мокап v11).
      const ok = window.confirm(
        'Курс перестанет быть ситуационным: источник и срок актуальности будут сняты, курс уйдёт с полки «По горячим следам». Ручные привязки к новостям сохранятся.',
      )
      if (!ok) return
      setSource(null)
      setRelevantUntil('')
      toast('Тип: «Курс» — новость-источник будет снята, курс уйдёт с полки «По горячим следам» (кэш инвалидирован)')
    } else {
      toast('Тип: «Ситуационный» — укажите новость-источник, без неё курс нельзя опубликовать')
    }
    setType(next)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Укажите название курса', 'error')
      return
    }
    if (type === 'situational' && course.type !== 'situational' && !source) {
      // Дублирует серверную валидацию (400 «укажите источник»).
      toast('Укажите источник — у ситуационного курса он обязателен', 'error')
      return
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      description,
      price: Math.max(0, parseInt(price, 10) || 0),
      badges,
      size,
      visibility,
      category_id: categoryId || null,
      // Пустой автор не сохраняем — подставляем дефолт (ТЗ-101 v10).
      author: author.trim() || 'Редакция PULSE',
      relevant_until: type === 'situational' ? fromLocalInput(relevantUntil) : null,
      subscription_unlock_mode: unlockMode,
      tariff_ids: tariffIds,
      type,
    }
    if (type === 'situational' && source && source.id !== course.source_news_id) {
      body.source_type = 'news'
      body.source_id = source.id
    }
    setSaving(true)
    try {
      const card = await updateCourse(course.id, body)
      onUpdated(card)
      onReloadList()
      toast('Курс обновлён', 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось сохранить курс', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCover = async (file: File) => {
    setCoverBusy(true)
    try {
      await uploadCover(course.id, file)
      const card = await fetchCourse(course.id)
      onUpdated(card)
      onReloadList()
      toast('Обложка загружена — старая удалена (EXIF очищен)', 'success')
    } catch (err: any) {
      // 415 не jpg/png/webp, 413 > 5 МБ — текстом.
      toast(err?.message || 'Не удалось загрузить обложку', 'error')
    } finally {
      setCoverBusy(false)
    }
  }

  const freeCourse = (parseInt(price, 10) || 0) === 0
  const hasTariffs = tariffIds.length > 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Field label="Название курса">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field label="Цена, ₽ (0 = бесплатный)">
          <input
            type="number"
            value={price}
            min={0}
            onChange={e => setPrice(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field label="Описание (markdown)" full>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className={inputCls}
            style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field label="Обложка" full>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {course.cover_url ? (
              <img
                src={mediaUrl(course.cover_url)}
                alt="cover"
                style={{
                  width: 200,
                  aspectRatio: '16/9',
                  objectFit: 'cover',
                  borderRadius: '.5rem',
                  border: `1px solid ${C.border}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 200,
                  aspectRatio: '16/9',
                  borderRadius: '.5rem',
                  border: `1px solid ${C.border}`,
                  background: coverGradient(course.slug),
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 10,
                  color: C.textMuted,
                }}
              >
                generative-заглушка
              </div>
            )}
            <div>
              <label htmlFor={`cover-input-${course.id}`}>
                <span
                  style={{
                    display: 'inline-flex',
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 999,
                    background: C.bgHover,
                    border: `1px solid ${C.border}`,
                    color: C.textPrimary,
                    fontSize: 11,
                    fontWeight: 600,
                    alignItems: 'center',
                    cursor: coverBusy ? 'not-allowed' : 'pointer',
                    opacity: coverBusy ? 0.6 : 1,
                  }}
                >
                  {coverBusy ? 'Загружаем…' : 'Загрузить новую'}
                </span>
              </label>
              <input
                id={`cover-input-${course.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                disabled={coverBusy}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleCover(f)
                  e.target.value = ''
                }}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                jpg/png/webp до 5 МБ. Если обложки нет — витрина рисует generative-заглушку.
              </div>
            </div>
          </div>
        </Field>
        <Field label="Автор" hint="По умолчанию — «Редакция PULSE». Для курсов приглашённых авторов.">
          <input
            type="text"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={e => {
              inputBlur(e)
              if (!e.target.value.trim()) setAuthor('Редакция PULSE')
            }}
          />
        </Field>
        <Field
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Метки (максимум две){' '}
              <Hint text="Третья метка блокируется — на курсе не больше двух." />
            </span>
          }
          hint="Метки ставятся вручную редакцией."
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['new', 'popular', 'recommended'] as CourseBadge[]).map(b => {
              const on = badges.includes(b)
              const disabled = !on && badges.length >= 2
              return (
                <Check
                  key={b}
                  on={on}
                  disabled={disabled}
                  title={disabled ? 'максимум две метки' : undefined}
                  onClick={() => toggleBadge(b)}
                >
                  <BadgePill badge={b} />
                </Check>
              )
            })}
          </div>
        </Field>
        <Field label="Размер курса" hint={sizeHint}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['micro', 'standard', 'full'] as CourseSize[]).map(s => (
              <Check key={s} on={size === s} onClick={() => setSize(s)}>
                {s === 'micro' ? 'Микро' : s === 'standard' ? 'Стандарт' : 'Полный'}
              </Check>
            ))}
          </div>
        </Field>
        <Field
          label="Доступен по подписке"
          hint={freeCourse ? 'Бесплатный курс и так доступен всем.' : 'Подписчики выбранных тарифов получают курс без покупки.'}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', opacity: freeCourse ? 0.5 : 1 }}>
            {plans.map(p => (
              <Check
                key={p.id}
                on={tariffIds.includes(p.id)}
                disabled={freeCourse}
                title={freeCourse ? 'бесплатный курс и так доступен всем' : undefined}
                onClick={() => toggleTariff(p)}
              >
                {p.name}
              </Check>
            ))}
            {plans.length === 0 && <span style={{ fontSize: 12, color: C.textMuted }}>Тарифов нет</span>}
          </div>
        </Field>
        {/* (v16) Блок дрипа — только если курс включён хотя бы в один тариф. */}
        {hasTariffs && !freeCourse && (
          <Field label="Открытие уроков для подписчиков">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Check on={unlockMode === 'full'} onClick={() => setUnlockMode('full')}>
                Весь курс сразу
              </Check>
              <Check on={unlockMode === 'drip'} onClick={() => setUnlockMode('drip')}>
                По дням подписки (дрип)
              </Check>
            </div>
            {unlockMode === 'drip' && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                Клубный формат: уроки открываются по НАКОПЛЕННЫМ дням активной подписки («день
                открытия» задаётся у каждого урока во вкладке «Уроки»). Подписка истекла — доступ
                закрыт; возобновил — даты открытия пересчитываются от текущей. Покупателей и
                бесплатный доступ не касается.
              </div>
            )}
          </Field>
        )}
        {(!hasTariffs || freeCourse) && (
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 18 }}>
            Блок «Открытие уроков для подписчиков» скрыт — сначала включите курс хотя бы в один тариф
            (без тарифов дрип бессмысленен: доступа по подписке не возникает).
          </div>
        )}
        <Field label="Тип курса">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Check on={type === 'course'} onClick={() => switchType('course')}>
              Курс
            </Check>
            <Check on={type === 'situational'} onClick={() => switchType('situational')}>
              Ситуационный
            </Check>
          </div>
          {type === 'situational' && (
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
              Ситуационный курс требует источник (блок «Источник» ниже) — без него публикация
              заблокирована. Пока актуален — на полке «По горячим следам».
            </div>
          )}
        </Field>
        {type === 'situational' && (
          <Field
            label={<>Источник <span style={{ color: C.error }}>*</span></>}
            full
            hint="Каскады, сюжеты и темы живут дольше новости — когда разделы появятся в backend, станут источниками с длинным горизонтом (сегменты сейчас disabled — деградация по ТЗ-100 v12)."
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <Check on>Новость</Check>
              <Check off title="появится вместе с разделом «Каскады»">Каскад</Check>
              <Check off title="появится вместе с разделом «Сюжеты»">Сюжет</Check>
              <Check off title="появится вместе с разделом «Темы»">Тема</Check>
            </div>
            <NewsLinkPicker picked={source} onPick={setSource} />
            <div style={{ marginTop: 12, maxWidth: 320 }}>
              <Field label="Актуален до (для мини-курсов)" hint="Пусто — бессрочный курс.">
                <input
                  type="datetime-local"
                  value={relevantUntil}
                  onChange={e => setRelevantUntil(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </Field>
            </div>
          </Field>
        )}
        <Field
          label="Видимость курса"
          hint={
            visibility === 'hidden'
              ? 'Курс не показывается на витрине, в новостях и подборках. Доступ получают только вручную записанные слушатели — вкладка «Записавшиеся».'
              : undefined
          }
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Check
              on={visibility === 'public'}
              onClick={() => {
                setVisibility('public')
                toast('Курс снова виден на витрине')
              }}
            >
              На витрине
            </Check>
            <Check
              on={visibility === 'hidden'}
              onClick={() => {
                setVisibility('hidden')
                toast('Курс скрыт с витрины — доступ только по ручной записи')
              }}
            >
              Скрытый
            </Check>
          </div>
        </Field>
        <Field
          label="Теги (из единой базы проекта)"
          full
          hint="Ввод ИЩЕТ по единой базе тегов (как на главной странице) — свободно создать нельзя. Теги — основа мэтчинга курсов с новостями (ТЗ-103)."
        >
          <TagInput
            tags={course.tags}
            onAdd={t => handleTagAdd(course, t.id, t.label, onUpdated, toast)}
            onRemove={id => handleTagRemove(course, id, onUpdated, toast)}
          />
        </Field>
        <Field
          label="Категория (раздел витрины)"
          hint="Категория — раздел витрины (навигация для пользователя). Темы — теги для рекомендаций и привязки к новостям. Не дублируйте смысл в оба."
        >
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          >
            <option value="">Без категории</option>
            {cats.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="accent" disabled={saving} onClick={handleSave}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </Btn>
      </div>
    </div>
  )
}

async function handleTagAdd(
  course: CourseCard,
  tagId: string,
  label: string,
  onUpdated: (card: CourseCard) => void,
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void,
) {
  const next = [...course.tags.map(t => t.id), tagId]
  try {
    await replaceCourseTags(course.id, next)
    const card = await fetchCourse(course.id)
    onUpdated(card)
    toast(`Тег «${label}» добавлен (PUT /courses/:id/tags — полная замена набора)`)
  } catch (err: any) {
    toast(err?.message || 'Не удалось добавить тег', 'error')
  }
}

async function handleTagRemove(
  course: CourseCard,
  tagId: string,
  onUpdated: (card: CourseCard) => void,
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void,
) {
  const label = course.tags.find(t => t.id === tagId)?.label || tagId
  const next = course.tags.map(t => t.id).filter(id => id !== tagId)
  try {
    await replaceCourseTags(course.id, next)
    const card = await fetchCourse(course.id)
    onUpdated(card)
    toast(`Тег «${label}» убран`)
  } catch (err: any) {
    toast(err?.message || 'Не удалось убрать тег', 'error')
  }
}

// ─── Вкладка «Новости» ──────────────────────────────────────────────────────

function NewsPane({
  course,
  toast,
  suggestions,
  onSuggestionsChange,
}: {
  course: CourseCard
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
  /** null — рекомендации недоступны (флаг выкл): секцию не рендерим. */
  suggestions: MatchSuggestion[] | null
  onSuggestionsChange: (next: MatchSuggestion[] | null) => void
}) {
  const [links, setLinks] = useState<LinkedNews[]>(course.linked_news)
  const [picked, setPicked] = useState<PickedSource | null>(null)
  const [busy, setBusy] = useState(false)

  // Свежие привязки после добавления/удаления.
  const reload = async () => {
    try {
      setLinks(await fetchNewsLinks(course.id))
    } catch {
      /* молча — список обновится при следующем открытии */
    }
  }

  const attach = async () => {
    if (!picked) {
      toast('Найдите и выберите новость для привязки', 'error')
      return
    }
    setBusy(true)
    try {
      await addNewsLink(course.id, picked.id)
      setPicked(null)
      await reload()
      toast('Новость прикреплена к курсу', 'success')
    } catch (err: any) {
      // 400 «Не более 10 привязанных новостей» и 404 — текстом.
      toast(err?.message || 'Не удалось прикрепить новость', 'error')
    } finally {
      setBusy(false)
    }
  }

  const detach = async (n: LinkedNews) => {
    try {
      await removeNewsLink(course.id, n.id)
      setLinks(prev => prev.filter(x => x.id !== n.id))
      toast('Привязка к новости удалена', 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось удалить привязку', 'error')
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          background: 'rgba(245,158,11,.07)',
          border: '1px solid rgba(245,158,11,.3)',
          borderRadius: '.5rem',
          padding: '12px 14px',
          fontSize: 12,
          color: C.warning,
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        <span>⚠</span>
        <span>
          Новости хранятся 14 дней — привязка эфемерна. Если новость-источник удалена, мини-курс
          останется без контекста: такие курсы помечаются в списке.
        </span>
      </div>
      {course.visibility === 'hidden' && (
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
          Скрытый курс: привязки хранятся, но в публичной выдаче новости не показываются (ТЗ-100 v9).
        </div>
      )}

      {/* Новость-источник situational — отдельно, неудаляемая здесь. */}
      {course.source && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: '.5rem',
            background: 'rgba(0,212,255,.05)',
            border: '1px solid rgba(0,212,255,.35)',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', flex: 'none' }}>
            Источник
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{course.source.title || course.source.id}</span>
          <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>меняется во вкладке «Основное»</span>
        </div>
      )}

      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: 8,
        }}
      >
        Поиск новости для привязки
      </label>
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 560 }}>
        <NewsLinkPicker
          picked={picked}
          onPick={setPicked}
          placeholder="Начните вводить заголовок новости…"
        />
        <div style={{ marginTop: 10 }}>
          <Btn sm variant="accent" disabled={busy || !picked} onClick={attach}>
            Прикрепить
          </Btn>
        </div>
      </div>

      {/* Рекомендации мэтчинга (ТЗ-103) — над списком прикреплённых. */}
      {suggestions !== null && (
        <SuggestionsPanel
          suggestions={suggestions}
          onChange={onSuggestionsChange}
          onAttached={news =>
            setLinks(prev =>
              prev.some(x => x.id === news.id)
                ? prev
                : [
                    {
                      id: news.id,
                      slug: news.slug ?? null,
                      title_ru: news.title,
                      published_at: news.published_at,
                    },
                    ...prev,
                  ],
            )
          }
          toast={toast}
        />
      )}

      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: 8,
        }}
      >
        Прикреплённые ({links.length})
      </label>
      {links.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
          Прикреплённых новостей нет.
        </div>
      ) : (
        links.map(n => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: '.5rem',
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{n.title_ru}</span>
            <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>
              {n.published_at ? new Date(n.published_at).toLocaleDateString('ru-RU') : ''}
            </span>
            <button
              type="button"
              title="Открепить"
              onClick={() => detach(n)}
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
                flex: 'none',
                fontSize: 12,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.error
                e.currentTarget.style.color = C.error
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.color = C.textSecondary
              }}
            >
              ✕
            </button>
          </div>
        ))
      )}

      {/* Календарный мэтчинг (ТЗ-103 v2): read-only превью событий 14 дней. */}
      <EventsPreviewPanel courseId={course.id} />
    </div>
  )
}

function pluralLessons(n: number): string {
  const m = n % 10
  const h = n % 100
  return m === 1 && h !== 11 ? 'урок' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'урока' : 'уроков'
}

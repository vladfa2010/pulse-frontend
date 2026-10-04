import { useState } from 'react'
import TestEditor from './TestEditor'
import TextFormatField from './TextFormatField'
import MaterialsEditor from './MaterialsEditor'
import { createLesson, deleteLesson, deleteTest, saveTest, updateLesson } from './api'
import { Btn, C, Check, Field, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { CourseCard, Lesson, LessonButton, LessonKind } from './types'

// Форма урока (мокап .lesson-form): тип, форматированный текст (ТЗ-108), embed-URL,
// длительность, тумблер «Открытый урок», дрип-поле «Открыть на день подписки»,
// переключатель «Тест». Текст урока хранится как HTML — студенческая страница
// (LessonPage) рендерит его через dangerouslySetInnerHTML.

const KIND_LABEL: Record<LessonKind, string> = {
  text: 'Текст',
  video: 'Видео',
  video_text: 'Видео + текст',
}

/** ТЗ-124: пресеты цвета CTA-кнопок (те же классы .cta-btn.c-*, что у ученика). */
const BUTTON_COLORS: { value: LessonButton['color']; label: string; swatch: string; border?: string }[] = [
  { value: 'accent', label: 'Акцент', swatch: '#00D4FF' },
  { value: 'violet', label: 'Фиолетовый', swatch: '#A78BFA' },
  { value: 'green', label: 'Зелёный', swatch: '#34D399' },
  { value: 'ghost', label: 'Контурная', swatch: 'transparent', border: 'rgba(255,255,255,.35)' },
]

const MAX_BUTTONS = 3

const isValidButtonUrl = (url: string) =>
  /^https:\/\/.+/.test(url) || (url.startsWith('/') && !url.startsWith('//'))

export default function LessonForm({
  course,
  lesson,
  onSaved,
  onDeleted,
  onClose,
  onMaterialsChanged,
  toast,
}: {
  course: CourseCard
  lesson: Lesson | null
  onSaved: () => void
  onDeleted?: (removedProgress: number) => void
  onClose: () => void
  /** ТЗ-123: MaterialsEditor поднял обновлённую карточку (без закрытия формы). */
  onMaterialsChanged?: (card: CourseCard) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [title, setTitle] = useState(lesson?.title || '')
  const [kind, setKind] = useState<LessonKind>(lesson?.kind || 'text')
  const [embedUrl, setEmbedUrl] = useState(lesson?.video_embed_url || '')
  const [text, setText] = useState(lesson?.text_content || '')
  const [duration, setDuration] = useState(lesson?.duration_min != null ? String(lesson.duration_min) : '')
  const [free, setFree] = useState(lesson?.is_free_preview ?? false)
  const [unlockDays, setUnlockDays] = useState(String(lesson?.unlock_after_days ?? 0))
  const [showTest, setShowTest] = useState(!!lesson?.test)
  const [buttons, setButtons] = useState<LessonButton[]>(lesson?.buttons || [])
  const [buttonErrors, setButtonErrors] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const drip = course.subscription_unlock_mode === 'drip'

  const patchButton = (i: number, patch: Partial<LessonButton>) =>
    setButtons(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))

  const validateButtons = (): boolean => {
    const errors: Record<number, string> = {}
    buttons.forEach((b, i) => {
      if (!b.label.trim()) errors[i] = 'Укажите название кнопки'
      else if (!b.url.trim()) errors[i] = 'Укажите ссылку'
      else if (!isValidButtonUrl(b.url.trim())) errors[i] = 'Ссылка должна начинаться с https:// или /'
    })
    setButtonErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Укажите название урока', 'error')
      return
    }
    if (!validateButtons()) {
      toast('Проверьте кнопки урока', 'error')
      return
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      kind,
      text_content: text,
      video_embed_url: embedUrl.trim() || null,
      duration_min: duration === '' ? null : Math.max(0, parseInt(duration, 10) || 0),
      is_free_preview: free,
      unlock_after_days: Math.max(0, parseInt(unlockDays, 10) || 0),
      buttons: buttons.map(b => ({ ...b, label: b.label.trim(), url: b.url.trim() })),
    }
    setBusy(true)
    try {
      if (lesson) {
        await updateLesson(lesson.id, body)
        toast('Урок сохранён', 'success')
      } else {
        await createLesson(course.id, body)
        toast('Урок добавлен', 'success')
      }
      onSaved()
    } catch (err: any) {
      // 400 embed-домен вне белого списка — текстом бэкенда.
      toast(err?.message || 'Не удалось сохранить урок', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!lesson) return
    if (!window.confirm(`Удалить урок «${lesson.title}»?`)) return
    setBusy(true)
    try {
      const res = await deleteLesson(lesson.id)
      toast(
        res.removed_progress > 0
          ? `Урок удалён — вместе с прогрессом ${res.removed_progress} учеников (removed_progress)`
          : 'Урок удалён',
        'success',
      )
      onDeleted?.(res.removed_progress)
      onSaved()
    } catch (err: any) {
      toast(err?.message || 'Не удалось удалить урок', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: `1px dashed ${C.border}`,
        borderRadius: '.5rem',
        padding: 16,
        marginTop: 12,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Field label="Название урока">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Например: Дивидендные ловушки"
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field label="Тип">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as LessonKind)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          >
            {(Object.keys(KIND_LABEL) as LessonKind[]).map(k => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        {kind !== 'text' && (
          <Field
            label="Embed-URL видео"
            hint="Белый список: YouTube, VK Видео, Vimeo. Свой стриминг — позже."
          >
            <input
              type="url"
              value={embedUrl}
              onChange={e => setEmbedUrl(e.target.value)}
              placeholder="https://www.youtube-nocookie.com/embed/..."
              className={inputCls}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </Field>
        )}
        <Field label="Длительность, мин">
          <input
            type="number"
            value={duration}
            min={0}
            onChange={e => setDuration(e.target.value)}
            placeholder="14"
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Опции
              {free && (
                <span style={{ fontSize: 11, color: C.success, textTransform: 'none', letterSpacing: 0 }}>
                  — урок увидят все без записи и оплаты, даже у платного курса
                </span>
              )}
            </span>
          }
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Check on={free} onClick={() => setFree(!free)}>
              Открытый урок
            </Check>
            <Check on={showTest} onClick={() => setShowTest(!showTest)}>
              Тест в конце урока
            </Check>
          </div>
        </Field>
        {/* (v16) День открытия по подписке — активен только при режиме «дрип». */}
        <Field
          label="Открыть на день подписки"
          hint={
            drip
              ? '0 — открыт сразу. Типичный клубный план: уроки 1–2 — сразу, далее 30/60/90…'
              : 'Активно только при режиме «По дням подписки (дрип)» во вкладке «Основное». Значения в БД сохраняются.'
          }
        >
          <input
            type="number"
            value={unlockDays}
            min={0}
            disabled={!drip}
            onChange={e => setUnlockDays(e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, opacity: drip ? 1 : 0.5, cursor: drip ? undefined : 'not-allowed' }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        {(kind === 'text' || kind === 'video_text') && (
          <Field
            label="Текст урока"
            full
            hint="Тулбара вставляет HTML — заголовки, списки, жирный/курсив/подчёркивание, цитата, код, ссылки. Картинки — кнопкой в тулбаре (загружаются в наш storage, внешние вырезаются санитайзером). При сохранении сервер санитизирует по whitelist (ссылки — только https, картинки — только наш storage). «Предпросмотр» показывает то, что увидит ученик."
          >
            <TextFormatField value={text} onChange={setText} rows={6} minHeight={110} />
          </Field>
        )}
      </div>

      {/* ТЗ-124: CTA-кнопки урока — поле урока, работают и для несохранённого
          (в отличие от материалов ТЗ-123). Живой предпросмотр — те же классы
          .l-ctas/.cta-btn, что увидит ученик. */}
      <div style={{ marginTop: 4, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Кнопки урока
          <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>
            CTA после конспекта, перед материалами — до {MAX_BUTTONS} шт.
          </span>
        </div>
        {buttons.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr auto auto',
              gap: 10,
              alignItems: 'start',
              marginTop: 10,
            }}
          >
            <div>
              <input
                type="text"
                value={b.label}
                maxLength={30}
                onChange={e => patchButton(i, { label: e.target.value })}
                placeholder="Название"
                className={inputCls}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>
            <div>
              <input
                type="text"
                value={b.url}
                onChange={e => patchButton(i, { url: e.target.value })}
                placeholder="https://… или /…"
                className={inputCls}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
              {BUTTON_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => patchButton(i, { color: c.value })}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c.swatch,
                    border: b.color === c.value ? `2px solid ${C.accent}` : `1px solid ${c.border || c.swatch}`,
                    boxShadow: b.color === c.value ? '0 0 8px rgba(0,212,255,.35)' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => patchButton(i, { target: 'self' })}
                style={{
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: b.target === 'self' ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
                  background: b.target === 'self' ? 'rgba(0,212,255,.08)' : C.bgHover,
                  color: b.target === 'self' ? C.accent : C.textSecondary,
                }}
              >
                здесь
              </button>
              <button
                type="button"
                onClick={() => patchButton(i, { target: 'new_tab' })}
                style={{
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: b.target === 'new_tab' ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
                  background: b.target === 'new_tab' ? 'rgba(0,212,255,.08)' : C.bgHover,
                  color: b.target === 'new_tab' ? C.accent : C.textSecondary,
                }}
              >
                в новой вкладке
              </button>
              <button
                type="button"
                title="Удалить кнопку"
                onClick={() => {
                  setButtons(prev => prev.filter((_, idx) => idx !== i))
                  setButtonErrors(prev => {
                    const next: Record<number, string> = {}
                    Object.entries(prev).forEach(([k, v]) => {
                      const n = Number(k)
                      if (n < i) next[n] = v
                      else if (n > i) next[n - 1] = v
                    })
                    return next
                  })
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '.375rem',
                  border: 'none',
                  background: 'transparent',
                  color: C.error,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {buttonErrors[i] && (
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: C.error, marginTop: -4 }}>
                {buttonErrors[i]}
              </div>
            )}
          </div>
        ))}
        {buttons.length < MAX_BUTTONS && (
          <Btn sm style={{ marginTop: 12 }} onClick={() =>
            setButtons(prev => [
              ...prev,
              { label: '', url: '', color: 'accent', target: 'new_tab' as const },
            ])
          }>
            + Добавить кнопку
          </Btn>
        )}
        {buttons.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
              Так кнопки увидит ученик:
            </div>
            <div className="l-ctas">
              {buttons.map((b, i) => (
                <span key={i} className={`cta-btn c-${b.color}`} style={{ pointerEvents: 'none' }}>
                  {b.label || 'Название'}
                  {b.target === 'new_tab' && <span className="cta-ext">↗</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTest && (
        <TestEditor
          initial={lesson?.test || null}
          busy={busy}
          toast={toast}
          onSave={async data => {
            if (!lesson) {
              toast('Сначала сохраните урок — тест привязывается к уроку', 'error')
              return
            }
            setBusy(true)
            try {
              await saveTest(lesson.id, data)
              toast('Тест сохранён', 'success')
              onSaved()
            } catch (err: any) {
              toast(err?.message || 'Не удалось сохранить тест', 'error')
            } finally {
              setBusy(false)
            }
          }}
          onDelete={async () => {
            if (!lesson) return
            if (!window.confirm('Удалить тест урока?')) return
            setBusy(true)
            try {
              await deleteTest(lesson.id)
              toast('Тест удалён', 'success')
              onSaved()
            } catch (err: any) {
              toast(err?.message || 'Не удалось удалить тест', 'error')
            } finally {
              setBusy(false)
            }
          }}
          onCancel={() => setShowTest(false)}
        />
      )}

      {/* ТЗ-123: материалы урока — тот же MaterialsEditor с пропсом lessonId.
          Только для сохранённого урока: у несохраненного нет id для привязки. */}
      {lesson && (
        <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Материалы урока
          </div>
          <MaterialsEditor
            course={course}
            lessonId={lesson.id}
            onUpdated={card => onMaterialsChanged?.(card)}
            toast={toast}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <Btn variant="accent" sm disabled={busy} onClick={handleSave}>
          {busy ? 'Сохраняем…' : lesson ? 'Сохранить урок' : 'Добавить урок'}
        </Btn>
        {lesson && (
          <Btn variant="danger" sm disabled={busy} onClick={handleDelete}>
            Удалить урок
          </Btn>
        )}
        <Btn sm disabled={busy} onClick={onClose}>
          Отмена
        </Btn>
      </div>
    </div>
  )
}

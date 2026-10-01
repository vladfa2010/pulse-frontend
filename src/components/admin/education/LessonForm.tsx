import { useState } from 'react'
import TestEditor from './TestEditor'
import TextFormatField from './TextFormatField'
import { createLesson, deleteLesson, deleteTest, saveTest, updateLesson } from './api'
import { Btn, C, Check, Field, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { CourseCard, Lesson, LessonKind } from './types'

// Форма урока (мокап .lesson-form): тип, форматированный текст (ТЗ-108), embed-URL,
// длительность, тумблер «Открытый урок», дрип-поле «Открыть на день подписки»,
// переключатель «Тест». Текст урока хранится как HTML — студенческая страница
// (LessonPage) рендерит его через dangerouslySetInnerHTML.

const KIND_LABEL: Record<LessonKind, string> = {
  text: 'Текст',
  video: 'Видео',
  video_text: 'Видео + текст',
}

export default function LessonForm({
  course,
  lesson,
  onSaved,
  onDeleted,
  onClose,
  toast,
}: {
  course: CourseCard
  lesson: Lesson | null
  onSaved: () => void
  onDeleted?: (removedProgress: number) => void
  onClose: () => void
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
  const [busy, setBusy] = useState(false)

  const drip = course.subscription_unlock_mode === 'drip'

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Укажите название урока', 'error')
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
            hint="Тулбара вставляет HTML — заголовки, списки, жирный/курсив/подчёркивание, цитата, код, ссылки. При сохранении сервер санитизирует по whitelist (ссылки — только https, картинки — только наш storage). «Предпросмотр» показывает то, что увидит ученик."
          >
            <TextFormatField value={text} onChange={setText} rows={6} minHeight={110} />
          </Field>
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

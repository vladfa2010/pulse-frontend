import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { toEmbedUrl, videoHostName } from '@/lib/videoEmbed'
import TestEditor from './TestEditor'
import type { TestEditorHandle } from './TestEditor'
import MaterialsEditor from './MaterialsEditor'
// ТЗ-137: TipTap-редактор грузится lazy-чанком (~180 КБ gzip) — только админка,
// студенческие страницы его не тянут.
const RichTextField = lazy(() => import('./RichTextField'))
import { createLesson, deleteLesson, deleteTest, saveTest, updateLesson } from './api'
import { Btn, C, Check, Field, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { CourseCard, Lesson, LessonButton, LessonKind, LessonTest } from './types'

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

// ТЗ-188: превью видео в форме — одна попытка загрузки, без авто-ретраев
// (ученический сценарий ТЗ-165 длиннее: 3 попытки + оверлей ожидания).
const VIDEO_PREVIEW_TIMEOUT_MS = 15000

const isValidButtonUrl = (url: string) =>
  /^https:\/\/.+/.test(url) || (url.startsWith('/') && !url.startsWith('//'))

/** ТЗ-188: карточка недоступного видео в превью формы (по мотивам ученической
    VideoErrorCard, ТЗ-129). Превью — не валидация: сохранение не блокирует,
    серверный белый список доменов остаётся финальным фильтром. */
function VideoPreviewError({ host, originalUrl, onRetry }: { host: string; originalUrl: string; onRetry: () => void }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
        background: 'rgba(255,255,255,.02)', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>Видео с площадки {host} недоступно</div>
      <div style={{ fontSize: 12, color: C.textMuted }}>Проверьте ссылку или откройте её в новой вкладке</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Btn sm variant="ghost" onClick={onRetry}>↻ Повторить</Btn>
        <a
          href={originalUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.05em', height: 30, padding: '0 12px', borderRadius: 999,
            background: C.accent, color: '#060606', textDecoration: 'none',
          }}
        >
          Открыть оригинал
        </a>
      </div>
    </div>
  )
}

export default function LessonForm({
  course,
  lesson,
  onSaved,
  onDeleted,
  onClose,
  onMaterialsChanged,
  onTestSaved,
  onTestDeleted,
  onLessonPatched,
  toast,
}: {
  course: CourseCard
  lesson: Lesson | null
  /** ТЗ-162: при редактировании — сохранённый урок (точечный patch без refetch);
      при создании/удалении — без аргумента (список перезапросится). */
  onSaved: (saved?: Lesson) => void
  onDeleted?: (removedProgress: number) => void
  onClose: () => void
  /** ТЗ-123: MaterialsEditor поднял обновлённую карточку (без закрытия формы). */
  onMaterialsChanged?: (card: CourseCard) => void
  /** ТЗ-183: тест сохранён/удалён без закрытия формы — список точечно
      обновляет маркер «Тест» у этого урока (паттерн ТЗ-162). */
  onTestSaved?: (lessonId: string, test: LessonTest) => void
  onTestDeleted?: (lessonId: string) => void
  /** ТЗ-183: частичный успех единого «Сохранить» (урок записан, тест — нет):
      список патчим точечно, форма остаётся открытой (правки теста в полях). */
  onLessonPatched?: (saved: Lesson) => void
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
  // ТЗ-183: грязность полей теста — поднимает TestEditor через onDirty.
  const [testDirty, setTestDirty] = useState(false)
  const testEditorRef = useRef<TestEditorHandle | null>(null)

  // ТЗ-188: живое превью embed-видео под инпутом — та же конвертация, что у
  // ученика (общий toEmbedUrl), поэтому «у админа показало, у ученика нет»
  // невозможно в принципе.
  const previewUrl = useMemo(
    () => (embedUrl.trim() ? toEmbedUrl(embedUrl.trim()) : null),
    [embedUrl],
  )
  const [previewFailed, setPreviewFailed] = useState(false)
  const [previewRetryKey, setPreviewRetryKey] = useState(0)
  const previewLoadedRef = useRef(false)

  // Сброс состояния превью при смене URL или «Повторить»; нет onLoad за 15 с →
  // карточка ошибки (одна попытка, авто-ретраев нет — ТЗ-188 Задача 3).
  useEffect(() => {
    setPreviewFailed(false)
    previewLoadedRef.current = false
    if (!previewUrl) return
    const t = setTimeout(() => {
      if (!previewLoadedRef.current) setPreviewFailed(true)
    }, VIDEO_PREVIEW_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [previewUrl, previewRetryKey])

  // ТЗ-183 (Задача 3): снапшот полей на момент открытия — база dirty-guard.
  // Значения совпадают с инициализаторами useState выше.
  const [fieldsBaseline] = useState({
    title: lesson?.title || '',
    kind: lesson?.kind || 'text',
    embedUrl: lesson?.video_embed_url || '',
    text: lesson?.text_content || '',
    duration: lesson?.duration_min != null ? String(lesson.duration_min) : '',
    free: lesson?.is_free_preview ?? false,
    unlockDays: String(lesson?.unlock_after_days ?? 0),
    buttons: lesson?.buttons || [] as LessonButton[],
  })

  const dirty =
    title !== fieldsBaseline.title ||
    kind !== fieldsBaseline.kind ||
    embedUrl !== fieldsBaseline.embedUrl ||
    text !== fieldsBaseline.text ||
    duration !== fieldsBaseline.duration ||
    free !== fieldsBaseline.free ||
    unlockDays !== fieldsBaseline.unlockDays ||
    JSON.stringify(buttons) !== JSON.stringify(fieldsBaseline.buttons) ||
    testDirty

  // ТЗ-183 (Задача 3): браузерный диалог на перезагрузку/закрытие вкладки,
  // пока в форме есть несохранённые изменения. Слушатель снимается
  // автоматически при снятии dirty и при анмаунте формы.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // ТЗ-183 (Задача 3): любой выход из формы (крестик/«Отмена») с грязными
  // полями — через явный confirm.
  const handleClose = () => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return
    onClose()
  }

  // ТЗ-157: ключ идемпотентности создания — один на инстанс формы создания.
  // Ретрай/двойной клик/повторный submit шлют тот же ключ → бэк вернёт
  // уже созданный урок, а не дубль. Редактирование (lesson != null) не трогаем.
  const idemKeyRef = useRef<string | null>(null)
  if (!lesson && !idemKeyRef.current) idemKeyRef.current = crypto.randomUUID()

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
    // ТЗ-183 (Задача 2): единая кнопка «Сохранить» пишет оба контура
    // последовательно — урок, затем (если тест включён и правлен) тест.
    // Тест валидируем заранее: после updateLesson ошибка теста уже не откатит
    // урок — сообщаем частичный успех и оставляем форму открытой.
    const testResult = showTest ? testEditorRef.current?.validate() : null
    setBusy(true)
    try {
      let saved: Lesson | null = null
      let savedId = ''
      let notice = ''
      if (lesson) {
        saved = await updateLesson(lesson.id, body)
        savedId = saved.id
        notice = 'Урок сохранён'
      } else {
        const created = await createLesson(course.id, { ...body, idempotency_key: idemKeyRef.current })
        savedId = created.id
        notice = created.already_created ? 'Урок уже был добавлен (повторный запрос)' : 'Урок добавлен'
      }
      if (showTest && testDirty && testResult != null) {
        // Частичный успех: урок уже записан — тост обеими строками, форма
        // остаётся открытой (правки теста живут в полях).
        const partial = (detail: string) => {
          toast(`Урок сохранён, тест не сохранён: ${detail}`, 'error')
          if (saved) onLessonPatched?.(saved)
          else onSaved() // создание: без refetch новый урок не появится в списке
        }
        if (typeof testResult === 'string') {
          partial(testResult)
          return
        }
        try {
          await saveTest(savedId, testResult)
        } catch (err: any) {
          partial(err?.message || 'ошибка сохранения')
          return
        }
      }
      toast(notice, 'success')
      if (saved) {
        // ТЗ-162: отдаём свежий урок наружу — список обновится точечно, без refetch
        onSaved(saved)
      } else {
        // создание: структура списка изменилась → родитель перезапросит список
        onSaved()
      }
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
            hint="YouTube, VK Видео, Vimeo или Rutube — можно обычную ссылку из адресной строки."
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
        {/* ТЗ-188: живое превью — те же стили 16:9 и атрибуты iframe, что у
            ученика (LessonPage). Ключ на URL+попытку: смена ссылки или
            «Повторить» перемонтируют iframe, старый src не висит. */}
        {kind !== 'text' && previewUrl && (
          <div style={{ margin: '2px 0 12px' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
              Предпросмотр — так увидит ученик · {videoHostName(embedUrl)}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.08)' }}>
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                {previewFailed ? (
                  <VideoPreviewError
                    host={videoHostName(embedUrl)}
                    originalUrl={embedUrl.trim()}
                    onRetry={() => setPreviewRetryKey(k => k + 1)}
                  />
                ) : (
                  <iframe
                    key={`${previewUrl}#${previewRetryKey}`}
                    src={previewUrl}
                    title="Предпросмотр видео"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => { previewLoadedRef.current = true }}
                    onError={() => setPreviewFailed(true)}
                  />
                )}
              </div>
            </div>
          </div>
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
            hint="Редактор «что вижу — то и у ученика». Картинки — кнопкой, drag&drop или Ctrl+V (загружаются в наш storage). Вкладка «HTML» — полная вёрстка руками; «HTML-блок» — вставка доверенной вёрстки островком (выполняется как есть). Санитайзер сервера — финальный фильтр."
          >
            <Suspense fallback={<div style={{ minHeight: 220, display: 'grid', placeItems: 'center', color: C.textMuted, fontSize: 12 }}>Загрузка редактора…</div>}>
              <RichTextField value={text} onChange={setText} minHeight={220} />
            </Suspense>
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
          ref={testEditorRef}
          initial={lesson?.test || null}
          busy={busy}
          toast={toast}
          onDirty={setTestDirty}
          onSave={async data => {
            if (!lesson) {
              // ТЗ-183 (Задача 2): тест для нового урока создаёт единая кнопка
              // «Сохранить» (createLesson → saveTest по свежему id) — быстрое
              // сохранение теста возможно только у уже привязанного урока.
              toast('Сначала сохраните урок — тест привязывается к уроку', 'error')
              return
            }
            setBusy(true)
            try {
              await saveTest(lesson.id, data)
              toast('Тест сохранён', 'success')
              // ТЗ-183 (Задача 1): форма НЕ закрываем — список точечно обновляет
              // маркер теста, несохранённые правки урока остаются в полях.
              onTestSaved?.(lesson.id, { id: lesson.test?.id ?? crypto.randomUUID(), ...data })
              testEditorRef.current?.markSaved()
              setTestDirty(false)
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
              // ТЗ-183 (Задача 1): точечно снимаем маркер теста, форма остаётся.
              onTestDeleted?.(lesson.id)
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
          {busy ? 'Сохраняем…' : lesson ? 'Сохранить' : 'Добавить урок'}
        </Btn>
        {lesson && (
          <Btn variant="danger" sm disabled={busy} onClick={handleDelete}>
            Удалить урок
          </Btn>
        )}
        <Btn sm disabled={busy} onClick={handleClose}>
          Отмена
        </Btn>
      </div>
    </div>
  )
}

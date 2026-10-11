import { useEffect, useRef, useState } from 'react'
import GlassModal from '@/components/GlassModal'
import { previewMdImport, runMdImport } from './api'
import type { MdImportPreview } from './api'
import { Btn, C, OpenPill } from './ui'
import { KIND_LABEL } from './types'

// Модал «Импорт из MD» (ТЗ-159 v3): выбор .md-файла → сразу dry-run превью
// (парсинг и санитизация на бэке) → подтверждение создаёт уроки идемпотентно
// (ключ md-import:<sha256>:<i> — повторная загрузка того же файла не дублирует).
// Текст до первого `# ` = описание курса — при импорте заменит текущее
// (плашка-предупреждение в превью, ТЗ-159 v3 п.2).

const lessonPlural = (n: number) => {
  const m = n % 10
  const h = n % 100
  return m === 1 && h !== 11 ? 'урок' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'урока' : 'уроков'
}

export default function ImportMdModal({
  courseId,
  open,
  onClose,
  onSaved,
  toast,
}: {
  courseId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MdImportPreview | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)

  // При закрытии сбрасываем состояние — следующее открытие начисто.
  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview(null)
      setErrors(null)
      setChecking(false)
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [open])

  const handleFile = async (f: File | null) => {
    setFile(f)
    setPreview(null)
    setErrors(null)
    if (!f) return
    setChecking(true)
    try {
      setPreview(await previewMdImport(courseId, f))
    } catch (err: any) {
      // 400 parse errors — массив details; прочее — message.
      const details: string[] | undefined = err?.data?.details
      setErrors(details && details.length ? details : [err?.message || 'Не удалось разобрать файл'])
    } finally {
      setChecking(false)
    }
  }

  const handleImport = async () => {
    if (!file || importing) return
    setImporting(true)
    try {
      const res = await runMdImport(courseId, file)
      if (res.created > 0) {
        toast(`Импортировано уроков: ${res.created}`, 'success')
      } else if (res.skipped_existing > 0) {
        toast(`Все ${res.skipped_existing} ${lessonPlural(res.skipped_existing)} уже были созданы ранее (файл загружался)`, 'info')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      const details: string[] | undefined = err?.data?.details
      setErrors(details && details.length ? details : [err?.message || 'Импорт не удался'])
    } finally {
      setImporting(false)
    }
  }

  return (
    <GlassModal open={open} onClose={importing ? () => {} : onClose} title="Импорт уроков из Markdown">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.txt"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />
        <Btn sm onClick={() => fileRef.current?.click()} disabled={checking || importing}>
          Выбрать файл
        </Btn>
        <span style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'файл не выбран'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
        Каждый `# Заголовок` = урок; настройки — блоком `---`, кнопки — `:::button`, тест — `:::test`.
        Полный регламент: «Регламент-оформления-курса-в-MD.md».
      </div>

      {checking && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Проверяем файл…
        </div>
      )}

      {errors && (
        <div
          style={{
            border: `1px solid ${C.error}55`,
            background: 'rgba(239,68,68,.08)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.error, marginBottom: 6 }}>
            Файл не импортирован — исправьте ошибки:
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: C.error, lineHeight: 1.5 }}>
              · {e}
            </div>
          ))}
        </div>
      )}

      {preview && !errors && (
        <>
          {preview.course_description?.will_update && (
            <div
              style={{
                border: `1px solid ${C.warning}55`,
                background: 'rgba(245,158,11,.08)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 12,
                fontSize: 12,
                color: C.warning,
                lineHeight: 1.5,
              }}
            >
              Описание курса будет заменено из файла ({preview.course_description.chars} символов,
              сейчас — {preview.course_description.current_chars})
            </div>
          )}
          <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
            {preview.lessons.map((l, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i === preview.lessons.length - 1 ? 'none' : '1px solid #1c1c1c',
                }}
              >
                <span style={{ fontSize: 11, color: C.textMuted, width: 18, textAlign: 'center', flex: 'none' }}>
                  {l.position}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {l.title}
                </span>
                {l.is_free_preview && <OpenPill>Открыт</OpenPill>}
                {l.buttons_count > 0 && <OpenPill color={C.accent}>{l.buttons_count} кнопок</OpenPill>}
                {l.test && (
                  <OpenPill color={C.violet}>
                    тест: {l.test.questions} вопросов · порог {l.test.pass_score}%
                    {l.test.is_blocking ? ' · блокирующий' : ''}
                  </OpenPill>
                )}
                <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>
                  {KIND_LABEL[l.kind] || l.kind}
                  {l.duration_min ? ` · ${l.duration_min} мин` : ''}
                  {' · '}
                  {l.chars} зн.
                </span>
              </div>
            ))}
          </div>
          {preview.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: C.warning, lineHeight: 1.5, marginBottom: 4 }}>
              ⚠ {w}
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Btn variant="accent" sm disabled={!preview || !!errors || checking || importing} onClick={handleImport}>
          {importing ? 'Импортируем…' : `Создать ${preview ? `${preview.lessons.length} ${lessonPlural(preview.lessons.length)}` : 'уроков'}`}
        </Btn>
        <Btn sm disabled={importing} onClick={onClose}>
          Отмена
        </Btn>
      </div>
    </GlassModal>
  )
}

import { useState } from 'react'
import LessonForm from './LessonForm'
import { fetchCourse, reorderLessons, updateLesson } from './api'
import { Btn, C, IconBtn, OpenPill } from './ui'
import type { CourseCard, Lesson } from './types'

// Вкладка «Уроки»: список со стрелками ↑↓ (dnd намеренно не вводим — ТЗ-101),
// счётчик «Открыто: N из M», пресет «Равномерно: каждые N дней после первых двух».

const KIND_LABEL: Record<string, string> = {
  text: 'Текст',
  video: 'Видео',
  video_text: 'Видео + текст',
}

export default function LessonList({
  course,
  onUpdated,
  toast,
}: {
  course: CourseCard
  onUpdated: (card: CourseCard) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [presetN, setPresetN] = useState('30')
  const [busy, setBusy] = useState(false)

  const lessons = course.lessons
  const openCount = lessons.filter(l => l.is_free_preview).length
  const drip = course.subscription_unlock_mode === 'drip'

  const reloadCard = async () => {
    try {
      onUpdated(await fetchCourse(course.id))
    } catch (err: any) {
      toast(err?.message || 'Список уроков обновлён', 'success')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= lessons.length) return
    const ids = lessons.map(l => l.id)
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    setBusy(true)
    try {
      await reorderLessons(course.id, ids)
      await reloadCard()
      toast('Порядок уроков обновлён')
    } catch (err: any) {
      toast(err?.message || 'Не удалось изменить порядок', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Пресет «Равномерно: каждые N дней после первых двух» — 0, 0, N, 2N, 3N…
  // Перезаписывает ручные значения, поэтому confirm (ТЗ-101 v16).
  const applyPreset = async () => {
    const n = parseInt(presetN, 10)
    if (!Number.isInteger(n) || n < 1) {
      toast('Укажите шаг N — целое число дней ≥ 1', 'error')
      return
    }
    if (lessons.length === 0) return
    const ok = window.confirm(
      `Пресет перезапишет «день открытия» всех уроков: 0, 0, ${n}, ${2 * n}, ${3 * n}… Отмены нет. Продолжить?`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await Promise.all(
        lessons.map((l, i) =>
          updateLesson(l.id, { unlock_after_days: i < 2 ? 0 : (i - 1) * n }),
        ),
      )
      await reloadCard()
      toast(`Дни открытия проставлены: каждые ${n} дней после первых двух`, 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось применить пресет', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
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
          }}
        >
          Открыто: {openCount} из {lessons.length}
        </span>
        <span style={{ fontSize: 11, color: C.textMuted }}>
          Ориентир редакции: первые 1–3 урока открыты (рекомендация, не валидация).
        </span>
      </div>

      {/* Пресет «Равномерно» — виден при дрипе (смысл имеет только там). */}
      {drip && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <Btn sm disabled={busy} onClick={applyPreset}>
            Равномерно: каждые
          </Btn>
          <input
            type="number"
            value={presetN}
            min={1}
            onChange={e => setPresetN(e.target.value)}
            style={{
              width: 70,
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: '#fff',
              padding: '6px 10px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 12, color: C.textMuted }}>дней после первых двух</span>
        </div>
      )}

      {lessons.length === 0 && !formOpen && (
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          Уроков пока нет — без урока курс нельзя опубликовать.
        </div>
      )}

      {/* Список уроков (мокап .lesson-row). */}
      {lessons.map((l, i) => (
        <div
          key={l.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: '.5rem',
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: '#1c1c1c',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {i + 1}
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
          {l.test && <OpenPill color={C.violet}>Тест</OpenPill>}
          {(l.unlock_after_days || 0) > 0 && (
            <span
              style={{
                fontSize: 11,
                color: C.warning,
                fontWeight: 600,
                flex: 'none',
              }}
            >
              день {l.unlock_after_days}
            </span>
          )}
          <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>
            {KIND_LABEL[l.kind] || l.kind}
            {l.duration_min ? ` · ${l.duration_min} мин` : ''}
          </span>
          <IconBtn title="Урок выше" disabled={busy || i === 0} onClick={() => move(i, -1)}>
            ↑
          </IconBtn>
          <IconBtn title="Урок ниже" disabled={busy || i === lessons.length - 1} onClick={() => move(i, 1)}>
            ↓
          </IconBtn>
          <IconBtn
            title="Редактировать урок"
            onClick={() => {
              setEditing(l)
              setFormOpen(true)
            }}
          >
            ✎
          </IconBtn>
        </div>
      ))}

      {!formOpen && (
        <Btn
          sm
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          + Урок
        </Btn>
      )}

      {formOpen && (
        <LessonForm
          course={course}
          lesson={editing}
          toast={toast}
          onMaterialsChanged={onUpdated}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setFormOpen(false)
            setEditing(null)
            await reloadCard()
          }}
        />
      )}
    </div>
  )
}

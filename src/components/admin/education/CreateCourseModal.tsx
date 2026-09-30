import { useState } from 'react'
import GlassModal from '@/components/GlassModal'
import NewsLinkPicker from './NewsLinkPicker'
import TagInput from './TagInput'
import { createCourse } from './api'
import { C, Field, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { CourseTag, PickedSource } from './types'

// Модал «Новый курс» (ТЗ-101 Задача 3, эталон — мокап admin.html).
// Создание НЕ открывает редактор автоматически — редактор открывается кликом по строке.

export default function CreateCourseModal({
  open,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'course' | 'situational'>('course')
  const [price, setPrice] = useState('0')
  const [source, setSource] = useState<PickedSource | null>(null)
  const [tags, setTags] = useState<CourseTag[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setTitle('')
    setType('course')
    setPrice('0')
    setSource(null)
    setTags([])
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleCreate = async () => {
    // Валидации до отправки (критерий 11): пустое название / мини без источника.
    if (!title.trim()) {
      toast('Укажите название курса', 'error')
      return
    }
    if (type === 'situational' && !source) {
      toast('Для мини-курса нужен источник', 'error')
      return
    }
    const priceNum = Math.max(0, parseInt(price, 10) || 0)
    setSaving(true)
    try {
      await createCourse({
        title: title.trim(),
        type,
        price: priceNum,
        tag_ids: tags.map(t => t.id),
        ...(type === 'situational' && source ? { source_url: sourceUrlOf(source) } : {}),
      })
      close()
      onCreated()
      toast(
        type === 'situational'
          ? `Мини-курс привязан к новости «${source?.title}» — заполните уроки`
          : 'Черновик создан — добавьте уроки и опубликуйте',
        'success',
      )
    } catch (err: any) {
      toast(err?.message || 'Не удалось создать курс', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassModal open={open} onClose={close} title="Новый курс">
      <Field label={<>Название курса <span style={{ color: C.error }}>*</span></>}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Например: Ставка 21%: что делать с вкладом"
          className={inputCls}
          style={inputStyle}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
      </Field>
      <div className="hint" style={{ fontSize: 11, color: C.textMuted, marginTop: -12, marginBottom: 18 }}>
        Slug сгенерируется автоматически из названия.
      </div>

      <Field label="Тип курса">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TypeCard
            on={type === 'course'}
            name="Курс"
            desc="Вечнозелёный: живёт на витрине, продаётся в любое время"
            onClick={() => setType('course')}
          />
          <TypeCard
            on={type === 'situational'}
            name="Ситуационный мини-курс"
            desc="Под живой инфоповод — новость, каскад, сюжет или тему: 3–5 коротких уроков, пока повод актуален"
            onClick={() => setType('situational')}
          />
        </div>
      </Field>

      {type === 'situational' && (
        <Field
          label={<>Источник <span style={{ color: C.error }}>*</span></>}
          hint="Новости хранятся 14 дней — мини-курс должен выйти, пока тема актуальна. Каскады, сюжеты и темы живут дольше — когда появятся, станут источниками с длинным горизонтом."
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                padding: '8px 14px',
                borderRadius: 999,
                background: 'rgba(0,212,255,.08)',
                border: '1px solid rgba(0,212,255,.5)',
                fontSize: 12,
                fontWeight: 600,
                color: C.accent,
              }}
            >
              Новость
            </span>
            {(
              [
                ['cascade', 'Каскад'],
                ['storyline', 'Сюжет'],
                ['topic', 'Тема'],
              ] as const
            ).map(([kind, label]) => (
              <span
                key={kind}
                title={`появится вместе с разделом «${label === 'Каскад' ? 'Каскады' : label === 'Сюжет' ? 'Сюжеты' : 'Темы'}»`}
                style={{
                  display: 'inline-flex',
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: C.bgHover,
                  border: `1px dashed ${C.border}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textPrimary,
                  opacity: 0.4,
                  cursor: 'not-allowed',
                }}
              >
                {label}
              </span>
            ))}
          </div>
          {/* Паст здесь принимает строго /news/<slug> (ТЗ-101 v15). */}
          <NewsLinkPicker
            picked={source}
            onPick={setSource}
            strictNewsPaste
            placeholder="Поиск по всем новостям… или вставьте ссылку на статью PULSE"
          />
        </Field>
      )}

      <Field label="Цена, ₽" hint="0 — бесплатный, кнопка «Записаться».">
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

      <Field
        label="Теги (из единой базы проекта)"
        hint="Ввод ИЩЕТ по единой базе тегов (как на главной странице) — свободно создать нельзя. Теги — основа мэтчинга курсов с новостями (ТЗ-103)."
      >
        <TagInput
          tags={tags}
          onAdd={t => setTags(prev => [...prev, t])}
          onRemove={id => setTags(prev => prev.filter(t => t.id !== id))}
        />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={close}
          style={{
            height: 38,
            padding: '0 18px',
            borderRadius: 999,
            background: C.bgHover,
            color: C.textPrimary,
            border: `1px solid ${C.border}`,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          style={{
            height: 38,
            padding: '0 18px',
            borderRadius: 999,
            background: C.accent,
            color: '#060606',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Создаём…' : 'Создать черновик'}
        </button>
      </div>
    </GlassModal>
  )
}

function TypeCard({
  on,
  name,
  desc,
  onClick,
}: {
  on: boolean
  name: string
  desc: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderRadius: '.75rem',
        cursor: 'pointer',
        textAlign: 'left',
        background: on ? 'rgba(0,212,255,.07)' : C.bgHover,
        border: on ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
        boxShadow: on ? '0 0 16px rgba(0,212,255,.1)' : 'none',
        transition: 'all .2s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: on ? C.accent : C.textMuted,
            boxShadow: on ? '0 0 6px rgba(0,212,255,.6)' : 'none',
          }}
        />
        {name}
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.45 }}>{desc}</div>
    </div>
  )
}

// POST /courses принимает source_url — сервер резолвит URL → источник (v15).
// Для выбора из поиска формируем каноническую ссылку на статью.
function sourceUrlOf(src: PickedSource): string {
  return `https://pulse.inside-trade.ru/news/${src.id}`
}

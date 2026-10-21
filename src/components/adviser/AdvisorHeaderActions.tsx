import { useEffect, useState } from 'react'
import { Check, Copy, Pencil } from 'lucide-react'
import GlassModal, { GradientButton, ModalActions } from '@/components/GlassModal'
import { copyTextToClipboard } from './adviserActions'

/**
 * ТЗ-183 v6 Задачи 7–8 — иконки шапки карточки/экрана клиента:
 * заметка (карандаш, фиолетовая при наличии, модал с textarea — не prompt)
 * и копирование white-label текста (Clipboard API + fallback, зелёный фидбек
 * 1,5 с). Стиль — .icon-btn из мокапа v13. Порядок в шапке задаёт родитель:
 * бейдж → заметка → копировать → kebab.
 */

const NOTE_MAX = 2000

const iconBtnClass =
  'focusable w-8 h-8 rounded-[10px] flex items-center justify-center border border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed'

export function AdvisorNoteButton({
  initial,
  hasNote,
  onSave,
}: {
  /** текущий текст заметки (при открытии модала) */
  initial: string | null
  /** есть заметка — иконка подсвечена фиолетовым #A78BFA (.icon-btn.has-note) */
  hasNote: boolean
  onSave: (notes: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setText(initial ?? '')
      setError(null)
    }
  }, [open, initial])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(text.trim().slice(0, NOTE_MAX))
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить заметку.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        title="Заметка (видите только вы)"
        aria-label="Заметка"
        className={iconBtnClass}
        style={{
          color: hasNote ? '#A78BFA' : '#6B7280',
          borderColor: hasNote ? 'rgba(167,139,250,0.25)' : 'transparent',
          backgroundColor: hasNote ? 'rgba(167,139,250,0.08)' : 'transparent',
        }}
      >
        <Pencil size={15} />
      </button>

      <GlassModal open={open} onClose={() => setOpen(false)} title="Заметка по клиенту">
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Внутренние пометки: риск-профиль, договорённости, повод для звонка…"
          rows={6}
          autoFocus
          className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors resize-y"
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] leading-relaxed" style={{ color: '#6B7280' }}>
            Видите только вы — не попадает в «Копировать» и Telegram.
          </p>
          <span className="text-[10px] shrink-0 ml-3" style={{ color: text.length >= NOTE_MAX ? '#FBBF24' : '#6B7280' }}>
            {text.length}/{NOTE_MAX}
          </span>
        </div>
        {error && <p className="text-[12px] mt-2" style={{ color: '#EF4444' }}>{error}</p>}
        <ModalActions>
          <GradientButton onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </GradientButton>
        </ModalActions>
      </GlassModal>
    </>
  )
}

export function AdvisorCopyButton({
  disabled,
  getText,
}: {
  /** саммари-заглушка — иконка disabled (полупрозрачная, без hover) */
  disabled?: boolean
  getText: () => string
}) {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!ok) return
    const t = setTimeout(() => setOk(false), 1500)
    return () => clearTimeout(t)
  }, [ok])

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || ok) return
    if (await copyTextToClipboard(getText())) setOk(true)
  }

  return (
    <button
      onClick={copy}
      disabled={disabled}
      title={ok ? 'Скопировано ✓' : 'Скопировать обзор для клиента'}
      aria-label="Скопировать обзор"
      className={`${iconBtnClass} ${disabled ? '' : 'hover:bg-white/5 hover:border-[#222]'}`}
      style={{
        color: ok ? '#34D399' : '#6B7280',
        borderColor: ok ? 'rgba(52,211,153,0.25)' : 'transparent',
        backgroundColor: ok ? 'rgba(52,211,153,0.08)' : 'transparent',
      }}
    >
      {ok ? <Check size={15} /> : <Copy size={15} />}
    </button>
  )
}

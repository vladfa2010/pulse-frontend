import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyTextToClipboard } from './adviserActions'

/**
 * ТЗ-183 v6 Задача 8 — иконка копирования white-label текста в шапке
 * карточки/экрана клиента (Clipboard API + fallback, зелёный фидбек 1,5 с).
 * Стиль — .icon-btn из мокапа v13. Порядок в шапке задаёт родитель:
 * бейдж → заметки → копировать → kebab. (Модал одиночной заметки ТЗ-183
 * удалён — ТЗ-193 заменил его блоком заметок до 5 штук.)
 */

const iconBtnClass =
  'focusable w-8 h-8 rounded-[10px] flex items-center justify-center border border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed'

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

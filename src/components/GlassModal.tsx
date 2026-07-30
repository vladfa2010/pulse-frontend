import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface GlassModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  showClose?: boolean
}

export default function GlassModal({ open, onClose, title, children, showClose = true }: GlassModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={e => {
        if (e.target === overlayRef.current) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] p-6 relative"
        style={{ background: '#0E0E0E', border: '1px solid #222' }}
      >
        <div
          className="absolute top-0 left-6 right-6 h-px opacity-60"
          style={{ background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)' }}
        />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-semibold text-white">{title}</h3>
          {showClose && (
            <button
              onClick={onClose}
              className="text-[#6B7280] hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalField({
  label,
  children,
  hint,
  hintOk,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
  hintOk?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <div className={`text-[11px] mt-1.5 leading-relaxed ${hintOk ? 'text-[#34D399]' : 'text-[#6B7280]'}`}>
          {hint}
        </div>
      )}
    </div>
  )
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 mt-5">{children}</div>
}

export function GradientButton({
  children,
  loading,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="flex-1 h-11 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
    >
      {loading ? '⏳ Проверяем ключ…' : children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'submit' | 'button'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="h-11 px-5 rounded-xl text-[13px] font-semibold text-[#9CA3AF] border border-[#222] hover:border-[#3a3a3a] hover:text-white transition-colors"
      style={{ background: 'transparent' }}
    >
      {children}
    </button>
  )
}

export function ModalInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete = 'off',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors"
    />
  )
}

export function ModalSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors disabled:opacity-50"
    >
      {children}
    </select>
  )
}

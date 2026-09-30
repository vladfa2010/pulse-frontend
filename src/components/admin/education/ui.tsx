// Общие UI-примитивы таба «Образование» — пиксельный перенос стилей мокапа admin.html.
// Токены: фон #0E0E0E/#161616, бордеры #222222, акцент #00D4FF (ТЗ-101 v17).

import type { ReactNode } from 'react'
import type { CourseBadge, CourseSize, CourseStatus, EnrollmentSource } from './types'

export const C = {
  bgSurface: '#0E0E0E',
  bgHover: '#161616',
  border: '#222222',
  borderRow: '#1a1a1a',
  accent: '#00D4FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#34D399',
  warning: '#F59E0B',
  error: '#EF4444',
  violet: '#A78BFA',
  amber: '#FBBF24',
} as const

// ─── Кнопки (мокап .btn) ────────────────────────────────────────────────────

type BtnVariant = 'accent' | 'ghost' | 'danger'

export function Btn({
  variant = 'ghost',
  sm = false,
  disabled = false,
  onClick,
  children,
  title,
  style,
}: {
  variant?: BtnVariant
  sm?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
  children: ReactNode
  title?: string
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: sm ? 11 : 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    height: sm ? 30 : 38,
    padding: sm ? '0 12px' : '0 18px',
    borderRadius: 999,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all .2s',
    border: 'none',
    opacity: disabled ? 0.45 : 1,
    ...style,
  }
  const variantStyle: React.CSSProperties =
    variant === 'accent'
      ? { background: C.accent, color: '#060606' }
      : variant === 'danger'
        ? { background: 'transparent', color: C.error, border: '1px solid rgba(239,68,68,.35)' }
        : { background: C.bgHover, color: C.textPrimary, border: `1px solid ${C.border}` }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variantStyle }}
      onMouseEnter={e => {
        if (disabled) return
        if (variant === 'accent') e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,255,.4)'
        else if (variant === 'ghost') {
          e.currentTarget.style.borderColor = C.accent
          e.currentTarget.style.color = C.accent
        } else e.currentTarget.style.background = 'rgba(239,68,68,.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        if (variant === 'ghost' && !disabled) {
          e.currentTarget.style.borderColor = C.border
          e.currentTarget.style.color = C.textPrimary
        } else if (variant === 'danger') {
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

/** Круглая иконка-кнопка 28px (мокап .icon-btn). */
export function IconBtn({
  onClick,
  title,
  disabled = false,
  danger = false,
  children,
}: {
  onClick?: () => void
  title?: string
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: '.375rem',
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: C.textSecondary,
        cursor: disabled ? 'default' : 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'all .15s',
        flex: 'none',
        fontSize: 12,
        opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={e => {
        if (disabled) return
        e.currentTarget.style.borderColor = danger ? C.error : C.accent
        e.currentTarget.style.color = danger ? C.error : C.accent
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border
        e.currentTarget.style.color = C.textSecondary
      }}
    >
      {children}
    </button>
  )
}

// ─── Формы (мокап label/input/textarea/select/hint) ─────────────────────────

export const inputCls =
  'w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none transition-colors'
export const inputStyle: React.CSSProperties = {
  background: C.bgHover,
  border: `1px solid ${C.border}`,
}
export const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = C.accent
}
export const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = C.border
}

export function Field({
  label,
  hint,
  hintOk = false,
  full = false,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  hintOk?: boolean
  full?: boolean
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 18, gridColumn: full ? '1 / -1' : undefined }}>
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
        {label}
      </label>
      {children}
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: hintOk ? C.success : C.textMuted,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

// ─── Сегмент-чип (мокап .check) ────────────────────────────────────────────

export function Check({
  on,
  off = false, // disabled «появится вместе с разделом» — видим, но недоступен
  disabled = false,
  onClick,
  children,
  title,
}: {
  on?: boolean
  off?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  title?: string
}) {
  const unavailable = off || disabled
  return (
    <span
      title={title}
      onClick={unavailable ? undefined : onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        cursor: unavailable ? 'not-allowed' : 'pointer',
        background: on ? 'rgba(0,212,255,.08)' : C.bgHover,
        border: on
          ? '1px solid rgba(0,212,255,.5)'
          : off
            ? '1px dashed ' + C.border
            : `1px solid ${C.border}`,
        fontSize: 12,
        fontWeight: 600,
        color: on ? C.accent : C.textPrimary,
        transition: 'all .2s',
        userSelect: 'none',
        opacity: unavailable ? (off ? 0.4 : 0.35) : 1,
      }}
    >
      {children}
    </span>
  )
}

// ─── Плашки статусов/меток (мокап .status / .mbadge / .c-type / .pill-src) ──

const STATUS_META: Record<CourseStatus, { cls: string; label: string; color: string }> = {
  draft: { cls: 'draft', label: 'Черновик', color: C.textMuted },
  published: { cls: 'pub', label: 'Опубликован', color: C.success },
  archived: { cls: 'arch', label: 'Архив', color: C.warning },
}

export function StatusPill({ status }: { status: CourseStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: m.color,
        whiteSpace: 'nowrap',
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
      {m.label}
    </span>
  )
}

const BADGE_META: Record<CourseBadge, { label: string; color: string }> = {
  new: { label: 'Новый', color: C.accent },
  popular: { label: 'Популярный', color: C.amber },
  recommended: { label: 'Рекомендуем', color: C.violet },
}

export function BadgePill({ badge }: { badge: CourseBadge }) {
  const m = BADGE_META[badge]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        height: 20,
        padding: '0 8px',
        borderRadius: 999,
        background: C.bgHover,
        color: m.color,
        border: `1px solid ${m.color}66`,
        marginRight: 4,
        whiteSpace: 'nowrap',
      }}
    >
      <i style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
      {m.label}
    </span>
  )
}

/** Ярлык размера / типа / категории в заголовке строки таблицы (мокап .c-type). */
export function TypePill({
  children,
  color = C.accent,
  border,
  dim = false,
}: {
  children: ReactNode
  color?: string
  border?: string
  dim?: boolean
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color,
        border: `1px solid ${border || color + '59'}`,
        borderRadius: 999,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {dim ? <span style={{ textTransform: 'none', letterSpacing: '.02em', fontWeight: 600 }}>{children}</span> : children}
    </span>
  )
}

export function OpenPill({ children = 'Открыт', color = C.success }: { children?: ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color,
        border: `1px solid ${color}66`,
        padding: '2px 8px',
        borderRadius: 999,
        flex: 'none',
      }}
    >
      {children}
    </span>
  )
}

const SRC_META: Record<EnrollmentSource, { label: string; color: string }> = {
  free: { label: 'Бесплатный', color: C.success },
  purchase: { label: 'Покупка', color: C.amber },
  subscription: { label: 'Подписка', color: C.violet },
  admin_grant: { label: 'Админ', color: C.success },
}

export function SourcePill({ source }: { source: EnrollmentSource }) {
  const m = SRC_META[source] || { label: source, color: C.textMuted }
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        padding: '3px 9px',
        borderRadius: 999,
        color: m.color,
        border: `1px solid ${m.color}66`,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  )
}

// ─── Прочее ─────────────────────────────────────────────────────────────────

/** Детерминированный generative-градиент обложки от slug (ТЗ-100, ТЗ-101 v2). */
export function coverGradient(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 80)) % 360
  return `linear-gradient(135deg, hsl(${hue1} 55% 14%), hsl(${hue2} 45% 22%))`
}

export function SizeLabel({ size }: { size: CourseSize }) {
  if (size === 'micro') return <TypePill color={C.violet}>Микро</TypePill>
  if (size === 'full') return <TypePill color={C.accent}>Полный</TypePill>
  return null // standard — без плашки (мокап)
}

/** Формат даты ДД.ММ.ГГГГ для таблиц. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

/** ISO/«YYYY-MM-DD HH:mm:ss» → значение input[type=datetime-local]. */
export function toLocalInput(v: string | null | undefined): string {
  if (!v) return ''
  return v.replace(' ', 'T').slice(0, 16)
}

export function fromLocalInput(v: string): string | null {
  return v ? v.replace('T', ' ') : null
}

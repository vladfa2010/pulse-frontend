// ПРАВКА-1 к ТЗ-191: лента недель вместо стрелочного переключателя.
// Норматив вёрстки — сделанные тз/мокап-weekly-report/index.html (.week-strip):
// текущая неделя закрашена акцентным градиентом с пульсирующей точкой
// (.live-dot, @keyframes livePulse в index.css), архив — ghost-пилюли,
// активная (открытый отчёт) — с accent-бордером; последняя пилюля —
// дроплист архива (≤12 недель из GET /weekly). Стрелки ChevronLeft/Right
// исключены — больше нигде не используются.
import { useNavigate } from 'react-router'
import { ChevronDown } from 'lucide-react'

export interface WeekStripItem {
  key: string
  label: string
  to: string
  live?: boolean
}

interface WeekStripProps {
  items: WeekStripItem[]
  currentKey: string
  /** Диапазон текущей недели («20 — 26 октября 2026») — для закрашенной пилюли */
  liveRange?: string
  /** Сколько дней текущей недели прошло (для «идёт, N из 7 дней») */
  liveDays?: number | null
}

export default function WeekStrip({ items, currentKey, liveRange, liveDays }: WeekStripProps) {
  const navigate = useNavigate()
  if (items.length === 0) return null // magic-link гость: переключать нечего

  const chip =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-4 py-2 text-[13px] font-medium transition-all duration-200 shrink-0'
  const pastChip = `${chip} bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-text-secondary hover:border-[var(--border-active)] hover:text-text-primary`

  return (
    <div data-testid="week-strip" className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
      {items.map((it) =>
        it.live ? (
          <button
            key={it.key}
            data-testid="week-chip-current"
            onClick={() => navigate(it.to)}
            className={chip}
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
              color: '#060606',
              fontWeight: 600,
              border: 'none',
              boxShadow: '0 0 20px rgba(0,212,255,0.25)',
            }}
          >
            <span
              data-testid="live-dot"
              className="live-dot w-2 h-2 rounded-full"
              style={{ background: '#060606' }}
            />
            Текущая неделя{liveRange ? ` · ${liveRange}` : ''}
            {liveDays != null && (
              <span className="font-normal text-[12px] opacity-85">· идёт, {liveDays} из 7 дней</span>
            )}
          </button>
        ) : (
          <button
            key={it.key}
            data-testid={`week-chip-${it.key}`}
            data-active={it.key === currentKey}
            onClick={() => navigate(it.to)}
            className={pastChip}
            style={
              it.key === currentKey
                ? { borderColor: 'var(--border-active)', color: 'var(--text-primary)', fontWeight: 600 }
                : undefined
            }
          >
            {it.label}
          </button>
        ),
      )}
      {items.length > 1 && (
        <span className="relative shrink-0">
          <select
            aria-label="Архив недель"
            data-testid="week-archive-select"
            value={currentKey}
            onChange={(e) => {
              const item = items.find((it) => it.key === e.target.value)
              if (item) navigate(item.to)
            }}
            className={`${pastChip} appearance-none pr-8 cursor-pointer outline-none`}
          >
            <option value="" disabled>
              Архив недель…
            </option>
            {items.map((it) => (
              <option key={it.key} value={it.key}>
                {it.live ? 'Текущая неделя · идёт' : it.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary"
          />
        </span>
      )}
    </div>
  )
}

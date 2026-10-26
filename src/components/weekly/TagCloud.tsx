/**
 * =============================================================================
 * PULSE — Облако тегов недельного отчёта (ТЗ-195)
 * =============================================================================
 *
 * Навигация по длинной странице отчёта: все теги недели пилюлями сразу после
 * ленты недель, размер пилюли пропорционален числу новостей (11–17px по
 * максимуму отчёта). Клик — плавный скролл к секции разбора тега (якорь —
 * tagId на <section> секции, см. WeeklyReportPage).
 *
 * Данные — те же агрегаты, что у гистограммы (stats.perTag payload отчёта),
 * новых запросов компонент не делает. Пилюля тега без секции (нет новостей)
 * приглушена и не кликабельна. stats null / perTag пуст → карточка скрыта.
 *
 * Мокап-норматив: сделанные тз/мокап-weekly-report/index.html (.tag-cloud).
 */

import type { WeeklyStatsTagRow } from '@/lib/reportsApi'

interface TagCloudProps {
  /** Агрегаты недели из payload отчёта (content.stats.perTag) */
  perTag: WeeklyStatsTagRow[]
  /** tagId, у которых на странице есть секция разбора (кликабельны) */
  sectionTagIds: ReadonlySet<string>
  /** Цвет типа тега — тот же резолвер, что у гистограммы и секций страницы */
  colorOf: (tagId: string) => string
}

export default function TagCloud({ perTag, sectionTagIds, colorOf }: TagCloudProps) {
  if (perTag.length === 0) return null
  const maxCurrent = Math.max(...perTag.map((t) => t.current))

  const scrollTo = (tagId: string) => {
    document.getElementById(tagId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      data-testid="tag-cloud"
      className="rounded-2xl mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '14px 16px' }}
    >
      <div
        style={{
          flexBasis: '100%', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6,
        }}
      >
        Теги недели · нажмите на тег, чтобы перейти к разбору
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {perTag.map((row) => {
          // Размер пилюли = значимость: 11–17px по максимуму недели (ТЗ-195)
          const fs = (11 + (row.current / maxCurrent) * 6).toFixed(1)
          const color = colorOf(row.tagId)
          const style: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backgroundColor: 'var(--bg-hover)', border: `1px solid ${color}40`,
            borderRadius: 999, padding: '3px 12px 3px 9px',
            color: 'var(--text-primary)', fontWeight: 500, fontSize: `${fs}px`,
            transition: 'all .2s',
          }
          const dot = <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          const count = <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 11 }}>{row.current}</span>

          if (!sectionTagIds.has(row.tagId)) {
            // Секции нет (нет новостей за окно) — приглушённая, без hover и клика
            return (
              <span key={row.tagId} data-testid={`tag-cloud-chip-${row.tagId}`} style={{ ...style, opacity: 0.45, cursor: 'default' }}>
                {dot}{row.tagName}{count}
              </span>
            )
          }
          return (
            <button
              key={row.tagId}
              type="button"
              data-testid={`tag-cloud-chip-${row.tagId}`}
              style={{ ...style, cursor: 'pointer' }}
              onClick={() => scrollTo(row.tagId)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)'
                e.currentTarget.style.boxShadow = '0 0 14px rgba(0,212,255,0.15)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${color}40`
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              {dot}{row.tagName}{count}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { fetchEventsPreview } from './api'
import { C, TypePill, fmtDate } from './ui'
import type { EventsPreviewResponse, MatchedCalendarEvent } from './types'

// Read-only превью календарного мэтчинга курса (ТЗ-103 v2, Задача 8) — редактор
// проверяет ДО публикации, к каким событиям ближайших 14 дней привяжется курс.
// Связи не персистятся: события календаря пересобираются конвейером (id у них
// нестабильны), мэтчинг чисто по общим тегам, ручной привязки нет.
// Фичефлаг выключен (404) — секцию не рендерим.

// Цвета kind по DESIGN_SYSTEM (ТЗ-103): Дивиденды — amber, СД/СА — violet,
// отчётность (МСФО/РСБУ) — cyan.
const KIND_COLOR: Record<string, string> = {
  Дивиденды: C.amber,
  СД: C.violet,
  СА: C.violet,
  МСФО: C.accent,
  РСБУ: C.accent,
}

function kindColor(kind: string): string {
  return KIND_COLOR[kind] || C.textMuted
}

export default function EventsPreviewPanel({ courseId }: { courseId: string }) {
  const [data, setData] = useState<EventsPreviewResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchEventsPreview(courseId)
      .then(res => { if (!cancelled) setData(res) })
      // 404 (флаг выкл) и прочие ошибки — секции просто нет.
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [courseId])

  if (!data) return null

  return (
    <div style={{ marginTop: 24 }}>
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
        События календаря (14 дней)
      </label>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
        Связи с событиями вычисляются автоматически по тегам — ручной привязки нет, события
        календаря эфемерны.
      </div>
      {data.warning === 'no_tags' && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            background: 'rgba(245,158,11,.07)',
            border: '1px solid rgba(245,158,11,.3)',
            borderRadius: '.5rem',
            padding: '12px 14px',
            fontSize: 12,
            color: C.warning,
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          <span>⚠</span>
          <span>Добавьте теги курсу, чтобы он мэтчился к событиям.</span>
        </div>
      )}
      {(data.events || []).length === 0 ? (
        data.warning === 'no_tags' ? null : (
          <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
            Совпадений с событиями календаря на 14 дней нет.
          </div>
        )
      ) : (
        (data.events as MatchedCalendarEvent[]).map((ev, i) => (
          <div
            key={`${ev.date}:${ev.kind}:${ev.ticker || ev.company || ''}:${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: '.5rem',
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              marginBottom: 6,
              fontSize: 13,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 11, color: C.textMuted, flex: 'none', minWidth: 74 }}>
              {fmtDate(ev.date)}
            </span>
            <TypePill color={kindColor(ev.kind)}>{ev.kind}</TypePill>
            <span style={{ flex: 1, minWidth: 120 }}>
              {ev.company || ev.title}
              {ev.status === 'expected' && (
                <span style={{ fontSize: 11, color: C.warning }}> · ожидается</span>
              )}
            </span>
            {ev.ticker && (
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
                {ev.ticker}
              </span>
            )}
            {(ev.matched_tags || []).length > 0 && (
              <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                {ev.matched_tags.map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10,
                      padding: '1px 7px',
                      borderRadius: 999,
                      background: 'rgba(0,212,255,.07)',
                      border: '1px solid rgba(0,212,255,.25)',
                      color: C.accent,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  )
}

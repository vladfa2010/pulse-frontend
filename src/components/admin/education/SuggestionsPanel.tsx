import { useState } from 'react'
import { attachSuggestion, dismissSuggestion } from './api'
import { Btn, C, TypePill, fmtDate } from './ui'
import type { MatchSource, MatchSuggestion } from './types'

// Секция «Рекомендованные (N)» в редакторе курса (ТЗ-103, Задача 5) — подсказки
// мэтчинга «новость ↔ курс» (теги + эмбеддинги + LLM). Система только
// РЕКОМЕНДУЕТ: решение принимает редактор кнопками «Прикрепить» / «✗» —
// без подтверждений, действия обратимы (dismiss не мешает повторному показу
// пары другим механизмом, attach — снимается откреплением в списке ниже).
// Фичефлаг выключен (404 на /suggestions) — секцию не рендерим вообще.

const SOURCE_META: Record<MatchSource, { label: string; color: string }> = {
  tag: { label: 'тег', color: C.accent },
  embedding: { label: 'эмбеддинг', color: C.violet },
  both: { label: 'тег+эмбеддинг', color: C.success },
}

export default function SuggestionsPanel({
  suggestions,
  onChange,
  onAttached,
  toast,
}: {
  suggestions: MatchSuggestion[]
  /** Синк списка наверх (счётчик на табе «Новости») после attach/dismiss. */
  onChange: (next: MatchSuggestion[]) => void
  /** После attach — новость появляется в списке прикреплённых ниже без перезагрузки. */
  onAttached?: (news: MatchSuggestion['news']) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  // N = 0 — секция скрыта (свернута), чтобы не шуметь пустым блоком.
  if (suggestions.length === 0) return null

  const handleAttach = async (s: MatchSuggestion) => {
    setBusyId(s.id)
    try {
      await attachSuggestion(s.id)
      onChange(suggestions.filter(x => x.id !== s.id))
      onAttached?.(s.news)
      toast('Новость прикреплена к курсу', 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось прикрепить', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleDismiss = async (s: MatchSuggestion) => {
    setBusyId(s.id)
    try {
      await dismissSuggestion(s.id)
      onChange(suggestions.filter(x => x.id !== s.id))
      toast('Рекомендация отклонена')
    } catch (err: any) {
      toast(err?.message || 'Не удалось отклонить', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
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
        Рекомендованные ({suggestions.length})
      </label>
      <div
        style={{
          fontSize: 11,
          color: C.textMuted,
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        Подсказки автоматического мэтчинга (теги + эмбеддинги). Прикрепление — только по вашему
        решению; автоприкрепления нет.
      </div>
      {suggestions.map(s => {
        const src = SOURCE_META[s.source] || { label: s.source, color: C.textMuted }
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: '.5rem',
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              marginBottom: 8,
              fontSize: 13,
              opacity: busyId === s.id ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {s.news.slug ? (
                  <a
                    href={`/news/${s.news.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: C.textPrimary, textDecoration: 'none', minWidth: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.textPrimary)}
                  >
                    {s.news.title}
                  </a>
                ) : (
                  <span style={{ minWidth: 0 }}>{s.news.title}</span>
                )}
                <TypePill color={src.color}>{src.label}</TypePill>
                <span
                  title={s.score === null ? 'LLM не оценивал (дневной лимит) — показана только пара с общим тегом' : undefined}
                  style={{ fontSize: 11, color: s.score === null ? C.textMuted : C.textPrimary, flex: 'none' }}
                >
                  {s.score === null ? '—' : `${Math.round(s.score * 100)}%`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  {fmtDate(s.news.published_at)}
                  {s.news.source ? ` · ${s.news.source}` : ''}
                </span>
                {s.score === null && (
                  <span style={{ fontSize: 11, color: C.warning }}>без LLM-оценки</span>
                )}
              </div>
              {s.reason && (
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>
                  {s.reason}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 'none', alignItems: 'center' }}>
              <Btn sm variant="accent" disabled={busyId === s.id} onClick={() => handleAttach(s)}>
                Прикрепить
              </Btn>
              <button
                type="button"
                title="Отклонить рекомендацию"
                disabled={busyId === s.id}
                onClick={() => handleDismiss(s)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '.375rem',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textSecondary,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'all .15s',
                  flex: 'none',
                  fontSize: 12,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = C.error
                  e.currentTarget.style.color = C.error
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = C.border
                  e.currentTarget.style.color = C.textSecondary
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

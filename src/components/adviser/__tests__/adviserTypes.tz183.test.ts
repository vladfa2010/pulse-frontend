// ТЗ-183 v6 — парсеры и чистые хелперы модуля advisor:
// parseTasksResponse / parseNotifyPrefs / parseTelegramStatus (защитные к форме
// ответа), buildCopyText (white-label, без бренда/заметок/служебных строк),
// reminderPresetIso (09:00 мск от due_date, 'before' = за день), isStubSummary
// (disabled «Копировать»), needsAttention (neg ≥ 60), форматтеры дат.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  buildCopyText,
  formatFullDate,
  formatMskDateTime,
  formatTaskDate,
  isStubSummary,
  needsAttention,
  parseNotifyPrefs,
  parseTasksResponse,
  parseTelegramStatus,
  reminderPresetIso,
  taskTitleFromEvent,
  type AdvisorSummaryEntry,
} from '@/components/adviser/adviserTypes'

describe('parseTasksResponse (ТЗ-183 Задача 6)', () => {
  it('парсит { tasks: [...] } с полями задачи', () => {
    const tasks = parseTasksResponse({
      tasks: [
        {
          id: 7,
          title: 'Позвонить до 24.10 — Совет директоров Сбербанк',
          due_date: '2026-10-24',
          is_done: false,
          source_event_id: 'evt-1',
          remind_at: '2026-10-24T06:00:00.000Z',
          remind_channels: ['telegram', 'email'],
          created_at: '2026-10-21T10:00:00.000Z',
          client_id: 3,
          client_name: 'Иван Петров',
        },
      ],
    })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      id: 7,
      due_date: '2026-10-24',
      is_done: false,
      source_event_id: 'evt-1',
      remind_at: '2026-10-24T06:00:00.000Z',
      remind_channels: ['telegram', 'email'],
      client_id: 3,
      client_name: 'Иван Петров',
    })
  })

  it('терпим к голому массиву, null-полям и лишним каналам', () => {
    const tasks = parseTasksResponse([
      { id: 1, title: 'Задача без дедлайна' },
      { id: 0, title: 'без id — отброшена' },
      { id: 2, title: 'x', remind_channels: ['push', 'email'] },
      null,
    ])
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ id: 1, due_date: null, remind_at: null, remind_channels: [] })
    expect(tasks[1].remind_channels).toEqual(['email'])
  })
})

describe('parseNotifyPrefs (ТЗ-183 Задача 1)', () => {
  it('дефолты ON при пустом/битом ответе', () => {
    expect(parseNotifyPrefs(null)).toEqual({
      advisor_digest: true,
      advisor_news: true,
      advisor_alert_neg: true,
      advisor_alert_pos: true,
      advisor_weekly: true,
    })
  })

  it('терпим к { prefs }, { notify_prefs } и голым флагам', () => {
    expect(parseNotifyPrefs({ prefs: { advisor_news: false } }).advisor_news).toBe(false)
    expect(parseNotifyPrefs({ notify_prefs: { advisor_weekly: false } }).advisor_weekly).toBe(false)
    expect(parseNotifyPrefs({ advisor_digest: 0 }).advisor_digest).toBe(false)
    // остальные ключи — дефолт ON
    expect(parseNotifyPrefs({ prefs: { advisor_news: false } }).advisor_digest).toBe(true)
  })
})

describe('parseTelegramStatus (ТЗ-183 Задача 2)', () => {
  it('linked true/false', () => {
    expect(parseTelegramStatus({ linked: true })).toBe(true)
    expect(parseTelegramStatus({ linked: 1 })).toBe(true)
    expect(parseTelegramStatus({ linked: false })).toBe(false)
    expect(parseTelegramStatus(null)).toBe(false)
  })
})

function summary(overrides: Partial<AdvisorSummaryEntry> = {}): AdvisorSummaryEntry {
  return {
    client_id: 1,
    summary: 'Сводка по клиенту.',
    articles_count: 10,
    sentiment_mix: { pos: 20, neg: 10, neu: 70 },
    tags_snapshot: null,
    generated_at: '2026-10-20T20:00:00.000Z',
    ...overrides,
  }
}

describe('isStubSummary / needsAttention (ТЗ-183 Задачи 5, 8)', () => {
  it('заглушка: null, пустой текст или 0 статей', () => {
    expect(isStubSummary(null)).toBe(true)
    expect(isStubSummary(summary({ summary: null }))).toBe(true)
    expect(isStubSummary(summary({ articles_count: 0 }))).toBe(true)
    expect(isStubSummary(summary())).toBe(false)
  })

  it('требует внимания при neg ≥ 60, иначе нет', () => {
    expect(needsAttention(summary({ sentiment_mix: { pos: 10, neg: 60, neu: 30 } }))).toBe(true)
    expect(needsAttention(summary({ sentiment_mix: { pos: 10, neg: 59, neu: 31 } }))).toBe(false)
    expect(needsAttention(summary({ sentiment_mix: null }))).toBe(false)
  })
})

describe('buildCopyText (ТЗ-183 Задача 8, white-label)', () => {
  it('полный формат: имя — обзор на дату, саммари, Теги, Ближайшие события', () => {
    const text = buildCopyText({
      name: 'Иван Петров',
      dateLabel: '20.10.2026',
      summary: 'Рынок растёт.',
      tags: ['Лукойл', 'ОФЗ', 'ВТБ'],
      events: [
        { date: '2026-10-24', title: 'Совет директоров Сбербанк' },
        { date: '2026-11-02', title: 'Дивиденды Лукойл' },
      ],
    })
    expect(text).toBe(
      'Иван Петров — обзор на 20.10.2026\n\nРынок растёт.\n\nТеги: Лукойл, ОФЗ, ВТБ\n\nБлижайшие события: 24.10 Совет директоров Сбербанк; 02.11 Дивиденды Лукойл',
    )
    expect(text).not.toContain('PULSE')
    expect(text).not.toContain('Заметка')
  })

  it('пустые теги/события — строки опускаются', () => {
    const text = buildCopyText({ name: 'Анна', dateLabel: '21.10.2026', summary: 'Тихо.', tags: [], events: [] })
    expect(text).toBe('Анна — обзор на 21.10.2026\n\nТихо.')
  })
})

describe('reminderPresetIso (ТЗ-183 v6: 09:00 мск от due_date)', () => {
  it('«в день дедлайна» = 06:00 UTC', () => {
    expect(reminderPresetIso('2026-10-24', 'day')).toBe('2026-10-24T06:00:00.000Z')
  })

  it('«за день до дедлайна» = день минус один, 06:00 UTC', () => {
    expect(reminderPresetIso('2026-10-24', 'before')).toBe('2026-10-23T06:00:00.000Z')
  })

  it('без дедлайна или битой даты — null', () => {
    expect(reminderPresetIso(null, 'day')).toBeNull()
    expect(reminderPresetIso('скоро', 'day')).toBeNull()
  })
})

describe('форматтеры и taskTitleFromEvent', () => {
  it('formatTaskDate / formatFullDate', () => {
    expect(formatTaskDate('2026-10-24')).toBe('24.10.2026')
    expect(formatTaskDate(null)).toBeNull()
    expect(formatFullDate('2026-10-20T06:00:00.000Z')).toBe('20.10.2026')
    expect(formatFullDate(undefined)).toBe('')
  })

  it('formatMskDateTime — московская тайзона', () => {
    // 2026-10-24T06:00:00Z = 09:00 мск
    expect(formatMskDateTime('2026-10-24T06:00:00.000Z')).toBe('24.10.2026, 09:00 (мск)')
    expect(formatMskDateTime('битая')).toBeNull()
  })

  it('taskTitleFromEvent — «Позвонить до ДД.ММ — событие»', () => {
    expect(
      taskTitleFromEvent({ id: 'e1', date: '2026-10-24', title: 'Совет директоров Сбербанк', tag_name: null }),
    ).toBe('Позвонить до 24.10 — Совет директоров Сбербанк')
  })
})

/**
 * ТЗ-43, задача 2 — unit-тесты адаптеров радио.
 * Кейсы из критериев приёмки: типовая новость, macro (score всегда 0),
 * пустой tag_impact (LLM-фолбэк пайплайна), новость без тегов юзера,
 * перепечатка. Плюс календарь и tagMap.
 */
import { describe, it, expect } from 'vitest'
import type { NewsArticle } from '@/types/news'
import type { CalendarResponse } from '@/types/calendar'
import { buildTagMap, tagName } from '@/lib/radio/tagMap'
import { adaptPulseToNewsItem, buildImpactLines } from '@/lib/radio/newsAdapter'
import { adaptCalendarToday, extractTime } from '@/lib/radio/calendarAdapter'
import { buildReflectReasoning, REFLECT_DEFAULT } from '@/lib/radio/buildReflectReasoning'

const TAG_MAP = buildTagMap([
  { tag_id: 't-1', tag_name: 'нефть' },
  { tag_id: 't-2', tag_name: 'газ' },
  { tag_id: 't-3', tag_name: 'рубль' },
])
const USER_TAGS = new Set(['t-1', 't-3'])

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'n1',
    slug: 'n1',
    title_ru: 'ОПЕК+ сократила добычу',
    title_original: null,
    summary_ru: 'Сокращение добычи на 1 млн баррелей',
    summary_original: null,
    source: 'Интерфакс',
    url: 'https://example.com/1',
    published_at: '2026-09-21T08:00:00Z',
    sentiment: 'positive',
    sentiment_score: 6,
    matched_tags: ['t-1', 't-2'],
    tag_impact: [
      { tag: 't-1', score: 7, reasoning: 'Маржа производителей вырастет примерно на 8 долларов с барреля' },
      { tag: 't-2', score: -3, reasoning: 'Газ слабо коррелирует с решением ОПЕК' },
    ],
    source_count: 1,
    all_sources: ['Интерфакс'],
    ...overrides,
  }
}

describe('adaptPulseToNewsItem — типовая новость', () => {
  it('score = max |tag_impact.score| по тегам юзера (7 из t-1, а не 3 из t-2)', () => {
    const item = adaptPulseToNewsItem(makeArticle(), USER_TAGS, TAG_MAP)
    expect(item.score).toBe(7)
  })

  it('имена тегов через tagMap', () => {
    const item = adaptPulseToNewsItem(makeArticle(), USER_TAGS, TAG_MAP)
    expect(item.tags).toEqual(['нефть', 'газ'])
  })

  it('перепечатка: source_count > 1', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({ source_count: 3, all_sources: ['Интерфакс', 'РБК', 'Ведомости'] }),
      USER_TAGS,
      TAG_MAP
    )
    expect(item.reprint).toBe(true)
    expect(item.sources).toEqual(['Интерфакс', 'РБК', 'Ведомости'])
  })

  it('не перепечатка: source_count отсутствует → 1', () => {
    const item = adaptPulseToNewsItem(makeArticle({ source_count: undefined }), USER_TAGS, TAG_MAP)
    expect(item.reprint).toBe(false)
  })
})

describe('adaptPulseToNewsItem — новость без тегов юзера', () => {
  it('score = |sentiment_score|, когда нет импактов по тегам юзера', () => {
    const item = adaptPulseToNewsItem(makeArticle(), new Set(['t-x']), TAG_MAP)
    expect(item.score).toBe(6)
  })

  it('импакты по чужим тегам в score не участвуют (max по юзеру пуст → sentiment)', () => {
    const item = adaptPulseToNewsItem(makeArticle(), new Set(['t-x']), TAG_MAP)
    expect(item.score).toBe(6) // не 7 и не 3
  })
})

describe('adaptPulseToNewsItem — macro и LLM-фолбэк (score всегда 0)', () => {
  it('macro: tag_impact есть, score=0 → 0 (не подменяем sentiment)', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({
        sentiment_score: 9, // keyword-оценка macro — брать её нельзя
        tag_impact: [{ tag: 't-1', score: 0, reasoning: '' }],
      }),
      USER_TAGS,
      TAG_MAP
    )
    expect(item.score).toBe(0)
  })

  it('пустой tag_impact + sentiment_score=0 → 0', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({ sentiment_score: 0, tag_impact: [] }),
      USER_TAGS,
      TAG_MAP
    )
    expect(item.score).toBe(0)
  })

  it('пустой tag_impact без sentiment_score → 0', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({ sentiment_score: undefined, tag_impact: [] }),
      USER_TAGS,
      TAG_MAP
    )
    expect(item.score).toBe(0)
  })
})

describe('adaptPulseToNewsItem — поля', () => {
  it('фолбэк title_original/summary_original', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({ title_ru: null, summary_ru: null, title_original: 'OPEC cuts output', summary_original: 'Output cut by 1M bpd' }),
      USER_TAGS,
      TAG_MAP
    )
    expect(item.title).toBe('OPEC cuts output')
    expect(item.text).toBe('Output cut by 1M bpd')
  })

  it('неизвестный tag_id в matched_tags → показываем id, не падаем', () => {
    const item = adaptPulseToNewsItem(makeArticle({ matched_tags: ['t-1', 'ghost'] }), USER_TAGS, TAG_MAP)
    expect(item.tags).toEqual(['нефть', 'ghost'])
  })
})

describe('buildImpactLines — строки влияния для «Что это значит»', () => {
  it('теги юзера первыми, пустой reasoning отфильтрован', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({
        tag_impact: [
          { tag: 't-2', score: 9, reasoning: 'второстепенно' },
          { tag: 't-1', score: 2, reasoning: 'ваша тема' },
          { tag: 't-3', score: 8, reasoning: '' },
        ],
      }),
      USER_TAGS,
      TAG_MAP
    )
    const lines = buildImpactLines(item, USER_TAGS, TAG_MAP)
    expect(lines.map((l) => l.name)).toEqual(['нефть', 'газ'])
    expect(lines[0].reasoning).toBe('ваша тема')
  })
})

describe('buildReflectReasoning — цепочка приоритетов', () => {
  it('① reasoning по тегу юзера с префиксом «По вашей теме …»', () => {
    const item = adaptPulseToNewsItem(makeArticle(), USER_TAGS, TAG_MAP)
    const text = buildReflectReasoning(item, USER_TAGS, TAG_MAP)
    expect(text).toBe('По вашей теме нефть: Маржа производителей вырастет примерно на 8 долларов с барреля')
  })

  it('② чужой тег с max |score| без префикса, если нет reasoning по юзеру', () => {
    const item = adaptPulseToNewsItem(makeArticle(), USER_TAGS, TAG_MAP)
    const text = buildReflectReasoning(item, new Set(['t-x']), TAG_MAP)
    expect(text).toBe('Маржа производителей вырастет примерно на 8 долларов с барреля')
  })

  it('③ второй абзац sentiment_reasoning при пустом tag_impact', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({
        tag_impact: [{ tag: 't-1', score: 0, reasoning: '' }],
        sentiment_reasoning: 'Факты новости.\n\nЭффект для инвесторов — рост маржи.\n\nКаскадные эффекты.',
      }),
      USER_TAGS,
      TAG_MAP
    )
    const text = buildReflectReasoning(item, USER_TAGS, TAG_MAP)
    expect(text).toBe('Эффект для инвесторов — рост маржи.')
  })

  it('④ REFLECT_DEFAULT, когда всё пусто; результат из списка и детерминирован', () => {
    const item = adaptPulseToNewsItem(
      makeArticle({ tag_impact: [], sentiment_reasoning: '' }),
      USER_TAGS,
      TAG_MAP
    )
    const text = buildReflectReasoning(item, USER_TAGS, TAG_MAP)
    expect(REFLECT_DEFAULT).toContain(text)
    expect(buildReflectReasoning(item, USER_TAGS, TAG_MAP)).toBe(text)
  })
})

describe('tagMap', () => {
  it('tagName: неизвестный id → id', () => {
    expect(tagName(TAG_MAP, 'ghost')).toBe('ghost')
  })

  it('buildTagMap: пустое имя → id', () => {
    const m = buildTagMap([{ tag_id: 'x', tag_name: '' }])
    expect(m.get('x')).toBe('x')
  })
})

describe('calendarAdapter — повестка дня', () => {
  const response: CalendarResponse = {
    server_date: '2026-09-21',
    generated_at: '2026-09-21T06:00:00Z',
    stale: false,
    days: [
      {
        date: '2026-09-21',
        weekday: 'пн',
        groups: [
          {
            title: 'Отчётность МСФО за 2 кв 2026 (до 17:00)',
            kind: 'МСФО',
            status: 'confirmed',
            companies: [
              { name: 'Лукойл', ticker: 'LKOH' },
              { name: 'Новатэк', ticker: 'NVTK' },
            ],
          },
          {
            title: 'Совет директоров',
            kind: 'СД',
            status: 'expected',
            companies: [{ name: 'Сбербанк', ticker: 'SBER' }],
          },
        ],
      },
      { date: '2026-09-22', weekday: 'вт', groups: [] },
    ],
  }

  it('берёт день server_date и разворачивает группы', () => {
    const events = adaptCalendarToday(response)
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.kind)).toBe(true)
  })

  it('время извлекается regex-ом и сортирует список', () => {
    const events = adaptCalendarToday(response)
    expect(events[0].time).toBe('17:00')
    expect(events[0].title).toBe('Лукойл (LKOH)')
    expect(events[1].time).toBe('17:00')
    // без времени — в конец
    expect(events[2].time).toBeNull()
    expect(events[2].title).toBe('Сбербанк (SBER)')
  })

  it('extractTime: разные форматы', () => {
    expect(extractTime('с 9.30 мск')).toBe('09:30')
    expect(extractTime('без времени')).toBeNull()
  })

  it('дня server_date нет → пустой список', () => {
    expect(adaptCalendarToday({ ...response, server_date: '2030-01-01' })).toEqual([])
  })
})

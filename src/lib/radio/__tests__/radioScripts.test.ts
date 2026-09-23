/**
 * ТЗ-44: тесты адаптированных lib/radio — scripts.ts, summary.ts,
 * calendarAdapter (голосовые строки). Правила: score = 0 → ни фразы, ни
 * «срочности»; severity заменён числовыми порогами (≥8.5 / ≥7); сюжетность =
 * reprint (storyKey в Pulse нет); подкаст — 5 сегментов с двумя ролями.
 */
import { describe, it, expect } from 'vitest'
import { buildSegments, scorePhrase } from '@/lib/radio/scripts'
import { buildPersonalSummary, buildMarketSummary, buildQuotesSegments } from '@/lib/radio/summary'
import { buildCalendarSegments, nextEventLine } from '@/lib/radio/calendarAdapter'
import type { RadioNewsItem, RadioQuote } from '@/types/radio'

function item(partial: Partial<RadioNewsItem>): RadioNewsItem {
  return {
    id: 'n1',
    time: '2026-09-21T10:00:00Z',
    title: 'Заголовок',
    text: 'Текст новости',
    source: 'Интерфакс',
    url: 'https://example.com',
    tags: ['нефть'],
    score: 5,
    reprint: false,
    sources: ['Интерфакс'],
    tagImpact: [],
    sentimentReasoning: '',
    ...partial,
  }
}

const REFLECT = 'Размышление. Текст размышления.'

describe('scorePhrase — только число (ТЗ-44)', () => {
  it('8.5 → «Оценка 8 и 5 из десяти»', () => {
    expect(scorePhrase(8.5)).toBe('Оценка 8 и 5 из десяти')
  })
  it('7 → «Оценка 7 из десяти»', () => {
    expect(scorePhrase(7)).toBe('Оценка 7 из десяти')
  })
  it('score = 0 → null (фразу не выдумываем)', () => {
    expect(scorePhrase(0)).toBeNull()
  })
  it('отрицательный score → null', () => {
    expect(scorePhrase(-1)).toBeNull()
  })
})

describe('buildSegments — режимы эфира', () => {
  it('text: один сегмент, заголовок + текст + оценка', () => {
    const segs = buildSegments(item({ score: 7.5 }), 'text', REFLECT)
    expect(segs).toHaveLength(1)
    expect(segs[0].role).toBe('single')
    expect(segs[0].text).toContain('Заголовок')
    expect(segs[0].text).toContain('Оценка 7 и 5 из десяти')
  })

  it('text: score = 0 → оценки в тексте нет', () => {
    const segs = buildSegments(item({ score: 0 }), 'text', REFLECT)
    expect(segs[0].text).not.toContain('Оценка')
  })

  it('reprint: диктор предупреждает об источнике', () => {
    const segs = buildSegments(
      item({ reprint: true, source: 'Известия' }),
      'text',
      REFLECT
    )
    expect(segs[0].text).toContain('перепечатка')
    expect(segs[0].text).toContain('Известия')
  })

  it('reflect: два сегмента, второй — reasoning из ТЗ-43', () => {
    const segs = buildSegments(item({}), 'reflect', REFLECT)
    expect(segs).toHaveLength(2)
    expect(segs[1].text).toBe(REFLECT)
  })

  it('podcast: 5 сегментов, роли host/guest чередуются', () => {
    const segs = buildSegments(item({ score: 9 }), 'podcast', REFLECT)
    expect(segs).toHaveLength(5)
    expect(segs.map((s) => s.role)).toEqual(['host', 'guest', 'host', 'guest', 'host'])
    expect(segs[1].text).toContain('Заголовок')
  })

  it('podcast: «Размышление. » срезается из реплики аналитика', () => {
    const segs = buildSegments(item({}), 'podcast', 'Размышление. Суть вот такая.')
    expect(segs[3].text).toBe('Суть вот такая.')
  })

  it('podcast: score ≥ 8.5 → открывающая реплика из «critical»-набора', () => {
    const segs = buildSegments(item({ score: 9 }), 'podcast', REFLECT)
    expect(segs[0].text.length).toBeGreaterThan(0)
    // весь набор critical-реплик; проверяем, что одна из двух
    const openers = [
      'Внимание, срочная новость, наш аналитик уже на связи. Давайте по порядку.',
      'Так, это важное, прерываем обычный эфир. Что случилось?',
    ]
    expect(openers).toContain(segs[0].text)
  })
})

const QUOTES: RadioQuote[] = [
  { symbol: 'BTCUSDT', name: 'Биткоин', price: 118400, changePct: 2.5 },
  { symbol: 'ETHUSDT', name: 'Эфириум', price: 4350, changePct: -1.2 },
]

describe('buildPersonalSummary — фолбэк (ТЗ-44)', () => {
  it('всё прочитано → один сегмент «вы в курсе»', () => {
    const n = item({ id: 'a' })
    const { segments: segs } = buildPersonalSummary([n], new Set(['a']), [], 4, ['нефть'])
    expect(segs).toHaveLength(1)
    expect(segs[0].text).toContain('всё прочитали')
  })

  it('перепечатки не считаются сюжетами', () => {
    const main = item({ id: 'a' })
    const rep = item({ id: 'b', reprint: true })
    const { segments: segs } = buildPersonalSummary([main, rep], new Set(), [], 4, ['нефть'])
    expect(segs[0].text).toContain('Непрочитанных сюжетов: 1')
  })

  it('свои темы идут первыми', () => {
    const mine = item({ id: 'a', tags: ['нефть'], score: 3 })
    const other = item({ id: 'b', tags: ['зерно'], score: 9 })
    const { segments: segs } = buildPersonalSummary([other, mine], new Set(), [], 4, ['нефть'])
    expect(segs[0].text).toContain('По вашим темам')
    expect(segs[0].text).toContain('нефть')
    // первый сюжет в списке — «ваша тема», несмотря на меньший score
    expect(segs[1].text).toContain('ваша тема')
    expect(segs[1].text).toContain('Заголовок')
  })

  it('без интересов — общая картина с темами', () => {
    const { segments: segs } = buildPersonalSummary([item({ id: 'a' })], new Set(), QUOTES, 4, [])
    expect(segs[0].text).toContain('общую картину')
    expect(segs.some((s) => s.text.includes('Главные темы'))).toBe(true)
  })

  it('котировки наблюдения озвучиваются', () => {
    const { segments: segs } = buildPersonalSummary([item({ id: 'a' })], new Set(), QUOTES, 4, ['нефть'])
    expect(segs.some((s) => s.text.includes('В вашем наблюдении'))).toBe(true)
  })
})

describe('buildMarketSummary — фолбэк (ТЗ-44)', () => {
  it('score ≥ 8.5 — «срочное», иначе спокойная тональность', () => {
    const m = buildMarketSummary([item({ id: 'a', score: 9 })], [], 10, 50)
    expect(m.text).toContain('Срочное:')
    expect(m.segments.some((s) => s.text.startsWith('Срочное:'))).toBe(true)
  })

  it('score = 0 → без «срочного», тональность спокойная', () => {
    const m = buildMarketSummary([item({ id: 'a', score: 0 })], [], 5, 50)
    expect(m.text).not.toContain('Срочное:')
    expect(m.text).toContain('спокойная')
  })

  it('перепечатки отфильтрованы из сюжетов', () => {
    const m = buildMarketSummary(
      [item({ id: 'a', score: 9 }), item({ id: 'b', reprint: true })],
      [],
      10,
      50
    )
    expect(m.text).toContain('1 перепечаток отфильтровано')
  })

  it('котировки попадают в текст', () => {
    const m = buildMarketSummary([item({ id: 'a' })], QUOTES, 10, 50)
    expect(m.text).toContain('Котировки сейчас')
    expect(m.text).toContain('Биткоин')
  })
})

describe('buildQuotesSegments', () => {
  it('пустое наблюдение → приглашение добавить активы', () => {
    const segs = buildQuotesSegments([])
    expect(segs[0].text).toContain('Наблюдение пусто')
  })

  it('лидер — максимальный changePct, аутсайдер — минимальный', () => {
    const segs = buildQuotesSegments(QUOTES)
    const last = segs[segs.length - 1].text
    expect(last).toContain('Лидер дня')
    expect(last).toContain('Биткоин')
    expect(last).toContain('Эфириум')
  })
})

describe('календарь: голосовые строки', () => {
  const events = [
    { time: '09:30', title: 'Lukoil (LKOH)', kind: 'МСФО' },
    { time: '17:00', title: 'Совет директоров Сбербанка (SBER)', kind: 'СД' },
    { time: null, title: 'Отсечка дивидендов', kind: 'Дивиденды' },
  ]

  it('buildCalendarSegments: вводная + события с временем', () => {
    const segs = buildCalendarSegments(events)
    expect(segs[0].text).toContain('Событий на сегодня: 3')
    expect(segs.some((s) => s.text.includes('в 09:30'))).toBe(true)
    expect(segs.some((s) => s.text.includes('в течение дня'))).toBe(true)
  })

  it('пустой календарь — корректная фраза', () => {
    expect(buildCalendarSegments([])[0].text).toContain('пуст')
  })

  it('nextEventLine: ближайшее событие, прошедшие пропускаются', () => {
    const d = new Date('2026-09-21T10:00:00')
    const line = nextEventLine(events, d)
    expect(line).toContain('17:00')
    expect(line).not.toContain('09:30')
  })

  it('nextEventLine: событий не осталось → пусто', () => {
    const d = new Date('2026-09-21T23:59:00')
    expect(nextEventLine(events, d)).toBe('')
  })
})

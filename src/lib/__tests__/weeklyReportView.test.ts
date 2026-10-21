/**
 * ТЗ-191 — регрессия маппинга payload → view-модель еженедельного отчёта.
 * Чистые функции weeklyReportView: плюрализация, форматы дат ru-RU,
 * дедуп источников, KPI (архив с дельтами / live с темпом будни-к-будням).
 */
import { describe, it, expect } from 'vitest'
import {
  buildKpis,
  currentWeekStartMsk,
  elapsedDaysOfWeekMsk,
  formatDayLabel,
  formatNewsDateTime,
  formatWeekRange,
  newsAnchorId,
  pluralNews,
  sentimentClass,
  sentimentRatio,
  summaryParagraphs,
  tempoLine,
  topSources,
  uniqueArticles,
  weekDayDates,
} from '@/lib/weeklyReportView'
import type { WeeklyReportContent } from '@/lib/reportsApi'

const article = (over: Partial<{ title: string; source: string; url: string; sentiment: string }> = {}) => ({
  title: over.title ?? 'Новость',
  summary: '',
  source: over.source ?? 'РБК',
  url: over.url ?? 'https://example.com/a',
  publishedAt: '2026-10-14T06:41:00.000Z',
  sentiment: over.sentiment ?? 'neutral',
})

const content = (stats: WeeklyReportContent['stats']): WeeklyReportContent => ({
  period: '13 — 19 октября 2026',
  totalArticles: 3,
  sentimentBreakdown: { positive: 1, negative: 1, neutral: 1 },
  stats,
  tagSummaries: [
    {
      tagId: 't1',
      tagName: 'Сбербанк',
      articles: [article(), article({ title: 'Другая', url: 'https://example.com/b', sentiment: 'positive' })],
    },
    {
      tagId: 't2',
      tagName: 'Нефть',
      // Пересечение: та же новость матчится к двум тегам — в источниках дедуп
      articles: [article()],
    },
  ],
})

const stats = {
  perTag: [
    { tagId: 't1', tagName: 'Сбербанк', current: 34, prevWeek: 22, monthAvg: 30 },
    { tagId: 't2', tagName: 'Нефть', current: 21, prevWeek: 25, monthAvg: 20 },
  ],
  perDay: [
    { date: '2026-10-13', count: 22 },
    { date: '2026-10-14', count: 19 },
    { date: '2026-10-15', count: 25 },
    { date: '2026-10-16', count: 17 },
    { date: '2026-10-17', count: 21 },
    { date: '2026-10-18', count: 21 },
    { date: '2026-10-19', count: 17 },
  ],
  sentiment: {
    positive: 61, negative: 38, neutral: 43,
    prevPositive: 48, prevNegative: 35, prevNeutral: 40,
  },
  kpis: { totalDeltaWeekPct: 18, totalDeltaMonthPct: 6, topTagId: 't1', peakDay: '2026-10-15' },
}

describe('sentimentClass', () => {
  it('мапит сырые значения в классы §3.2', () => {
    expect(sentimentClass('positive')).toBe('pos')
    expect(sentimentClass('negative')).toBe('neg')
    expect(sentimentClass('neutral')).toBe('neu')
    expect(sentimentClass(undefined)).toBe('neu')
    expect(sentimentClass('mixed')).toBe('neu')
  })
})

describe('pluralNews', () => {
  it('склоняет по русским правилам', () => {
    expect(pluralNews(1)).toBe('новость')
    expect(pluralNews(2)).toBe('новости')
    expect(pluralNews(5)).toBe('новостей')
    expect(pluralNews(11)).toBe('новостей')
    expect(pluralNews(22)).toBe('новости')
  })
})

describe('форматы дат (ru-RU, МСК)', () => {
  it('неделя: понедельник → «пн — вс» с месяцем и годом', () => {
    // 2026-10-12 — понедельник
    expect(formatWeekRange('2026-10-12')).toBe('12 — 18 октября 2026')
  })

  it('weekDayDates отдаёт 7 дат пн..вс', () => {
    const days = weekDayDates('2026-10-12')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-12')
    expect(days[6]).toBe('2026-10-18')
    expect(formatDayLabel(days[0])).toBe('Пн')
    expect(formatDayLabel(days[6])).toBe('Вс')
  })

  it('время новости в МСК: UTC 06:41 → 09:41', () => {
    expect(formatNewsDateTime('2026-10-14T06:41:00.000Z')).toBe('14 окт, 09:41')
  })
})

describe('источники: дедуп между тегами', () => {
  it('многотеговая новость считается один раз', () => {
    const c = content(stats)
    const uniq = uniqueArticles(c.tagSummaries)
    expect(uniq).toHaveLength(2)
    const sources = topSources(uniq)
    expect(sources).toEqual([{ source: 'РБК', count: 2 }])
  })
})

describe('buildKpis', () => {
  it('архив: дельты к прошлой неделе и месяцу', () => {
    const kpis = buildKpis({ content: content(stats), live: false, pace: null, elapsedDays: null })
    expect(kpis).toHaveLength(6)
    // Всего = сумма тональности из stats
    expect(kpis[0]).toMatchObject({ key: 'total', value: '142', glow: true })
    expect(kpis[0].delta).toEqual({ text: '+18% к пр. неделе', dir: 'up' })
    // К мес. среднему
    expect(kpis[1].value).toBe('+6%')
    expect(kpis[1].delta?.text).toBe('среднее: 50 / нед')
    // Позитив +27% (61 vs 48)
    expect(kpis[2].delta).toEqual({ text: '+27%', dir: 'up' })
    // Негатив +9% (38 vs 35)
    expect(kpis[3].delta).toEqual({ text: '+9%', dir: 'up' })
    // Самый обсуждаемый — топ-тег из stats
    expect(kpis[5]).toMatchObject({ value: 'Сбербанк' })
    expect(kpis[5].delta?.text).toBe('34 новости')
  })

  it('дробные проценты округляются до двух знаков', () => {
    const s = {
      ...stats,
      kpis: { totalDeltaWeekPct: -4.48307410795974, totalDeltaMonthPct: 6.759382349933, topTagId: 't1', peakDay: '2026-10-15' },
    }
    const kpis = buildKpis({ content: content(s), live: false, pace: null, elapsedDays: null })
    expect(kpis[0].delta?.text).toBe('−4.48% к пр. неделе')
    expect(kpis[1].value).toBe('+6.76%')
  })

  it('live: без процентных дельт, вместо них темп будни-к-будням', () => {
    const liveStats = { ...stats, kpis: { totalDeltaWeekPct: null, totalDeltaMonthPct: null, topTagId: 't1', peakDay: '2026-10-14' } }
    const kpis = buildKpis({
      content: content(liveStats),
      live: true,
      pace: { elapsed_total: 47, prev_same_weekdays_total: 52 },
      elapsedDays: 3,
    })
    expect(kpis[0].delta).toEqual({
      text: '47 за 3 дня · в прошлую неделю за те же 3 дня — 52',
      dir: 'flat',
    })
    expect(kpis[1].value).toBe('—')
    expect(kpis[2].delta).toEqual({ text: '—', dir: 'flat' })
  })

  it('деградация без stats: total из totalArticles, дельты «—»', () => {
    const kpis = buildKpis({ content: content(null), live: false, pace: null, elapsedDays: null })
    expect(kpis[0].value).toBe('3')
    expect(kpis[0].delta).toEqual({ text: '—', dir: 'flat' })
    // Топ-тег — первый по числу статей
    expect(kpis[5].value).toBe('Сбербанк')
  })
})

describe('tempoLine / sentimentRatio / paragraphs', () => {
  it('темп live-режима', () => {
    expect(tempoLine(3, { elapsed_total: 47, prev_same_weekdays_total: 52 }))
      .toBe('47 за 3 дня · в прошлую неделю за те же 3 дня — 52')
    expect(tempoLine(1, { elapsed_total: 10, prev_same_weekdays_total: 8 }))
      .toBe('10 за 1 день · в прошлую неделю за те же 1 день — 8')
  })

  it('соотношение позитив/негатив', () => {
    expect(sentimentRatio(61, 38)).toBe('1.6×')
    expect(sentimentRatio(10, 0)).toBeNull()
  })

  it('саммари разбивается на абзацы текстовых узлов', () => {
    expect(summaryParagraphs('Абзац 1.\n\nАбзац 2.')).toEqual(['Абзац 1.', 'Абзац 2.'])
  })
})

describe('newsAnchorId', () => {
  it('якоря списка событий совпадают с якорями новостей в ленте тега', () => {
    expect(newsAnchorId('t1', 0)).toBe('wr-news-t1-0')
  })
})

describe('currentWeekStartMsk / elapsedDaysOfWeekMsk (ПРАВКА-1 к ТЗ-191)', () => {
  it('понедельник текущей недели — всегда понедельник, в прошлом или сегодня', () => {
    const start = new Date(`${currentWeekStartMsk()}T12:00:00Z`)
    expect(start.getUTCDay()).toBe(1) // Monday
    const todayMsk = new Date(Date.now() + 3 * 3600 * 1000)
    expect(start.getTime()).toBeLessThanOrEqual(todayMsk.getTime())
    expect(todayMsk.getTime() - start.getTime()).toBeLessThan(7 * 86400000)
  })

  it('прошедших дней недели — от 1 (пн) до 7 (вс)', () => {
    const n = elapsedDaysOfWeekMsk()
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(7)
    // Пн = 1: разница между сегодня и понедельником недели — n-1 дней
    const start = new Date(`${currentWeekStartMsk()}T00:00:00Z`).getTime()
    const today = new Date(Date.now() + 3 * 3600 * 1000)
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    expect((todayUtc - start) / 86400000 + 1).toBe(n)
  })
})

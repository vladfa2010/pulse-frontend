// ТЗ-194: панель «настроение новостей» — накопительная ступенчатая кривая
// на графике недели. Тесты Задачи 3: (1) накопление — маппинг на свечи и цвет
// точки по знаку ДЕЛЬТЫ (новости, не баланса); (2) итог у конца = последний cum;
// (3) деградация null → два грида как у каскадов, подпись скрыта; (4) регрессия —
// без пропа CascadeChart рендерит два грида как раньше; (5) макет трёх гридов,
// step-after, общий dataZoom, пунктирный ноль; (6) WeekChartBlock — подпись,
// маппинг news_id → newsId, колбек клика. echarts мокаем — ловим setOption.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { InstrumentChart } from '@/lib/newsChart'
import CascadeChart, { buildSentimentStepData, type SentimentPoint } from '@/components/cascades/CascadeChart'
import WeekChartBlock from '@/components/weekly/WeekChartBlock'
import type { WeeklyChartResponse } from '@/lib/reportsApi'

// ─── Мок echarts: init → стаб, setOption ловим ──────────────────────────────
const echartsMock = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  init: vi.fn(),
}))

vi.mock('echarts', () => ({
  init: echartsMock.init.mockImplementation(() => ({
    setOption: echartsMock.setOption,
    resize: echartsMock.resize,
    dispose: echartsMock.dispose,
    on: echartsMock.on,
  })),
}))

// ─── Мок useWeeklyChart (WeekChartBlock) ────────────────────────────────────
const mocks = vi.hoisted(() => ({ useWeeklyChart: vi.fn() }))

vi.mock('@/lib/reportsApi', () => ({
  useWeeklyChart: mocks.useWeeklyChart,
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// 10 свечей по 5 минут от 13.10.2026 10:00 МСК
const T0 = '2026-10-13T07:00:00.000Z'
const times = Array.from({ length: 10 }, (_, i) => new Date(new Date(T0).getTime() + i * 5 * 60e3).toISOString())

function makeInstrument(): InstrumentChart {
  return {
    tag_id: 'tag-1',
    tag_name: 'Сбер',
    symbol: 'SBER@MISX',
    date: '2026-10-13',
    shifted: false,
    timezone: 'Europe/Moscow',
    exchange_mic: 'MISX',
    exchange_name: 'МосБиржа',
    times,
    ohlc: times.map((_, i) => [100 + i, 101 + i, 99 + i, 101.5 + i]),
    volumes: times.map(() => 1000),
    dates: ['2026-10-13'],
  }
}

function makeChartResponse(sentiment: WeeklyChartResponse['sentiment']): WeeklyChartResponse {
  return { chart: makeInstrument(), news_markers: [], week_change_pct: 1.5, sentiment }
}

// кривая: +10 мин позитив (cum +1), +30 мин негатив (cum 0 — баланс 0, но
// вторая новость негативная: точка должна быть КРАСНОЙ по знаку дельты)
const SERIES: SentimentPoint[] = [
  { t: new Date(new Date(T0).getTime() + 10 * 60e3).toISOString(), cum: 1, newsId: 'n1' },
  { t: new Date(new Date(T0).getTime() + 30 * 60e3).toISOString(), cum: 0, newsId: 'n2' },
]

function lastOption(): any {
  expect(echartsMock.setOption).toHaveBeenCalled()
  const calls = echartsMock.setOption.mock.calls
  return calls[calls.length - 1][0]
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  echartsMock.setOption.mockClear()
  echartsMock.on.mockClear()
  mocks.useWeeklyChart.mockReset()
})

describe('ТЗ-194: buildSentimentStepData — маппинг кривой на свечи', () => {
  it('старт-точка [0, 0], точки на ближайших свечах, цвет точки по знаку ДЕЛЬТЫ', () => {
    const data = buildSentimentStepData(times, SERIES, [])!
    expect(data).not.toBeNull()
    // старт периода = 0: кривая от нуля по определению
    expect(data.items[0]).toMatchObject({ value: [0, 0] })
    // +10 мин → свеча 2 (позитив: зелёная); +30 мин → свеча 6 (негатив: красная,
    // хотя cum = 0 — цвет НОВОСТИ, не баланса)
    expect(data.items[1]).toMatchObject({ value: [2, 1], newsId: 'n1', itemStyle: { color: '#34D399' } })
    expect(data.items[2]).toMatchObject({ value: [6, 0], newsId: 'n2', itemStyle: { color: '#EF4444' } })
  })

  it('итог = последний cum; ось Y — автомасштаб с нулём внутри', () => {
    const data = buildSentimentStepData(times, SERIES, [])!
    expect(data.total).toBe(0) // конец кривой = positive − negative = 1 − 1
    expect(data.min).toBeLessThanOrEqual(0)
    expect(data.max).toBeGreaterThanOrEqual(1)
  })

  it('мета тултипа из маркера той же новости (матч по published_at)', () => {
    const markers = [
      { marker: { id: 'm1', url: 'https://example.com/1', published_at: SERIES[0].t, title: 'Заголовок', source: 'РБК' }, index: 2, price: 101, inSession: true, clipped: false },
    ] as any
    const data = buildSentimentStepData(times, SERIES, markers)!
    expect(data.items[1].title).toBe('Заголовок')
    expect(data.items[1].source).toBe('РБК')
    // маркера нет — пустая мета, без падения
    expect(data.items[2].title).toBe('')
  })

  it('пустые входы → null', () => {
    expect(buildSentimentStepData(times, [], [])).toBeNull()
    expect(buildSentimentStepData([], SERIES, [])).toBeNull()
  })
})

describe('ТЗ-194: CascadeChart — макет гридов', () => {
  it('регрессия: БЕЗ пропа — два грида как у каскадов (цена/объём)', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={null} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const opt = lastOption()
    expect(opt.grid).toHaveLength(2)
    expect(opt.dataZoom[0].xAxisIndex).toEqual([0, 1])
    // series: свечи, объём (grid 1), scatter — каскадный набор без изменений
    expect(opt.series.map((s: any) => s.type)).toEqual(['candlestick', 'bar', 'scatter'])
    expect(opt.series[1].xAxisIndex).toBe(1)
  })

  it('проп вообще не передан — тоже два грида (каскадный сценарий)', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(lastOption().grid).toHaveLength(2)
  })

  it('с серией — три грида (цена/настроение/объём), step-after, общий dataZoom, ноль пунктиром', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={SERIES} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const opt = lastOption()
    expect(opt.grid).toHaveLength(3)
    expect(opt.dataZoom[0].xAxisIndex).toEqual([0, 1, 2])
    // series: свечи, кривая (grid 1), объём (grid 2), scatter
    expect(opt.series.map((s: any) => s.type)).toEqual(['candlestick', 'line', 'bar', 'scatter'])
    const sent = opt.series[1]
    expect(sent).toMatchObject({ id: 'sentiment', xAxisIndex: 1, yAxisIndex: 1, step: 'end' })
    expect(sent.markLine.data).toEqual([{ yAxis: 0 }])
    expect(sent.markLine.lineStyle.type).toBe('dashed')
    expect(opt.series[2].xAxisIndex).toBe(2)
    // ось Y панели — автомасштаб под счёт (не фикс [-1, 1])
    expect(opt.yAxis[1]).toMatchObject({ gridIndex: 1, min: 0, max: 1 })
    expect(opt.yAxis[1].axisLabel.show).toBe(false)
  })

  it('у конца кривой подпись «итог» цветом знака', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={SERIES} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const sent = lastOption().series[1]
    const last = sent.data[sent.data.length - 1]
    expect(last.label.show).toBe(true)
    expect(last.label.position).toBe('right')
    expect(last.label.formatter).toBe('итог: 0') // total = 0 — без знака
  })

  it('клик по точке кривой — колбэк с newsId (старое: null)', async () => {
    const onSentimentPointClick = vi.fn()
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={SERIES} onSentimentPointClick={onSentimentPointClick} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(echartsMock.on).toHaveBeenCalledWith('click', expect.any(Function))
    const handlers = echartsMock.on.mock.calls.filter((c: any[]) => c[0] === 'click').map((c: any[]) => c[1])
    for (const h of handlers) h({ seriesId: 'sentiment', data: { newsId: 'n2' } })
    expect(onSentimentPointClick).toHaveBeenCalledWith({ newsId: 'n2' })
    // чужая серия — не наш клик
    onSentimentPointClick.mockClear()
    for (const h of handlers) h({ seriesId: 'volume', data: {} })
    expect(onSentimentPointClick).not.toHaveBeenCalled()
  })
})

describe('ТЗ-194: WeekChartBlock — подпись панели, деградация, маппинг', () => {
  function setup(sentiment: WeeklyChartResponse['sentiment']) {
    mocks.useWeeklyChart.mockReturnValue({ data: makeChartResponse(sentiment), isLoading: false })
    return render(<WeekChartBlock scope={{ kind: 'live' } as never} tagId="tag-1" k={null} live />)
  }

  it('серия есть → подпись «Настроение новостей · накопительная кривая от нуля» + легенда', async () => {
    setup([
      { t: new Date(new Date(T0).getTime() + 10 * 60e3).toISOString(), cum: 1, news_id: 'n1' },
      { t: new Date(new Date(T0).getTime() + 30 * 60e3).toISOString(), cum: 0, news_id: 'n2' },
    ])
    expect(screen.getByText('Настроение новостей · накопительная кривая от нуля')).not.toBeNull()
    expect(screen.getByText('позитив')).not.toBeNull()
    expect(screen.getByText('негатив')).not.toBeNull()
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const sent = lastOption().series[1]
    // бэкенд news_id → фронт newsId в данных точек
    expect(sent.data[1].newsId).toBe('n1')
    expect(sent.data[2].newsId).toBe('n2')
    expect(lastOption().grid).toHaveLength(3)
  })

  it('sentiment: null (<2 ненейтральных) — подпись скрыта, график два грида без ошибок', async () => {
    setup(null)
    expect(screen.queryByText(/Настроение новостей/)).toBeNull()
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(lastOption().grid).toHaveLength(2)
  })

  it('клик по точке проброшен наружу как newsId', async () => {
    const onSentimentClick = vi.fn()
    mocks.useWeeklyChart.mockReturnValue({
      data: makeChartResponse([
        { t: new Date(new Date(T0).getTime() + 10 * 60e3).toISOString(), cum: 1, news_id: 'n1' },
        { t: new Date(new Date(T0).getTime() + 30 * 60e3).toISOString(), cum: 0, news_id: 'n2' },
      ]),
      isLoading: false,
    })
    render(<WeekChartBlock scope={{ kind: 'live' } as never} tagId="tag-1" k={null} live onSentimentClick={onSentimentClick} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const handlers = echartsMock.on.mock.calls.filter((c: any[]) => c[0] === 'click').map((c: any[]) => c[1])
    for (const h of handlers) h({ seriesId: 'sentiment', data: { newsId: 'n1' } })
    expect(onSentimentClick).toHaveBeenCalledWith('n1')
  })
})

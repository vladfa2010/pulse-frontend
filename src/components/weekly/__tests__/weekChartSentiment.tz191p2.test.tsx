// ПРАВКА-2 к ТЗ-191: панель «новостной фон · сантимент» на графике недели.
// Тесты ТЗ: (3) деградация null → два грида как у каскадов, подпись скрыта;
// (4) регрессия — без пропа CascadeChart рендерит два грида как раньше;
// плюс маппинг бакетов на свечи (buildSentimentBarData) и трёхgrid'овый макет
// с общим dataZoom и пунктирным нулём. echarts мокаем — ловим setOption.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { InstrumentChart } from '@/lib/newsChart'
import CascadeChart, { buildSentimentBarData, type SentimentPoint } from '@/components/cascades/CascadeChart'
import WeekChartBlock from '@/components/weekly/WeekChartBlock'
import type { WeeklyChartResponse } from '@/lib/reportsApi'

// ─── Мок echarts: init → стаб, setOption ловим ──────────────────────────────
const echartsMock = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  init: vi.fn(),
}))

vi.mock('echarts', () => ({
  init: echartsMock.init.mockImplementation(() => ({
    setOption: echartsMock.setOption,
    resize: echartsMock.resize,
    dispose: echartsMock.dispose,
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

const SERIES: SentimentPoint[] = [
  { t: new Date(new Date(T0).getTime() + 10 * 60e3).toISOString(), score: 0.5 },
  { t: new Date(new Date(T0).getTime() + 30 * 60e3).toISOString(), score: -0.25 },
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
  mocks.useWeeklyChart.mockReset()
})

describe('ТЗ-191 ПРАВКА-2: buildSentimentBarData — маппинг бакетов на свечи', () => {
  it('бакет встаёт на ближайшую свечу, цвет по знаку', () => {
    const items = buildSentimentBarData(times, SERIES)!
    expect(items).toHaveLength(times.length)
    // +10 мин → свеча 2; +30 мин → свеча 6
    expect(items[2]).toEqual({ value: 0.5, itemStyle: { color: 'rgba(52,211,153,0.6)' } })
    expect(items[6]).toEqual({ value: -0.25, itemStyle: { color: 'rgba(239,68,68,0.6)' } })
    // остальные — невидимые нули
    expect(items[0]).toEqual({ value: 0, itemStyle: { color: 'transparent' } })
  })

  it('пустые входы → null', () => {
    expect(buildSentimentBarData(times, [])).toBeNull()
    expect(buildSentimentBarData([], SERIES)).toBeNull()
  })
})

describe('ТЗ-191 ПРАВКА-2: CascadeChart — макет гридов', () => {
  it('регрессия: БЕЗ пропа — два грида как у каскадов (цена/объём)', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={null} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const opt = lastOption()
    expect(opt.grid).toHaveLength(2)
    expect(opt.dataZoom[0].xAxisIndex).toEqual([0, 1])
    // series: свечи, объём (grid 1), scatter
    expect(opt.series.map((s: any) => s.type)).toEqual(['candlestick', 'bar', 'scatter'])
    expect(opt.series[1].xAxisIndex).toBe(1)
  })

  it('проп вообще не передан — тоже два грида (каскадный сценарий)', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(lastOption().grid).toHaveLength(2)
  })

  it('с серией — три грида (цена/фон/объём), общий dataZoom, ноль пунктиром', async () => {
    render(<CascadeChart instrument={makeInstrument()} markers={[]} sentimentSeries={SERIES} />)
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    const opt = lastOption()
    expect(opt.grid).toHaveLength(3)
    expect(opt.dataZoom[0].xAxisIndex).toEqual([0, 1, 2])
    // series: свечи, фон (grid 1), объём (grid 2), scatter
    expect(opt.series.map((s: any) => s.type)).toEqual(['candlestick', 'bar', 'bar', 'scatter'])
    expect(opt.series[1].xAxisIndex).toBe(1)
    expect(opt.series[1].markLine.data).toEqual([{ yAxis: 0 }])
    expect(opt.series[1].markLine.lineStyle.type).toBe('dashed')
    expect(opt.series[2].xAxisIndex).toBe(2)
    // yAxis фона — шкала [-1, 1]
    expect(opt.yAxis[1]).toMatchObject({ gridIndex: 1, min: -1, max: 1 })
  })
})

describe('ТЗ-191 ПРАВКА-2: WeekChartBlock — подпись панели и деградация', () => {
  function setup(sentiment: WeeklyChartResponse['sentiment']) {
    mocks.useWeeklyChart.mockReturnValue({ data: makeChartResponse(sentiment), isLoading: false })
    return render(<WeekChartBlock scope={{ kind: 'live' } as never} tagId="tag-1" k={null} live />)
  }

  it('серия есть → подпись «Новостной фон · сантимент · бакеты 4 ч, окно 12 ч» + легенда', async () => {
    setup(SERIES)
    expect(screen.getByText('Новостной фон · сантимент · бакеты 4 ч, окно 12 ч')).not.toBeNull()
    expect(screen.getByText('позитив')).not.toBeNull()
    expect(screen.getByText('негатив')).not.toBeNull()
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(lastOption().grid).toHaveLength(3)
  })

  it('sentiment: null (<10 новостей) — подпись скрыта, график два грида без ошибок', async () => {
    setup(null)
    expect(screen.queryByText(/Новостной фон/)).toBeNull()
    await waitFor(() => expect(echartsMock.setOption).toHaveBeenCalled())
    expect(lastOption().grid).toHaveLength(2)
  })
})

// ТЗ-186 задача 5: колонка «Тренд 30д» в «Ресерче» — спарклайн доли по ночным
// срезам + стрелка тренда (▲ ≥ +0.5 п.п. emerald / ▼ ≤ −0.5 п.п. red / ● иначе),
// «—» при недостатке данных; при ошибке /source-stats или пустых sources колонка
// скрывается целиком — таблица «Ресерча» работает без неё. Fetch мокаем через
// vi.stubGlobal — по образцу analyticsTab.tz185.test.tsx.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ResearchTab from '@/components/cascades/ResearchTab'
import type { CascadeResearchResponse, SourceStatsResponse } from '@/lib/cascadesApi'

const RESEARCH: CascadeResearchResponse = {
  window: '7d',
  clusters_total: 10,
  sources: [
    {
      source: 'Интерфакс',
      first_count: 6,
      share: 0.6,
      participations: 9,
      first_rate: 0.67,
      median_lag_not_first: 14,
    },
    {
      source: 'РИА Новости',
      first_count: 2,
      share: 0.2,
      participations: 8,
      first_rate: 0.25,
      median_lag_not_first: null,
    },
  ],
  speed: {
    median_second_lag_min: 7,
    cascades_with_second: 9,
    dup_le_10m: 5,
    dup_le_60m: 8,
    dup_le_10m_share: 0.56,
    dup_le_60m_share: 0.89,
  },
}

/** 10 срезов; latest share из options, week_ago — из weekAgoShare */
function statsPayload(entries: Array<{ name: string; latestShare: number; weekAgoShare: number | null }>): SourceStatsResponse {
  return {
    days: 30,
    snapshots_from: '2026-10-10',
    sources: entries.map(({ name, latestShare, weekAgoShare }) => ({
      source: name,
      points: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-10-${String(10 + i).padStart(2, '0')}`,
        first_count: 2 + i,
        share: 0.05 + i * ((latestShare - 0.05) / 9),
        participations: 20 + i,
        median_lag_not_first_min: 12,
      })),
      latest: { date: '2026-10-19', share: latestShare, first_count: 11 },
      week_ago: weekAgoShare !== null ? { date: '2026-10-12', share: weekAgoShare } : null,
    })),
  }
}

const OK_STATS = statsPayload([
  { name: 'Интерфакс', latestShare: 0.2, weekAgoShare: 0.1 }, // Δ +10 п.п. → ▲
  { name: 'РИА Новости', latestShare: 0.05, weekAgoShare: 0.12 }, // Δ −7 п.п. → ▼
])

const jsonResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => null },
  }) as unknown as Response

const defaultFetchImpl = async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/api/market/source-stats')) return jsonResponse(OK_STATS)
  throw new Error(`Unexpected fetch: ${url}`)
}

const fetchMock = vi.fn(defaultFetchImpl)

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ResearchTab data={RESEARCH} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockImplementation(defaultFetchImpl)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

describe('ТЗ-186: «Ресерч» — колонка «Тренд 30д»', () => {
  it('при данных: колонка видна, спарклайн и стрелки ▲/▼ по порогам ±0.5 п.п.', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Тренд 30д')).not.toBeNull())

    // Спарклайн — общий Sparkline (svg с rects) в ячейках обоих источников
    const trendHeader = screen.getByText('Тренд 30д')
    expect(trendHeader.closest('table')!.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2)

    // ▲ emerald для Интерфакса (+10 п.п.), ▼ red для РИА (−7 п.п.)
    const up = screen.getByText('▲')
    expect(up.className).toContain('text-emerald-400')
    const down = screen.getByText('▼')
    expect(down.className).toContain('text-red-400')
  })

  it('стрелка ● нейтральная при |Δ| < 0.5 п.п., «—» при week_ago=null', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/market/source-stats')) {
        return jsonResponse(
          statsPayload([
            { name: 'Интерфакс', latestShare: 0.101, weekAgoShare: 0.1 }, // +0.1 п.п. → ●
            { name: 'РИА Новости', latestShare: 0.05, weekAgoShare: null }, // недостаток данных → «—»
          ]),
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    setup()
    await waitFor(() => expect(screen.getByText('Тренд 30д')).not.toBeNull())

    const flat = screen.getByText('●')
    expect(flat.className).toContain('text-[#9CA3AF]')
    // У РИА Новости в ячейке тренда «—» (стрелки нет)
    const row = screen.getByText('РИА Новости').closest('tr')!
    expect(row.textContent).toContain('—')
    expect(row.querySelector('svg')).not.toBeNull() // спарклайн при этом есть
  })

  it('ошибка /source-stats → колонка скрыта, таблица «Ресерча» работает', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('network down')
    })
    setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 5000 })
    await waitFor(() => expect(screen.queryByText('Тренд 30д')).toBeNull(), { timeout: 5000 })

    // Остальные колонки на месте
    expect(screen.getByText('Интерфакс')).not.toBeNull()
    expect(screen.getByText('Лаг, когда не первый')).not.toBeNull()
  })

  it('пустые sources → колонка скрыта, таблица «Ресерча» работает', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/market/source-stats')) {
        return jsonResponse({ days: 30, snapshots_from: null, sources: [] })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Тренд 30д')).toBeNull())

    expect(screen.getByText('Интерфакс')).not.toBeNull()
  })
})

// ТЗ-186 задача 6: вкладка «Динамика» — дисклеймер скользящего окна 7 дней (§1),
// график топ-10 (≥2 полилинии при 2+ источниках), таблица дельт (Δ считается
// из latest.share − week_ago.share и красится при ±0.5 п.п.), week_ago=null →
// «—», пустое состояние при <7 срезах, состояние ошибки с «Повторить».
// Fetch мокаем через vi.stubGlobal — по образцу analyticsTab.tz185.test.tsx.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SourceDynamicsTab from '@/components/cascades/SourceDynamicsTab'
import type { SourceStatsEntry, SourceStatsResponse } from '@/lib/cascadesApi'

/** N срезов с '2026-10-10' по '2026-10-19', share линейно 0.10 → shareLast */
function makeSource(name: string, overrides: Partial<SourceStatsEntry> = {}): SourceStatsEntry {
  const points = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-10-${String(10 + i).padStart(2, '0')}`,
    first_count: 2 + i,
    share: 0.1 + i * 0.005,
    participations: 20 + i,
    median_lag_not_first_min: i % 3 === 0 ? null : 12 + i,
  }))
  const latest = points[points.length - 1]
  return {
    source: name,
    points,
    latest: { date: latest.date, share: latest.share, first_count: latest.first_count },
    week_ago: { date: points[2].date, share: points[2].share },
    ...overrides,
  }
}

const jsonResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => null },
  }) as unknown as Response

const statsFetch = (payload: SourceStatsResponse) => async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/api/market/source-stats')) return jsonResponse(payload)
  throw new Error(`Unexpected fetch: ${url}`)
}

const OK_PAYLOAD: SourceStatsResponse = {
  days: 30,
  snapshots_from: '2026-10-10',
  sources: [makeSource('Интерфакс'), makeSource('РИА Новости')],
}

const fetchMock = vi.fn(statsFetch(OK_PAYLOAD))

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SourceDynamicsTab />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockImplementation(statsFetch(OK_PAYLOAD))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

describe('ТЗ-186: вкладка «Динамика»', () => {
  it('дисклеймер скользящего окна (§1): «6 из 7 дней», тренд сглаживает', async () => {
    setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByText(/соседние срезы разделяют 6 из 7 дней/)).not.toBeNull()
    expect(screen.getByText(/тренд сглаживает резкие изменения/)).not.toBeNull()
  })

  it('график рисует ≥2 полилинии и легенду при 2+ источниках', async () => {
    const { container } = setup()
    await waitFor(() => expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2))
    // Легенда: оба источника с цветом и долей последнего среза (имена дублируются в таблице дельт)
    expect(screen.getAllByText('Интерфакс').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('РИА Новости').length).toBeGreaterThanOrEqual(2)
  })

  it('таблица дельт: Δ считается из latest − week_ago и красится emerald при росте ≥0.5 п.п.', async () => {
    fetchMock.mockImplementation(
      statsFetch({
        days: 30,
        snapshots_from: '2026-10-10',
        sources: [
          // 0.145 − 0.11 = 0.035 → +3,5 п.п. → emerald
          makeSource('Растущий', {
            points: Array.from({ length: 10 }, (_, i) => ({
              date: `2026-10-${String(10 + i).padStart(2, '0')}`,
              first_count: 5,
              share: 0.1 + i * 0.005,
              participations: 30,
              median_lag_not_first_min: 15,
            })),
            latest: { date: '2026-10-19', share: 0.145, first_count: 5 },
            week_ago: { date: '2026-10-12', share: 0.11 },
          }),
        ],
      }),
    )
    setup()
    await waitFor(() => expect(screen.getByText('+3,5')).not.toBeNull())
    expect(screen.getByText('+3,5').className).toContain('text-emerald-400')
    // Доля сейчас 15% / 7д назад 11% — те же числа, что в фикстуре (в таблице и легенде)
    expect(screen.getAllByText('15%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('11%').length).toBeGreaterThanOrEqual(1)
  })

  it('Δ красится red при падении ≤−0.5 п.п.', async () => {
    fetchMock.mockImplementation(
      statsFetch({
        days: 30,
        snapshots_from: '2026-10-10',
        sources: [
          makeSource('Падающий', {
            latest: { date: '2026-10-19', share: 0.08, first_count: 4 },
            week_ago: { date: '2026-10-12', share: 0.14 },
          }),
        ],
      }),
    )
    setup()
    await waitFor(() => expect(screen.getByText('−6,0')).not.toBeNull())
    expect(screen.getByText('−6,0').className).toContain('text-red-400')
  })

  it('week_ago=null → «—» в колонках «Доля 7д назад» и «Δ, п.п.»', async () => {
    fetchMock.mockImplementation(
      statsFetch({
        days: 30,
        snapshots_from: '2026-10-10',
        sources: [makeSource('Без истории', { week_ago: null })],
      }),
    )
    setup()
    // Имя есть и в легенде, и в таблице — строка таблицы ищем через tr
    await waitFor(() =>
      expect(screen.getAllByText('Без истории').some((el) => el.closest('tr') !== null)).toBe(true),
    )
    // «Доля 7д назад» и «Δ, п.п.» — «—» (медианный лаг в последнем срезе есть)
    const row = screen
      .getAllByText('Без истории')
      .map((el) => el.closest('tr'))
      .find((tr) => tr !== null)!
    expect((row.textContent!.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('срезов < 7 у всех источников → пустое состояние «Накапливаю историю…»', async () => {
    const short = makeSource('Свежий', {
      points: makeSource('Свежий').points.slice(-3),
    })
    fetchMock.mockImplementation(
      statsFetch({ days: 30, snapshots_from: '2026-10-17', sources: [short] }),
    )
    setup()
    await waitFor(() =>
      expect(
        screen.getByText(/Накапливаю историю: для динамики нужно 7\+ дней срезов/),
      ).not.toBeNull(),
    )
    expect(screen.getByText(/первый срез появится после ночного прогона/)).not.toBeNull()
  })

  it('sources пуст → та же заглушка', async () => {
    fetchMock.mockImplementation(statsFetch({ days: 30, snapshots_from: null, sources: [] }))
    setup()
    await waitFor(() =>
      expect(screen.getByText(/Накапливаю историю: для динамики нужно 7\+ дней срезов/)).not.toBeNull(),
    )
  })

  it('ошибка запроса → состояние ошибки с кнопкой «Повторить»', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('network down')
    })
    setup()
    await waitFor(
      () => expect(screen.getByText('Не удалось загрузить динамику. Попробуйте ещё раз.')).not.toBeNull(),
      { timeout: 5000 },
    )
  })
})

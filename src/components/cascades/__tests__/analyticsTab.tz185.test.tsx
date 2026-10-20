// ТЗ-185 задача 5: вкладка «Аналитика» — дисклеймер смещения выборки (§4),
// три секции по скоупам (null-состояния: «Первый отчёт…» / «недоступно на
// этой сборке» для тем без TOPICS_ENABLED), рендер payload-секций (топ тем,
// чипсы-триггеры, первоисточники, темпо, итог курсивом), дата прогона
// formatMskDateTime в шапке секции. Fetch мокаем через vi.stubGlobal.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AnalyticsTab from '@/components/cascades/AnalyticsTab'
import { formatMskDateTime } from '@/lib/cascadeFormat'
import type { ViralityPayload } from '@/lib/cascadesApi'

const GENERATED_AT = '2026-10-20T02:30:00.000Z' // 05:30 МСК

function makePayload(overrides: Partial<ViralityPayload> = {}): ViralityPayload {
  return {
    top_topics: [
      { title: 'Ставка ЦБ', takeaway: 'Жёсткая формулировка совета директоров разогнала перепечатки.' },
      { title: 'Санкции против банков', takeaway: 'Свежие списки — вечный магнит для агрегаторов.' },
    ],
    virality_triggers: ['числа', 'персоны', 'регуляторика'],
    ignition: { sources: ['РИА Новости', 'ТАСС'], takeaway: 'Агентства стартуют 8 из 10 топ-каскадов.' },
    tempo: { fast_vs_slow: 'Всплески короче часа доминируют.', takeaway: 'Долгие каскады — редкость, в основном регуляторика.' },
    summary: 'Итоговая строка отчёта.',
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

/** Дефолтный мок fetch: GET /api/market/virality → оба не-топик скоупа заполнены, topics=null. */
const defaultFetchImpl = async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/api/market/virality')) {
    return jsonResponse({
      generated_at: GENERATED_AT,
      scopes: { cascades_24h: makePayload(), stories_7d: makePayload(), topics: null },
    })
  }
  throw new Error(`Unexpected fetch: ${url}`)
}

const fetchMock = vi.fn(defaultFetchImpl)

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsTab />
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

describe('ТЗ-185: вкладка «Аналитика»', () => {
  it('дисклеймер смещения выборки (§4): «что разгоняют редакции», не репосты', async () => {
    setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByText(/что разгоняют редакции/)).not.toBeNull()
    expect(screen.getByText(/не репосты из соцсетей/)).not.toBeNull()
  })

  it('null-скоупы: «Первый отчёт появится после ночного прогона», темы — «недоступно на этой сборке»', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/market/virality')) {
        return jsonResponse({
          generated_at: GENERATED_AT,
          scopes: { cascades_24h: null, stories_7d: null, topics: null },
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    setup()
    // Тестовый env без VITE_TOPICS_ENABLED → topics=null рисуем как «недоступно на этой сборке»
    await waitFor(() => expect(screen.getAllByText('Первый отчёт появится после ночного прогона')).toHaveLength(2))
    expect(screen.getByText('недоступно на этой сборке')).not.toBeNull()
    // Дата прогона при пустых скоупах не показывается
    expect(screen.queryByText(formatMskDateTime(GENERATED_AT))).toBeNull()
  })

  it('рендер payload-секций: топ тем, триггеры-чипсы, первоисточники, темпо, итог', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Каскады · 24ч')).not.toBeNull())

    // Топ тем: title + takeaway (две секции с одинаковым payload → ×2)
    expect(screen.getAllByText('Ставка ЦБ')).toHaveLength(2)
    expect(screen.getAllByText(/Жёсткая формулировка совета директоров/)).toHaveLength(2)
    // Триггеры-чипсы
    expect(screen.getAllByText('регуляторика')).toHaveLength(2)
    // Первоисточники: список + takeaway
    expect(screen.getAllByText('РИА Новости · ТАСС')).toHaveLength(2)
    expect(screen.getAllByText('Агентства стартуют 8 из 10 топ-каскадов.')).toHaveLength(2)
    // Темпо
    expect(screen.getAllByText('Всплески короче часа доминируют.')).toHaveLength(2)
    // Итог курсивом
    expect(screen.getAllByText('Итоговая строка отчёта.')).toHaveLength(2)
    const summary = screen.getAllByText('Итоговая строка отчёта.')[0]
    expect(summary.className).toContain('italic')
  })

  it('дата генерации — formatMskDateTime(generated_at) в шапке каждой заполненной секции', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Сюжеты · 7д')).not.toBeNull())
    // 2 заполненных скоупа из 3 → дата дважды; формат — из cascadeFormat
    expect(screen.getAllByText(formatMskDateTime(GENERATED_AT))).toHaveLength(2)
  })

  it('ошибка запроса → состояние ошибки с кнопкой «Повторить» (refetch дёргает fetch)', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('network down')
    })
    setup()
    // api-клиент при TypeError повторяет GET через 1 с — ждём дольше дефолта waitFor
    await waitFor(() => expect(screen.getByText('Не удалось загрузить аналитику. Попробуйте ещё раз.')).not.toBeNull(), { timeout: 5000 })

    const callsBefore = fetchMock.mock.calls.length
    // Повторный запрос при клике: refetch → второй вызов fetch
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => defaultFetchImpl(input))
    fireEvent.click(screen.getByText('Повторить'))
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore))
    await waitFor(() => expect(screen.getByText('Каскады · 24ч')).not.toBeNull())
  })
})

// ТЗ-190: в табе «МСП» блок безопасности /mcp — лента алертов (дата, метка,
// значение/порог, деталь) и таблица ежедневных счётчиков. Пустая лента →
// «Аномалий не зафиксировано». Блок безопасности не должен ломать сводку.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import McpTab from '../McpTab'

const ALERTS = [
  {
    day: '2026-10-20',
    metric: 'auth_fail_share',
    label: 'Доля мусорных 401',
    value: 0.23,
    threshold: 0.1,
    detail: '401 без валидного токена: 46 из 200 запросов',
    created_at: '2026-10-21T03:40:00.000Z',
  },
  {
    day: '2026-10-18',
    metric: 'rate_limit_429',
    label: 'Срабатывания лимитеров (429)',
    value: 15,
    threshold: 10,
    detail: '429: mcpAuthLimiter=15, mcpLimiter=0',
    created_at: '2026-10-19T03:40:00.000Z',
  },
]

const DAYS = [
  { day: '2026-10-20', requests_total: 200, auth_fail_401: 46, auth_limited_429: 15, token_limited_429: 0, unique_ips: 3 },
  { day: '2026-10-19', requests_total: 180, auth_fail_401: 2, auth_limited_429: 0, token_limited_429: 0, unique_ips: 2 },
]

const jsonResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => null },
  }) as unknown as Response

function makeFetchImpl(opts: { alerts: unknown[]; days: unknown[] }) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method || 'GET'
    if (method !== 'GET') throw new Error(`Unexpected method: ${method}`)
    if (url.includes('/api/admin/mcp/security/alerts')) return jsonResponse({ alerts: opts.alerts })
    if (url.includes('/api/admin/mcp/security/daily')) return jsonResponse({ days: opts.days })
    if (url.includes('/api/admin/mcp/tokens')) return jsonResponse({ tokens: [] })
    throw new Error(`Unexpected fetch: ${url}`)
  }
}

const setup = () =>
  render(
    <MemoryRouter initialEntries={['/admin/mcp']}>
      <McpTab />
    </MemoryRouter>,
  )

describe('McpTab — блок безопасности /mcp (ТЗ-190)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(makeFetchImpl({ alerts: ALERTS, days: DAYS })))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('рендерит заголовок блока и алерты с подписями метрик, датами и деталями', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Безопасность /mcp')).toBeTruthy())
    // Подписи метрик из бэкенда (MCP_SECURITY_METRIC_LABELS)
    expect(screen.getByText('Доля мусорных 401')).toBeTruthy()
    expect(screen.getByText('Срабатывания лимитеров (429)')).toBeTruthy()
    // Дата и деталь первого алерта (дата также есть в таблице дней — getAllByText)
    expect(screen.getAllByText('2026-10-20').length).toBeGreaterThan(0)
    expect(screen.getByText(/401 без валидного токена: 46 из 200 запросов/)).toBeTruthy()
  })

  it('доля 401 форматируется в процентах с порогом', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/23\.0 %/)).toBeTruthy())
    expect(screen.getByText(/порог 10\.0 %/)).toBeTruthy()
  })

  it('таблица ежедневных счётчиков показывает запросы, 401, 429 и IP', async () => {
    setup()
    await waitFor(() => expect(screen.getAllByText('2026-10-19').length).toBeGreaterThan(0))
    // 429-столбец суммирует оба лимитера: 15 + 0 = 15 для 20-го числа
    expect(screen.getByText('15')).toBeTruthy()
    // «Запросов» — и заголовок security-таблицы, и колонка таблицы токенов
    expect(screen.getAllByText('Запросов').length).toBeGreaterThan(0)
    expect(screen.getByText('IP')).toBeTruthy()
  })

  it('пустая лента алертов → статус-строка вместо списка', async () => {
    cleanup()
    vi.stubGlobal('fetch', vi.fn(makeFetchImpl({ alerts: [], days: DAYS })))
    setup()
    await waitFor(() => expect(screen.getByText('Аномалий не зафиксировано')).toBeTruthy())
  })

  it('ошибка security-эндпоинтов не ломает табу (сводка токенов на месте)', async () => {
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/security/')) throw new Error('boom')
      return jsonResponse({ tokens: [] })
    }))
    setup()
    await waitFor(() => expect(screen.getByText('Токенов пока нет')).toBeTruthy())
    // Заголовок блока безопасности всё равно виден (рендерится независимо)
    expect(screen.getByText('Безопасность /mcp')).toBeTruthy()
  })
})

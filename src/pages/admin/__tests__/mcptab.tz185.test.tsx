// ТЗ-185 п.6: таба «МСП» — бейджи статусов (3 статуса), модалка отзыва
// (только для active, POST на верный URL), query-параметры фильтров,
// отсутствие token_hash в выводе. Fetch мокаем через vi.stubGlobal.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import McpTab from '../McpTab'

const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const isoFuture = (msAhead: number) => new Date(NOW + msAhead).toISOString()

// token_hash специально кладём в мок — бэкенд его не отдаёт, и фронт его
// отображать не должен (проверяем отсутствие в DOM).
const TOKENS = [
  {
    token_id: 't1',
    user: { id: 'u1', username: 'ivan', email: 'ivan@test.ru' },
    name: 'CLI-доступ',
    prefix: 'msk_abc1',
    token_hash: 'secret_hash_123',
    scopes: ['read'],
    created_at: iso(40 * 86400000),
    expires_at: isoFuture(30 * 86400000),
    last_used_at: iso(3600000),
    revoked_at: null,
    revoked_by: null,
    requests_count: 120,
    status: 'active',
  },
  {
    token_id: 't2',
    user: { id: 'u2', username: 'petr', email: 'petr@test.ru' },
    name: 'Старый ключ',
    prefix: 'msk_def2',
    scopes: ['read', 'write'],
    created_at: iso(90 * 86400000),
    expires_at: isoFuture(10 * 86400000),
    last_used_at: iso(5 * 86400000),
    revoked_at: iso(5 * 86400000),
    revoked_by: 'admin-1',
    requests_count: 42,
    status: 'revoked',
  },
  {
    token_id: 't3',
    user: { id: 'u3', username: 'anna', email: 'anna@test.ru' },
    name: 'Просроченный',
    prefix: 'msk_ghi3',
    scopes: ['read'],
    created_at: iso(400 * 86400000),
    expires_at: iso(30 * 86400000),
    last_used_at: null,
    revoked_at: null,
    revoked_by: null,
    requests_count: 7,
    status: 'expired',
  },
]

const jsonResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    headers: { get: () => null },
  }) as unknown as Response

/** Дефолтный мок fetch: GET /tokens — фильтрует по status из query; POST /tokens/:id/revoke — 200 {ok:true}. */
const defaultFetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString()
  const method = init?.method || 'GET'
  if (url.includes('/api/admin/mcp/security/alerts')) {
    return jsonResponse({ alerts: [] })
  }
  if (url.includes('/api/admin/mcp/security/daily')) {
    return jsonResponse({ days: [] })
  }
  if (url.includes('/api/admin/mcp/tokens/') && url.endsWith('/revoke') && method === 'POST') {
    const id = url.match(/tokens\/([^/]+)\/revoke/)?.[1]
    return jsonResponse({
      ok: true,
      token: { id, name: 'CLI-доступ', revoked_at: new Date().toISOString(), revoked_by: 'admin-1', user_id: 'u1' },
    })
  }
  if (url.includes('/api/admin/mcp/tokens')) {
    let tokens = TOKENS
    const query = new URL(url).searchParams
    const status = query.get('status')
    if (status === 'active') tokens = tokens.filter(t => t.status === 'active')
    if (status === 'revoked') tokens = tokens.filter(t => t.status === 'revoked')
    if (status === 'expired') tokens = tokens.filter(t => t.status === 'expired')
    const q = query.get('q')?.toLowerCase()
    if (q) {
      tokens = tokens.filter(t =>
        t.user.username.toLowerCase().includes(q) ||
        t.user.email.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q))
    }
    return jsonResponse({ tokens })
  }
  throw new Error(`Unexpected fetch: ${url}`)
}

const fetchMock = vi.fn(defaultFetchImpl)

const setup = (initialEntry = '/admin/mcp') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <McpTab />
    </MemoryRouter>,
  )

beforeEach(() => {
  fetchMock.mockImplementation(defaultFetchImpl)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

describe('ТЗ-185: таба «МСП» — реестр MCP-токенов', () => {
  it('бейджи трёх статусов с правильными цветами', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())

    const active = screen.getByText('ivan').closest('tr')!.querySelector('[data-status]') as HTMLElement
    expect(active.dataset.status).toBe('active')
    expect(active.style.color).toBe(hexToRgb('#34D399'))

    const revoked = screen.getByText('petr').closest('tr')!.querySelector('[data-status]') as HTMLElement
    expect(revoked.dataset.status).toBe('revoked')
    expect(revoked.style.color).toBe(hexToRgb('#EF4444'))

    const expired = screen.getByText('anna').closest('tr')!.querySelector('[data-status]') as HTMLElement
    expect(expired.dataset.status).toBe('expired')
    expect(expired.style.color).toBe(hexToRgb('#9CA3AF'))
  })

  it('значение токена (token_hash) не отображается, prefix — моноширинным', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())
    expect(screen.queryByText(/secret_hash/)).toBeNull()
    expect(document.body.textContent).not.toContain('secret_hash_123')
    const prefix = screen.getByText('msk_abc1')
    expect(prefix.className).toContain('font-mono')
  })

  it('«Последнее обращение»: «—» для null', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('anna')).not.toBeNull())
    const row = screen.getByText('anna').closest('tr') as HTMLElement
    expect(row.textContent).toContain('—')
  })

  it('кнопка «Отозвать» только у активных токенов', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())

    const activeRow = screen.getByText('ivan').closest('tr') as HTMLElement
    expect(within(activeRow).getByText('Отозвать')).not.toBeNull()
    const revokedRow = screen.getByText('petr').closest('tr') as HTMLElement
    expect(within(revokedRow).queryByText('Отозвать')).toBeNull()
    const expiredRow = screen.getByText('anna').closest('tr') as HTMLElement
    expect(within(expiredRow).queryByText('Отозвать')).toBeNull()
  })

  it('модалка подтверждения: открывается, шлёт POST на верный URL, строка обновляется без перезагрузки', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())

    const activeRow = screen.getByText('ivan').closest('tr') as HTMLElement
    fireEvent.click(within(activeRow).getByText('Отозвать'))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Отозвать токен «CLI-доступ» у ivan@test.ru?')
    expect(dialog.textContent).toContain('сразу потеряет доступ')

    const callsBefore = fetchMock.mock.calls.length
    fireEvent.click(within(dialog).getByText('Отозвать'))

    await waitFor(() => {
      const revokeCall = fetchMock.mock.calls.slice(callsBefore).find(c =>
        String(c[0]).includes('/api/admin/mcp/tokens/t1/revoke'))
      expect(revokeCall).toBeDefined()
      expect((revokeCall![1] as RequestInit).method).toBe('POST')
    })

    // Строка обновилась локально: статус revoked, кнопки отзыва больше нет
    await waitFor(() => {
      const row = screen.getByText('ivan').closest('tr') as HTMLElement
      expect(row.querySelector('[data-status="revoked"]')).not.toBeNull()
      expect(within(row).queryByText('Отозвать')).toBeNull()
    })
    // Модалка закрылась
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('query-параметры фильтров применяются к запросу', async () => {
    setup('/admin/mcp?q=ivan&status=active&sort=requests_count&dir=asc')
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(c =>
        String(c[0]).includes('/api/admin/mcp/tokens?') && String(c[0]).includes('sort='))
      expect(call).toBeDefined()
      const url = new URL(String(call![0]))
      expect(url.searchParams.get('q')).toBe('ivan')
      expect(url.searchParams.get('status')).toBe('active')
      expect(url.searchParams.get('sort')).toBe('requests_count')
      expect(url.searchParams.get('dir')).toBe('asc')
    })
  })

  it('клик по заголовку сортировки переключает направление (dir asc→desc)', async () => {
    setup('/admin/mcp?sort=requests_count&dir=asc')
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /Запросов/ }))
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(c =>
        String(c[0]).includes('/api/admin/mcp/tokens?') && String(c[0]).includes('dir=desc'))
      expect(call).toBeDefined()
    })
  })

  it('сводка: считается из выдачи (активные, запросы, отзывы за 30 дней, истечение за 7 дней)', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())
    // 1 активный токен, 120 запросов у активных, 1 отозван за 30 дней, 0 истекает за 7 дней
    expect(screen.getByText('Активных токенов').parentElement!.textContent).toContain('1')
    expect(screen.getByText('Запросов (активные)').parentElement!.textContent).toContain('120')
    expect(screen.getByText('Отозвано за 30 дней').parentElement!.textContent).toContain('1')
    expect(screen.getByText('Истекает за 7 дней').parentElement!.textContent).toContain('0')
  })

  it('честные пустые состояния: нет токенов вообще / нет активных', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/admin/mcp/tokens')) return jsonResponse({ tokens: [] })
      throw new Error(`Unexpected fetch: ${url}`)
    })
    setup()
    await waitFor(() => expect(screen.getByText('Токенов пока нет')).not.toBeNull())

    cleanup()
    setup('/admin/mcp?status=active')
    await waitFor(() => expect(screen.getByText('Нет активных токенов')).not.toBeNull())
  })

  it('пустое состояние поиска: «Ничего не найдено по запросу»', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('ivan')).not.toBeNull())
    fireEvent.change(screen.getByPlaceholderText(/Поиск/), { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByText(/Ничего не найдено по запросу/)).not.toBeNull())
  })
})

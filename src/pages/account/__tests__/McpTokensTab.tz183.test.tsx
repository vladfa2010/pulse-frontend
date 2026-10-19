// ТЗ-183 Задача 4: секция «API / MCP» в ЛК — управление MCP-токенами.
// fetch мокаем глобально (api-клиент ходит через fetch), ответы — по URL+методу.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import McpTokensTab from '../McpTokensTab'

// useAuth требует AuthProvider — мокаем хук (isAdmin=false; оговорка админа не рендерится).
const useAuthMock = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const activeToken = {
  id: 'tok_1',
  name: 'Claude Desktop',
  prefix: 'pulse-a1b2',
  scopes: ['news', 'calendar'],
  created_at: '2026-10-01T12:00:00',
  expires_at: '2027-03-30T12:00:00',
  last_used_at: '2026-10-18T09:30:00',
  revoked_at: null,
  status: 'active',
}

const revokedToken = {
  id: 'tok_2',
  name: 'Старый агент',
  prefix: 'pulse-x9y8',
  scopes: ['news'],
  created_at: '2026-06-01T12:00:00',
  expires_at: '2026-11-28T12:00:00',
  last_used_at: '2026-08-10T09:30:00',
  revoked_at: '2026-09-01T12:00:00',
  status: 'revoked',
}

const tokensFixture = { tokens: [activeToken, revokedToken], max_active: 5, ttl_days: 180 }

function mockCrud({ createResponse = () => jsonResponse({}, 201) } = {}) {
  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    if (u.endsWith('/api/user/mcp-tokens') && method === 'GET') {
      return jsonResponse(tokensFixture)
    }
    if (u.endsWith('/api/user/mcp-tokens') && method === 'POST') {
      return createResponse()
    }
    if (u.includes('/api/user/mcp-tokens/') && method === 'DELETE') {
      return jsonResponse({ ok: true, id: 'tok_1' })
    }
    return jsonResponse({ error: 'not found' }, 404)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ user: { isAdmin: false } })
  mockCrud()
})

afterEach(() => {
  cleanup()
})

describe('ТЗ-183: секция «API / MCP» (McpTokensTab)', () => {
  it('в списке виден срок истечения (ИБ-1), prefix, дата создания и last_used_at', async () => {
    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText('Claude Desktop')).not.toBeNull())

    // prefix моноширинным (кодом), срок истечения и «использовался» — в одной строке метаданных
    const row = screen.getByText('Claude Desktop').closest('div[style*="background: rgb(10, 10, 10)"]') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.querySelector('code')?.textContent).toContain('pulse-a1b2')
    expect(row.textContent).toContain('создан 01.10.2026')
    expect(row.textContent).toContain('истекает 30.03.2027')
    expect(row.textContent).toContain('использовался: 18.10.2026')
  })

  it('активные первые, отозванные — внизу списка', async () => {
    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText('Старый агент')).not.toBeNull())
    const names = screen
      .getAllByText(/Claude Desktop|Старый агент/)
      .map(el => el.textContent)
    expect(names[0]).toBe('Claude Desktop')
    expect(names[1]).toBe('Старый агент')
  })

  it('модалка создания показывает полный токен ровно один раз', async () => {
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.endsWith('/api/user/mcp-tokens') && method === 'GET') return jsonResponse(tokensFixture)
      if (u.endsWith('/api/user/mcp-tokens') && method === 'POST') {
        return jsonResponse(
          { id: 'tok_3', name: 'Cursor', token: 'pulse-secret-full-token-xyz', expires_at: '2027-04-17T12:00:00' },
          201,
        )
      }
      return jsonResponse({ error: 'not found' }, 404)
    })

    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText('Claude Desktop')).not.toBeNull())

    fireEvent.click(screen.getByText('Создать токен'))
    fireEvent.change(screen.getByPlaceholderText('Мой агент'), { target: { value: 'Cursor' } })
    fireEvent.click(screen.getByText('Создать'))

    // Единоразовый показ: токен + предупреждение + срок жизни 180 дней
    await waitFor(() => expect(screen.getByText('pulse-secret-full-token-xyz')).not.toBeNull())
    expect(screen.getByText(/больше не отобразится/)).not.toBeNull()
    expect(screen.getByText(/Срок жизни токена — 180 дней/)).not.toBeNull()

    // Закрыли — токена больше нет (в списке только prefix, не полный токен)
    fireEvent.click(screen.getByText('Готово'))
    expect(screen.queryByText('pulse-secret-full-token-xyz')).toBeNull()

    // Повторное открытие модалки — снова форма названия, токен не показывается
    fireEvent.click(screen.getByText('Создать токен'))
    expect(screen.getByPlaceholderText('Мой агент')).not.toBeNull()
    expect(screen.queryByText('pulse-secret-full-token-xyz')).toBeNull()
  })

  it('отзыв шлёт DELETE на /api/user/mcp-tokens/:id после подтверждения', async () => {
    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText('Claude Desktop')).not.toBeNull())

    fireEvent.click(screen.getByText('Отозвать'))
    // Сначала — только подтверждение, DELETE ещё не уходил
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)

    fireEvent.click(screen.getByText('Отозвать токен'))
    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
      expect(deleteCall).toBeTruthy()
      expect(String(deleteCall![0])).toContain('/api/user/mcp-tokens/tok_1')
    })
  })

  it('ошибка лимита 5 (409) отображается понятным текстом из поля error', async () => {
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.endsWith('/api/user/mcp-tokens') && method === 'GET') return jsonResponse(tokensFixture)
      if (u.endsWith('/api/user/mcp-tokens') && method === 'POST') {
        return jsonResponse({ error: 'Достигнут лимит: максимум 5 активных токенов' }, 409)
      }
      return jsonResponse({ error: 'not found' }, 404)
    })

    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText('Claude Desktop')).not.toBeNull())

    fireEvent.click(screen.getByText('Создать токен'))
    fireEvent.change(screen.getByPlaceholderText('Мой агент'), { target: { value: 'Шестой агент' } })
    fireEvent.click(screen.getByText('Создать'))

    await waitFor(() =>
      expect(screen.getByText('Достигнут лимит: максимум 5 активных токенов')).not.toBeNull(),
    )
  })

  it('пустое состояние честное: «Токенов нет»', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith('/api/user/mcp-tokens')) {
        return jsonResponse({ tokens: [], max_active: 5, ttl_days: 180 })
      }
      return jsonResponse({ error: 'not found' }, 404)
    })
    render(<McpTokensTab />)
    await waitFor(() => expect(screen.getByText(/Токенов нет/)).not.toBeNull())
  })

  it('админу показывается оговорка об администраторских инструментах', async () => {
    useAuthMock.mockReturnValue({ user: { isAdmin: true } })
    render(<McpTokensTab />)
    await waitFor(() =>
      expect(screen.getByText(/Администраторские инструменты .* доступны по этому токену/)).not.toBeNull(),
    )
  })
})

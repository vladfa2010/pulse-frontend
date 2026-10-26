// TZ-197-club Задача 6 (v2): админ-таба «Клуб» — счётчики в шапке, таблица
// членов, чипы-фильтры по статусу, ручная выдача по email (404 → инлайн-ошибка
// под полем), danger-confirm на исключение (kick) и отзыв ручной выдачи.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import ClubTab from '../ClubTab'

// ─── Моки ────────────────────────────────────────────────────────────────────
const adminApiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const toastMocks = vi.hoisted(() => ({ toast: vi.fn(), toastError: vi.fn() }))

vi.mock('@/lib/api', () => ({
  adminApi: adminApiMocks,
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: toastMocks.toast, toastError: toastMocks.toastError }),
}))

// ─── Фикстуры ────────────────────────────────────────────────────────────────
const MEMBERS = [
  {
    user_id: 'u1', email: 'member@test.ru', username: 'ivan',
    subscription_plan: 'club', subscription_expires_at: '2027-01-01T00:00:00.000Z',
    status: 'member', is_manual: false, manual_revoked_at: null,
    tg_user_id: '777001', invited_at: '2026-10-19T10:00:00.000Z',
    joined_at: '2026-10-20T12:00:00.000Z', kicked_at: null, kick_reason: null,
  },
  {
    user_id: 'u2', email: 'invited@test.ru', username: 'petr',
    subscription_plan: 'plus', subscription_expires_at: '2026-11-01T00:00:00.000Z',
    status: 'invited', is_manual: false, manual_revoked_at: null,
    tg_user_id: null, invited_at: '2026-10-25T10:00:00.000Z',
    joined_at: null, kicked_at: null, kick_reason: null,
  },
  {
    user_id: 'u3', email: 'kicked@test.ru', username: 'anna',
    subscription_plan: 'club', subscription_expires_at: '2026-09-01T00:00:00.000Z',
    status: 'kicked', is_manual: false, manual_revoked_at: null,
    tg_user_id: '777003', invited_at: '2026-08-01T10:00:00.000Z',
    joined_at: '2026-08-02T12:00:00.000Z', kicked_at: '2026-10-01T10:00:00.000Z',
    kick_reason: 'subscription_expired',
  },
  {
    user_id: 'u4', email: 'manual@test.ru', username: 'boss',
    subscription_plan: 'free', subscription_expires_at: null,
    status: 'invited', is_manual: true, manual_revoked_at: null,
    tg_user_id: null, invited_at: '2026-10-26T10:00:00.000Z',
    joined_at: null, kicked_at: null, kick_reason: null,
  },
]

const COUNTERS = { members: 1, invited: 2, kicked: 1, manual: 1 }

const MEMBERS_RESPONSE = { members: MEMBERS, counters: COUNTERS }

const err404 = Object.assign(new Error('user_not_found'), { status: 404, data: { error: 'user_not_found' } })

beforeEach(() => {
  vi.clearAllMocks()
  adminApiMocks.get.mockResolvedValue(MEMBERS_RESPONSE)
  adminApiMocks.post.mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
})

describe('TZ-197-club: админ-таба «Клуб»', () => {
  it('таблица: строки членов + счётчики в шапке', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('member@test.ru')).toBeTruthy())
    expect(screen.getByText('invited@test.ru')).toBeTruthy()
    expect(screen.getByText('kicked@test.ru')).toBeTruthy()
    // Бейдж «ручной» у ручной выдачи
    expect(screen.getByTestId('manual-badge')).toBeTruthy()
    // Счётчики из ответа бэка (тайлы — <p>, чип фильтра — <button>)
    expect(screen.getByText('В канале', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText('Приглашены', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText('Исключены', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText('Ручных выдач', { selector: 'p' })).toBeTruthy()
    // Подсказка-баннер про аудит ручных выдач
    expect(screen.getByText(/Ручная выдача не снимается аудитом/)).toBeTruthy()
  })

  it('чипы-фильтры: «В канале» показывает только member', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('member@test.ru')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'В канале' }))
    expect(screen.getByText('member@test.ru')).toBeTruthy()
    expect(screen.queryByText('invited@test.ru')).toBeNull()
    expect(screen.queryByText('kicked@test.ru')).toBeNull()
  })

  it('чип «Ручные»: только активные ручные выдачи', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('manual@test.ru')).toBeTruthy())
    fireEvent.click(screen.getByText('Ручные'))
    expect(screen.getByText('manual@test.ru')).toBeTruthy()
    expect(screen.queryByText('member@test.ru')).toBeNull()
  })

  it('grant по email: POST /api/admin/club/grant, успех → форма очищается', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('member@test.ru')).toBeTruthy())
    const input = screen.getByLabelText('Email для ручной выдачи')
    fireEvent.change(input, { target: { value: 'new@test.ru' } })
    fireEvent.click(screen.getByText('Выдать доступ'))
    await waitFor(() => expect(adminApiMocks.post).toHaveBeenCalledWith('/api/admin/club/grant', { email: 'new@test.ru' }))
    await waitFor(() => expect(toastMocks.toast).toHaveBeenCalled())
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('grant 404 user_not_found → инлайн-ошибка под полем (не toast)', async () => {
    adminApiMocks.post.mockRejectedValue(err404)
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('member@test.ru')).toBeTruthy())
    const input = screen.getByLabelText('Email для ручной выдачи')
    fireEvent.change(input, { target: { value: 'ghost@test.ru' } })
    fireEvent.click(screen.getByText('Выдать доступ'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Пользователь с таким email не найден')
    })
    expect(toastMocks.toastError).not.toHaveBeenCalled()
  })

  it('kick: danger-confirm → POST /members/:userId/kick', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('member@test.ru')).toBeTruthy())

    const row = screen.getByText('member@test.ru').closest('tr') as HTMLElement
    fireEvent.click(within(row).getByText('Исключить'))

    // Модалка подтверждения: до «Исключить» в ней запрос не уходит
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Исключить из канала?')
    expect(adminApiMocks.post).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByText('Исключить'))
    await waitFor(() =>
      expect(adminApiMocks.post).toHaveBeenCalledWith('/api/admin/club/members/u1/kick', {}),
    )
    await waitFor(() => expect(toastMocks.toast).toHaveBeenCalledWith('member@test.ru исключён из канала'))
  })

  it('revoke-manual: confirm → POST /members/:userId/revoke-manual', async () => {
    render(<ClubTab />)
    await waitFor(() => expect(screen.getByText('manual@test.ru')).toBeTruthy())
    fireEvent.click(screen.getByText('Отозвать ручную выдачу'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Отозвать'))
    await waitFor(() =>
      expect(adminApiMocks.post).toHaveBeenCalledWith('/api/admin/club/members/u4/revoke-manual', {}),
    )
  })
})

// TZ-197-club Задача 7: вкладка «Клуб» в ЛК — пять обязательных состояний
// (ТЗ §7): апсейл без тарифа (цены из /api/plans) / TG не привязан (флоу
// /api/telegram/link + поллинг /user/telegram-status) / получение ссылки /
// «Вы в канале» + выход (confirm) / скелетон + toast-ошибки invite
// (расшифровка telegram_not_connected → состояние 2).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ClubTab from '../ClubTab'

// ─── Моки (vi.hoisted — factory vi.mock поднимается над объявлениями) ────────
const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const toastMocks = vi.hoisted(() => ({ toast: vi.fn(), toastError: vi.fn() }))

vi.mock('@/lib/api', () => ({
  api: apiMocks,
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: toastMocks.toast, toastError: toastMocks.toastError }),
}))

// ─── Фикстуры ────────────────────────────────────────────────────────────────
const CLUB_PLANS = {
  plans: [
    { id: 'plus', name: 'Plus', price: 990, billingFrequency: 'monthly', features: {} },
    { id: 'club', name: 'Клуб', price: 4990, billingFrequency: 'monthly', features: { club_access: true } },
  ],
}

const statusNoTariff = {
  eligible: false, eligibleReason: 'tariff', telegramConnected: false,
  membership: 'none', joinedAt: null, channelUrl: null,
}
const statusNoTg = {
  eligible: true, eligibleReason: 'tariff', telegramConnected: false,
  membership: 'none', joinedAt: null, channelUrl: null,
}
const statusNoInvite = {
  eligible: true, eligibleReason: 'tariff', telegramConnected: true,
  membership: 'none', joinedAt: null, channelUrl: null,
}
const statusMember = {
  eligible: true, eligibleReason: 'tariff', telegramConnected: true,
  membership: 'member', joinedAt: '2026-10-20T12:00:00.000Z',
  channelUrl: 'https://t.me/+clubinvite',
}

const renderClub = () => render(<MemoryRouter><ClubTab /></MemoryRouter>)

// Мутабельный флаг «TG подключён» — поллинг /user/telegram-status и рефетч
// /club/status читают его на каждом вызове мока.
let tgConnected = false

const statusForCurrentTg = () => (tgConnected ? statusNoInvite : statusNoTg)

const errWith = (status: number, error: string) =>
  Object.assign(new Error(error), { status, data: { error } })

beforeEach(() => {
  vi.clearAllMocks()
  tgConnected = false
  apiMocks.get.mockImplementation((path: string) => {
    if (path === '/club/status') return Promise.resolve(statusForCurrentTg())
    if (path === '/plans') return Promise.resolve(CLUB_PLANS)
    if (path === '/telegram/link') return Promise.resolve({ deepLink: 'https://t.me/Insidepulse_bot?start=1:abc' })
    if (path === '/user/telegram-status') return Promise.resolve({ connected: tgConnected })
    return Promise.resolve({})
  })
  apiMocks.post.mockResolvedValue({})
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TZ-197-club: вкладка «Клуб» в ЛК', () => {
  // ── Состояние 5 (частично): скелетон при загрузке ──────────────────────
  it('скелетон при загрузке статуса', () => {
    renderClub()
    expect(screen.getByTestId('club-skeleton')).toBeTruthy()
  })

  // ── Состояние 1: нет тарифа — апсейл с ценой из /api/plans ────────────
  it('апсейл без тарифа: карточка, кнопка на /pricing, цена из /api/plans', async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === '/club/status') return Promise.resolve(statusNoTariff)
      if (path === '/plans') return Promise.resolve(CLUB_PLANS)
      return Promise.resolve({})
    })
    renderClub()
    await waitFor(() => expect(screen.getByText('Закрытый Telegram-канал Клуба')).toBeTruthy())
    const cta = screen.getByText('Смотреть тариф').closest('a')
    expect(cta?.getAttribute('href')).toBe('/pricing')
    // Цена не хардкод: подтянулась из мока /plans (4990)
    await waitFor(() => expect(screen.getByText(/4 990/)).toBeTruthy())
  })

  // ── Состояние 2: тариф есть, TG не привязан ───────────────────────────
  it('TG не привязан: шаг 1, флоу /api/telegram/link + поллинг до подтверждения', async () => {
    renderClub()
    await waitFor(() => expect(screen.getByText('Шаг 1 из 2 — подключите Telegram')).toBeTruthy())

    fireEvent.click(screen.getByText('Подключить Telegram'))
    // Флаг выставляем синхронно: первый check() поллинга отработает на нём
    // сразу после резолва мока /telegram/link (микротаска)
    tgConnected = true
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledWith('/telegram/link'))
    expect(window.open).toHaveBeenCalledWith('https://t.me/Insidepulse_bot?start=1:abc', '_blank', 'noopener')

    // Поллинг увидел connected → рефетч статуса → шаг 2
    await waitFor(() => expect(screen.getByText('Шаг 2 из 2 — получите ссылку в канал')).toBeTruthy())
    expect(toastMocks.toast).toHaveBeenCalledWith('Telegram подключён')
  })

  // ── Состояние 3: TG привязан — получение ссылки ───────────────────────
  it('invite: кнопка «Получить ссылку» → POST /club/invite → ссылка + «Открыть канал»', async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === '/club/status') return Promise.resolve(statusNoInvite)
      if (path === '/plans') return Promise.resolve(CLUB_PLANS)
      if (path === '/user/telegram-status') return Promise.resolve({ connected: tgConnected })
      return Promise.resolve({})
    })
    apiMocks.post.mockResolvedValue({ inviteLink: 'https://t.me/+abcdef123' })
    renderClub()
    await waitFor(() => expect(screen.getByText('Получить ссылку')).toBeTruthy())
    fireEvent.click(screen.getByText('Получить ссылку'))
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/club/invite', {}))
    await waitFor(() => expect(screen.getByText('https://t.me/+abcdef123')).toBeTruthy())
    const openBtn = screen.getByText('Открыть канал').closest('a')
    expect(openBtn?.getAttribute('href')).toBe('https://t.me/+abcdef123')
    expect(openBtn?.getAttribute('rel')).toContain('noopener')
  })

  // ── Состояние 4: в канале — выход с confirm ───────────────────────────
  it('member: статус «Вы в канале», дата вступления, выход через confirm → POST /club/leave', async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === '/club/status') return Promise.resolve(statusMember)
      if (path === '/plans') return Promise.resolve(CLUB_PLANS)
      return Promise.resolve({})
    })
    apiMocks.post.mockResolvedValue({ ok: true })
    renderClub()
    await waitFor(() => expect(screen.getByText('Вы в канале ✅')).toBeTruthy())
    expect(screen.getByText(/Вступили/)).toBeTruthy()
    expect(screen.getByText('Открыть канал')).toBeTruthy()

    fireEvent.click(screen.getByText('Выйти из канала'))
    // Появился danger-confirm — до подтверждения запрос не уходит
    expect(screen.getByText(/Выйти из канала\?/)).toBeTruthy()
    expect(apiMocks.post).not.toHaveBeenCalledWith('/club/leave', {})

    fireEvent.click(screen.getByText('Выйти'))
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/club/leave', {}))
  })

  // ── Состояние 5: ошибка invite → toast + расшифровка telegram_not_connected ──
  it('invite 409 telegram_not_connected → toastError и переход в состояние 2', async () => {
    // Первый /club/status — TG привязан; рефетч после ошибки — привязка потеряна
    let statusCalls = 0
    apiMocks.get.mockImplementation((path: string) => {
      if (path === '/club/status') {
        statusCalls += 1
        return Promise.resolve(statusCalls === 1 ? statusNoInvite : statusNoTg)
      }
      if (path === '/plans') return Promise.resolve(CLUB_PLANS)
      return Promise.resolve({})
    })
    apiMocks.post.mockRejectedValue(errWith(409, 'telegram_not_connected'))
    renderClub()
    await waitFor(() => expect(screen.getByText('Получить ссылку')).toBeTruthy())
    fireEvent.click(screen.getByText('Получить ссылку'))
    await waitFor(() => expect(toastMocks.toastError).toHaveBeenCalled())
    // Рефетч вернул telegramConnected=false → показываем шаг 1
    await waitFor(() => expect(screen.getByText('Шаг 1 из 2 — подключите Telegram')).toBeTruthy())
  })
})

// ТЗ-201 — TagSelectBlockView: блок «Теги портфеля» в уроке.
// Покрытие: гость видит демо-пилюли и по клику получает модалку логина
// (запросов к API нет); юзер видит живой TagPicker.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import TagSelectBlockView from '@/components/education/TagSelectBlockView'

// ─── Моки ────────────────────────────────────────────────────────────────────

const openAuthModal = vi.fn()
const apiGet = vi.fn()
const logAnalyticsEvent = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: (globalThis as any).__isLoggedIn ?? false,
    user: (globalThis as any).__isLoggedIn
      ? { subscription: { plan: 'free', active: false } }
      : null,
    portfolio: (globalThis as any).__isLoggedIn
      ? [{ tag_id: 't1', tag_name: 'Нефть', tag_type: 'trend', enriched: true }]
      : [],
    addTag: vi.fn(),
    removeTag: vi.fn(),
  }),
}))

vi.mock('@/contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ open: openAuthModal }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: (url: string) => apiGet(url),
  },
}))

vi.mock('@/lib/analytics', () => ({
  logAnalyticsEvent: (...args: unknown[]) => logAnalyticsEvent(...args),
  initAnalytics: vi.fn(),
  setAnalyticsUserId: vi.fn(),
  setAnalyticsUserProperties: vi.fn(),
}))

// GlowBlock рендерит BorderGlow (rAF + IntersectionObserver) — в этом файле
// нас интересует только frameless-стилистика карточки и фокус после пробега,
// обёртку мокаем с захватом onSweepEnd
let capturedSweepEnd: (() => void) | undefined
vi.mock('@/components/education/GlowBlock', () => ({
  default: ({ children, onSweepEnd }: { children: React.ReactNode; onSweepEnd?: () => void }) => {
    capturedSweepEnd = onSweepEnd
    return <>{children}</>
  },
}))

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  ;(globalThis as any).__isLoggedIn = false
  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/plans')) return { plans: [{ id: 'free', name: 'Free', tag_limit: 3 }] }
    return {}
  })
})

describe('TagSelectBlockView (ТЗ-201)', () => {
  it('гость: демо-пилюли, клик → модалка логина, запросов к API нет', () => {
    render(
      <MemoryRouter>
        <TagSelectBlockView />
      </MemoryRouter>,
    )
    expect(screen.getByText('Теги портфеля')).toBeTruthy()
    expect(screen.getByText('Дивиденды')).toBeTruthy()
    fireEvent.click(screen.getByText('Дивиденды'))
    expect(openAuthModal).toHaveBeenCalled()
    expect(apiGet).not.toHaveBeenCalled()
    expect(logAnalyticsEvent).toHaveBeenCalledWith('education.tag_block_interaction', { role: 'guest', action: 'demo_click' })
  })

  it('гость: кнопка входа тоже открывает модалку', () => {
    render(
      <MemoryRouter>
        <TagSelectBlockView />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('Войдите, чтобы собрать свои теги'))
    expect(openAuthModal).toHaveBeenCalled()
  })

  it('юзер: живой TagPicker со своими тегами, без демо-пилюль', async () => {
    ;(globalThis as any).__isLoggedIn = true
    render(
      <MemoryRouter>
        <TagSelectBlockView />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Нефть')).toBeTruthy()
    expect(screen.queryByText('Дивиденды')).toBeNull()
    expect(screen.getByLabelText('Поиск тега')).toBeTruthy()
  })

  it('ТЗ-203: glow — карточка во frameless (без своей рамки, фона и отступов)', () => {
    render(
      <MemoryRouter>
        <TagSelectBlockView glow />
      </MemoryRouter>,
    )
    const card = screen.getByText('Теги портфеля').closest('div')!.parentElement as HTMLElement
    expect(card.style.borderStyle).toBe('none')
    expect(card.style.background).toBe('transparent')
    expect(card.style.margin).toBe('0px')
  })

  it('ТЗ-203: без glow — карточка с собственной рамкой (регрессия не сломана)', () => {
    render(
      <MemoryRouter>
        <TagSelectBlockView />
      </MemoryRouter>,
    )
    const card = screen.getByText('Теги портфеля').closest('div')!.parentElement as HTMLElement
    expect(card.style.borderStyle).toBe('solid')
    expect(card.style.borderColor).toBe('rgb(34, 34, 34)')
    expect(card.style.background).toBe('rgb(16, 16, 16)')
  })

  it('ТЗ-203 v2: sweepFocus — после пробега фокус в инпуте поиска', async () => {
    ;(globalThis as any).__isLoggedIn = true
    render(
      <MemoryRouter>
        <TagSelectBlockView glow sweepFocus />
      </MemoryRouter>,
    )
    const input = await screen.findByLabelText('Поиск тега')
    expect(document.activeElement).not.toBe(input)
    capturedSweepEnd?.()
    expect(document.activeElement).toBe(input)
  })

  it('ТЗ-203 v2: без sweepFocus колбэк не фокусирует (редактор не крадёт фокус)', async () => {
    ;(globalThis as any).__isLoggedIn = true
    render(
      <MemoryRouter>
        <TagSelectBlockView glow />
      </MemoryRouter>,
    )
    const input = await screen.findByLabelText('Поиск тега')
    capturedSweepEnd?.()
    expect(document.activeElement).not.toBe(input)
  })
})

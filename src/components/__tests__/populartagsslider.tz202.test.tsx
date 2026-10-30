// ТЗ-202 — PopularTagsSlider: пропсы встраивания variant/limit/autoScroll/
// analyticsSource + заморозка. Дефолты = поведение главной (не меняется).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import PopularTagsSlider from '@/components/PopularTagsSlider'

// ─── Моки ────────────────────────────────────────────────────────────────────

const addTag = vi.fn()
const removeTag = vi.fn()
const openAuthModal = vi.fn()
const logAnalyticsEvent = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: (globalThis as any).__isLoggedIn ?? false,
    portfolio: (globalThis as any).__portfolio ?? [],
    addTag,
    removeTag,
  }),
}))

vi.mock('@/contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ open: openAuthModal }),
}))

vi.mock('@/hooks/usePopularTags', () => ({
  usePopularTags: () => ({
    data: (globalThis as any).__tags ?? [
      { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company', news_count: 42 },
    ],
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/lib/analytics', () => ({
  logAnalyticsEvent: (...args: unknown[]) => logAnalyticsEvent(...args),
  initAnalytics: vi.fn(),
  setAnalyticsUserId: vi.fn(),
  setAnalyticsUserProperties: vi.fn(),
}))

const FROZEN_PORTFOLIO = [
  { tag_id: 't1', tag_name: 'Сбербанк', tag_type: 'company', enriched: true, is_frozen: true },
]

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  ;(globalThis as any).__isLoggedIn = false
  ;(globalThis as any).__portfolio = []
  ;(globalThis as any).__tags = [
    { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company', news_count: 42 },
  ]
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderSlider(props?: Parameters<typeof PopularTagsSlider>[0]) {
  return render(
    <MemoryRouter>
      <PopularTagsSlider {...props} />
    </MemoryRouter>,
  )
}

describe('PopularTagsSlider — варианты (ТЗ-202)', () => {
  it('section (дефолт): главная не изменилась — section-обёртка + заголовок', () => {
    const { container } = renderSlider()
    expect(container.querySelector('section')).toBeTruthy()
    expect(screen.getByText('Популярные теги')).toBeTruthy()
    expect(screen.getByText('Выберите интересующие вас темы')).toBeTruthy()
  })

  it('embedded: без section/контейнера, заголовок «Теги сообщества»', () => {
    const { container } = renderSlider({ variant: 'embedded', autoScroll: false })
    expect(container.querySelector('section')).toBeNull()
    expect(screen.getByText('Теги сообщества')).toBeTruthy()
    expect(screen.queryByText('Популярные теги')).toBeNull()
  })

  it('autoScroll: дефолт ставит интервал 5с, embedded — нет', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    renderSlider()
    await waitFor(() =>
      expect(spy.mock.calls.some(c => c[1] === 5000)).toBe(true))
    spy.mockClear()
    cleanup()
    renderSlider({ variant: 'embedded', autoScroll: false })
    await new Promise(r => setTimeout(r, 50))
    expect(spy.mock.calls.some(c => c[1] === 5000)).toBe(false)
  })
})

describe('PopularTagsSlider — клики и аналитика (ТЗ-202)', () => {
  it('юзер: клик → addTag, аналитика с кастомным source', async () => {
    ;(globalThis as any).__isLoggedIn = true
    addTag.mockResolvedValue({ success: true, tag: { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company' } })
    renderSlider({ variant: 'embedded', autoScroll: false, analyticsSource: 'lesson_block' })
    fireEvent.click(screen.getByText('Nvidia'))
    await waitFor(() => expect(addTag).toHaveBeenCalledWith({ tagId: 'nvda', tagName: 'Nvidia', tagType: 'company' }))
    expect(logAnalyticsEvent).toHaveBeenCalledWith('subscribe_tag',
      expect.objectContaining({ tag_id: 'nvda', source: 'lesson_block' }))
  })

  it('юзер: дефолтный source — popular (главная не меняется)', async () => {
    ;(globalThis as any).__isLoggedIn = true
    addTag.mockResolvedValue({ success: true, tag: { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company' } })
    renderSlider()
    fireEvent.click(screen.getByText('Nvidia'))
    await waitFor(() => expect(logAnalyticsEvent).toHaveBeenCalledWith('subscribe_tag',
      expect.objectContaining({ source: 'popular' })))
  })

  it('гость: клик → модалка логина, addTag не дёргается', () => {
    renderSlider({ variant: 'embedded', autoScroll: false })
    fireEvent.click(screen.getByText('Nvidia'))
    expect(openAuthModal).toHaveBeenCalledWith('login')
    expect(addTag).not.toHaveBeenCalled()
  })

  it('заморозка: карточки перекрыты, addTag не вызывается, плашка видна', () => {
    ;(globalThis as any).__isLoggedIn = true
    ;(globalThis as any).__portfolio = FROZEN_PORTFOLIO
    renderSlider({ variant: 'embedded', autoScroll: false })
    expect(screen.getByText(/тег заморожен/)).toBeTruthy()
    fireEvent.click(screen.getByText('Nvidia'))
    expect(addTag).not.toHaveBeenCalled()
    expect(removeTag).not.toHaveBeenCalled()
  })
})

describe('PopularTagsSlider — switchSignal (ТЗ-203 v2)', () => {
  const isActiveTab = (label: string) =>
    screen.getByText(label).closest('button')!.classList.contains('text-white')

  it('инкремент switchSignal переключает вкладку 24ч → 7д', () => {
    const { rerender } = renderSlider({ variant: 'embedded', autoScroll: false, switchSignal: 0 })
    expect(isActiveTab('24 часа')).toBe(true)
    expect(isActiveTab('7 дней')).toBe(false)
    rerender(
      <MemoryRouter>
        <PopularTagsSlider variant="embedded" autoScroll={false} switchSignal={1} />
      </MemoryRouter>,
    )
    expect(isActiveTab('24 часа')).toBe(false)
    expect(isActiveTab('7 дней')).toBe(true)
  })

  it('выбор юзера не перебивается: выбран «Месяц» — сигнал ничего не меняет', () => {
    const { rerender } = renderSlider({ variant: 'embedded', autoScroll: false, switchSignal: 0 })
    fireEvent.click(screen.getByText('Месяц'))
    expect(isActiveTab('Месяц')).toBe(true)
    rerender(
      <MemoryRouter>
        <PopularTagsSlider variant="embedded" autoScroll={false} switchSignal={1} />
      </MemoryRouter>,
    )
    expect(isActiveTab('Месяц')).toBe(true)
    expect(isActiveTab('7 дней')).toBe(false)
  })

  it('главная (section, без switchSignal) — дефолт 24ч, регрессии нет', () => {
    renderSlider()
    expect(isActiveTab('24 часа')).toBe(true)
  })
})

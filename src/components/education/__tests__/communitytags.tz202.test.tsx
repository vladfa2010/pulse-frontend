// ТЗ-202 — CommunityTagsBlockView: карточка «Теги сообщества» в уроке.
// Покрытие: рендер embedded-слайдера; ошибка /news/tags/popular → null
// (блок скрыт целиком, нет пустой рамки посреди урока).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import CommunityTagsBlockView from '@/components/education/CommunityTagsBlockView'

// ─── Моки ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: false,
    portfolio: [],
    addTag: vi.fn(),
    removeTag: vi.fn(),
  }),
}))

vi.mock('@/contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ open: vi.fn() }),
}))

vi.mock('@/lib/analytics', () => ({
  logAnalyticsEvent: vi.fn(),
  initAnalytics: vi.fn(),
  setAnalyticsUserId: vi.fn(),
  setAnalyticsUserProperties: vi.fn(),
}))

vi.mock('@/hooks/usePopularTags', () => ({
  usePopularTags: () => ({
    data: (globalThis as any).__tags ?? [
      { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company', news_count: 42 },
    ],
    isLoading: false,
    isError: (globalThis as any).__isError ?? false,
  }),
}))

beforeEach(() => {
  cleanup()
  ;(globalThis as any).__isError = false
  ;(globalThis as any).__tags = [
    { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company', news_count: 42 },
  ]
})

function renderBlock() {
  return render(
    <MemoryRouter>
      <CommunityTagsBlockView />
    </MemoryRouter>,
  )
}

describe('CommunityTagsBlockView (ТЗ-202)', () => {
  it('успех: рендерит карточку с embedded-слайдером', () => {
    const { container } = renderBlock()
    expect(container.textContent).toContain('Теги сообщества')
    expect(container.textContent).toContain('Nvidia')
    expect(container.querySelector('section')).toBeNull()
  })

  it('ошибка API → null-рендер (нет пустой карточки)', () => {
    ;(globalThis as any).__isError = true
    const { container } = renderBlock()
    expect(container.firstChild).toBeNull()
  })
})

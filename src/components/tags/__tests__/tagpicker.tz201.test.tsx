// ТЗ-201 — TagPicker: компактный выбор тегов портфеля в блоке урока.
// Покрытие: пилюли портфеля + счётчик лимита, удаление (onChanged),
// блокировка при лимите и при заморозке, добавление через автокомплит.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import TagPicker from '@/components/tags/TagPicker'

// ─── Моки ────────────────────────────────────────────────────────────────────

const addTag = vi.fn()
const removeTag = vi.fn()
const apiGet = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      subscription: { plan: 'free', active: false },
    },
    portfolio: (globalThis as any).__portfolio,
    addTag,
    removeTag,
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: (url: string) => apiGet(url),
  },
}))

vi.mock('@/lib/analytics', () => ({
  logAnalyticsEvent: vi.fn(),
  initAnalytics: vi.fn(),
  setAnalyticsUserId: vi.fn(),
  setAnalyticsUserProperties: vi.fn(),
}))

const PLAN_RESPONSE = { plans: [{ id: 'free', name: 'Free', tag_limit: 3 }] }

const FREE_TAG = { tag_id: 't2', tag_name: 'Сбербанк', tag_type: 'company', enriched: true }
const FROZEN_TAG = { tag_id: 't3', tag_name: 'Газпром', tag_type: 'company', enriched: true, is_frozen: true }

function renderPicker(onChanged?: (action: 'add' | 'remove', tagId: string) => void) {
  return render(
    <MemoryRouter>
      <TagPicker compact onChanged={onChanged} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  ;(globalThis as any).__portfolio = [{ tag_id: 't1', tag_name: 'Нефть', tag_type: 'trend', enriched: true }]
  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/plans')) return PLAN_RESPONSE
    if (url.startsWith('/tags/search')) {
      return { tags: [{ tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company' }] }
    }
    return {}
  })
})

describe('TagPicker (ТЗ-201)', () => {
  it('рендерит пилюли портфеля и счётчик лимита', async () => {
    renderPicker()
    expect(screen.getByText('Нефть')).toBeTruthy()
    expect(await screen.findByText('1/3')).toBeTruthy()
    const input = screen.getByLabelText('Поиск тега') as HTMLInputElement
    expect(input.disabled).toBe(false)
  })

  it('удаление: removeTag + onChanged("remove")', async () => {
    removeTag.mockResolvedValue(true)
    const onChanged = vi.fn()
    renderPicker(onChanged)
    fireEvent.click(screen.getByRole('button', { name: /Remove Нефть/ }))
    await waitFor(() => expect(removeTag).toHaveBeenCalledWith('t1'))
    expect(onChanged).toHaveBeenCalledWith('remove', 't1')
  })

  it('лимит исчерпан: инпут заблокирован + подсказка про тариф', async () => {
    ;(globalThis as any).__portfolio = [FREE_TAG, { ...FREE_TAG, tag_id: 't4', tag_name: 'Лукойл' }, { ...FREE_TAG, tag_id: 't5', tag_name: 'Ростелеком' }]
    renderPicker()
    expect(await screen.findByText('3/3')).toBeTruthy()
    const input = screen.getByLabelText('Поиск тега') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText(/Лимит тегов исчерпан/)).toBeTruthy()
    expect((screen.getByRole('link', { name: /обновите тариф/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/pricing')
  })

  it('замороженный тег: пилюля с замком без удаления, добавление заблокировано', async () => {
    ;(globalThis as any).__portfolio = [FROZEN_TAG]
    renderPicker()
    expect(screen.getByText('Газпром')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Remove Газпром/ })).toBeNull()
    expect(await screen.findByText(/тег заморожен/)).toBeTruthy()
    const input = screen.getByLabelText('Поиск тега') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('добавление: автокомплит → addTag + onChanged("add")', async () => {
    addTag.mockResolvedValue({ success: true, tag: { tag_id: 'nvda', tag_name: 'Nvidia', tag_type: 'company' } })
    const onChanged = vi.fn()
    renderPicker(onChanged)
    const input = screen.getByLabelText('Поиск тега')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'nvid' } })
    const option = await screen.findByText('Nvidia', undefined, { timeout: 1500 })
    fireEvent.mouseDown(option)
    await waitFor(() => expect(addTag).toHaveBeenCalledWith({ tagId: 'nvda', tagName: 'Nvidia', tagType: 'company' }))
    expect(onChanged).toHaveBeenCalledWith('add', 'nvda')
  })
})

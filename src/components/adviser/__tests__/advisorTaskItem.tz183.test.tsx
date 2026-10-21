// ТЗ-183 v6 Задача 6 — строка задачи AdvisorTaskItem:
// чекбокс (оптимистичный PATCH is_done → onChanged), колокольчик (поповер:
// пресеты disabled без due_date, TG-чекбокс disabled без привязки с подсказкой,
// «Выключить напоминание», 400 telegram_not_linked → подсказка), календарь
// (.ics через fetch + Blob с Authorization, фидбек-зелень).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  apiPatch: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { patch: (...args: any[]) => mocks.apiPatch(...args) },
  API_BASE: 'https://pulse.example/api',
  getToken: () => 'test-token',
}))

import AdvisorTaskItem from '@/components/adviser/AdvisorTaskItem'
import type { AdvisorTask } from '@/components/adviser/adviserTypes'

function makeTask(overrides: Partial<AdvisorTask> = {}): AdvisorTask {
  return {
    id: 5,
    title: 'Позвонить до 24.10 — Совет директоров Сбербанк',
    due_date: '2026-10-24',
    is_done: false,
    source_event_id: 'evt-1',
    remind_at: null,
    remind_channels: [],
    created_at: '2026-10-21T10:00:00.000Z',
    ...overrides,
  }
}

describe('AdvisorTaskItem (ТЗ-183 Задача 6)', () => {
  beforeEach(() => {
    mocks.apiPatch.mockReset()
    mocks.apiPatch.mockResolvedValue({})
  })

  afterEach(cleanup)

  it('чекбокс → PATCH is_done и onChanged; оптимистичное зачёркивание', async () => {
    const onChanged = vi.fn()
    const { container } = render(
      <AdvisorTaskItem task={makeTask()} telegramLinked={false} onChanged={onChanged} />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mocks.apiPatch).toHaveBeenCalledWith('/advisor/tasks/5', { is_done: true })
    // Оптимистично: текст зачёркнут сразу, до ответа сервера
    const text = container.querySelector('[style*="line-through"]')
    expect(text).not.toBeNull()
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('ошибка PATCH → зачёркивание откатывается, onChanged не зовётся', async () => {
    mocks.apiPatch.mockRejectedValueOnce(new Error('network'))
    const onChanged = vi.fn()
    const { container } = render(
      <AdvisorTaskItem task={makeTask()} telegramLinked={false} onChanged={onChanged} />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => {
      expect(container.querySelector('[style*="line-through"]')).toBeNull()
    })
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('пресеты напоминания disabled без due_date, доступны с ним', () => {
    render(<AdvisorTaskItem task={makeTask({ due_date: null })} telegramLinked={false} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }))
    const presets = screen.getAllByRole('button').filter(b => b.textContent?.includes('дедлайна'))
    expect(presets.length).toBe(2)
    presets.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true))
  })

  it('пресет «в день дедлайна» → PATCH reminder с 09:00 мск; TG-канал без привязки не включается', async () => {
    render(<AdvisorTaskItem task={makeTask()} telegramLinked={false} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }))
    fireEvent.click(screen.getByText('В день дедлайна, 09:00 (мск)'))
    await waitFor(() => {
      expect(mocks.apiPatch).toHaveBeenCalledWith('/advisor/tasks/5/reminder', {
        remind_at: '2026-10-24T06:00:00.000Z',
        channels: ['email'],
      })
    })
  })

  it('400 telegram_not_linked → подсказка «привяжите Telegram»', async () => {
    mocks.apiPatch.mockRejectedValueOnce(
      Object.assign(new Error('Telegram not linked'), { status: 400, data: { error: 'telegram_not_linked' } }),
    )
    render(<AdvisorTaskItem task={makeTask()} telegramLinked={true} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }))
    fireEvent.click(screen.getByText('В день дедлайна, 09:00 (мск)'))
    await screen.findByText(/привяжите его/i)
  })

  it('заданное напоминание: «Выключить» шлёт remind_at:null; TG-чекбокс disabled без привязки', async () => {
    render(
      <AdvisorTaskItem
        task={makeTask({ remind_at: '2026-10-24T06:00:00.000Z', remind_channels: ['email'] })}
        telegramLinked={false}
        onChanged={() => {}}
      />,
    )
    // Колокольчик подсвечен (акцент) — title показывает момент
    expect(screen.getByRole('button', { name: 'Напоминание' }).getAttribute('title')).toBe('Напомним: 24.10.2026, 09:00 (мск)')
    fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }))
    // TG-чекбокс недоступен без привязки, с подсказкой
    const tg = screen.getByRole('checkbox', { name: /Telegram/ }) as HTMLInputElement
    expect(tg.disabled).toBe(true)
    fireEvent.click(screen.getByText('Выключить напоминание'))
    await waitFor(() => {
      expect(mocks.apiPatch).toHaveBeenCalledWith('/advisor/tasks/5/reminder', { remind_at: null, channels: [] })
    })
  })

  it('.ics: fetch с Authorization → Blob-скачивание', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' })),
    })
    vi.stubGlobal('fetch', fetchMock)
    const createUrl = vi.fn(() => 'blob:mock')
    URL.createObjectURL = createUrl
    URL.revokeObjectURL = vi.fn()
    // jsdom не умеет click по ссылке со скачиванием — глушим навигацию
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<AdvisorTaskItem task={makeTask()} telegramLinked={false} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить в календарь' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('https://pulse.example/api/advisor/tasks/5/ics', {
        headers: { Authorization: 'Bearer test-token' },
      })
    })
    expect(createUrl).toHaveBeenCalled()
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

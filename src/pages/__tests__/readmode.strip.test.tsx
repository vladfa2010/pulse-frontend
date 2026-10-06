// ТЗ-146/149: регрессия — листание читалки идёт программным scrollLeft ленты
// .rm-strip (smooth при листании, instant при перепагинации), НЕ transform.
// CTA «Следующий урок» видна ТОЛЬКО на последней странице; ArrowRight/пробел/
// тап-зона «вперёд» с последней страницы ведут на следующий урок (ТЗ-149).
// transform на любом предке мультиколонки пробивает клипы движков
// (Chromium/WebKit рисуют соседние колонки поверх видимой области).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import ReadMode from '@/components/education/ReadMode'
import type { LessonContent } from '@/lib/educationApi'

// Шпион целевого роута: фиксирует флаг цепочки бесшовного чтения (ТЗ-151)
function ChainSpy() {
  const loc = useLocation()
  return (
    <div
      data-testid="next-lesson-page"
      data-keepreader={String((loc.state as any)?.keepReader === true)}
    />
  )
}

// ─── Моки окружения ──────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom не умеет ResizeObserver (пересчёт пагинации при ресайзе).
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom не реализует Element.scrollTo — листание падает с TypeError.
  const scrollToMock = vi.fn()
  ;(globalThis as any).__scrollToMock = scrollToMock
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollToMock,
  })
  // jsdom отдаёт 0 для clientWidth/scrollWidth — пагинация и листание
  // уходили по раннему return. Эмулируем страницу шириной 600px, 3 страницы.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 600 },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() { return 1800 },
  })
})

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: vi.fn().mockResolvedValue({}) },
}))
// echarts в jsdom не нужен — CandleChart заменяем маркером.
vi.mock('@/components/CandleChart', () => ({
  default: (props: any) => <div data-testid="candle-chart" data-height={props.height} />,
}))

// Читалка рендерится createPortal в document.body — без cleanup порталы
// накапливаются между тестами и портят селекторы.
afterEach(cleanup)

// ─── Хелпер рендера ──────────────────────────────────────────────────────────

const baseProps = {
  lessonId: 'l1',
  title: 'Урок',
  html: '<p>Текст конспекта</p>',
  open: true,
  onClose: () => {},
  page: 1,
  onPageChange: () => {},
  pages: 3,
  onPages: () => {},
  readerScale: 1,
  allVisited: true,
  hasTest: false,
  completed: true,
  canComplete: true,
  onDone: () => {},
  nextLesson: { id: 'l2', position: 2, title: 'Следующий', access: 'ok' } as LessonContent['next_lesson'],
  courseSlug: 'course',
}

function renderReader(extra: Partial<typeof baseProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ReadMode {...baseProps} {...extra} />} />
        <Route path="/education/lesson/l2" element={<ChainSpy />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

describe('ReadMode листание (ТЗ-146)', () => {
  it('листание — scrollTo ленты: smooth к странице, instant при пагинации', async () => {
    renderReader({ page: 2, pages: 3 })

    const strip = document.body.querySelector('.rm-strip') as HTMLElement
    const content = document.body.querySelector('.rm-page .content') as HTMLElement
    expect(strip).toBeTruthy()
    expect(content).toBeTruthy()
    // strip — прямая обёртка .content внутри .rm-page
    expect(strip.parentElement?.classList.contains('rm-page')).toBe(true)
    expect(strip.firstElementChild).toBe(content)

    const scrollToMock = (globalThis as any).__scrollToMock as ReturnType<typeof vi.fn>

    // Листание: scrollTo({left: (page-1)*step, behavior:'smooth'}) на ленте.
    // transform на ленте/контенте не используется (проверено grep-ом критерия §9 —
    // здесь фиксируем поведение: шаг 600px, страница 2 → left 600).
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' })
    }, { timeout: 3000 })
    // Перепагинация восстанавливает позицию мгновенно (instant, без анимации)
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({ left: 600, behavior: 'instant' })
    }, { timeout: 3000 })
    expect(content.style.transform).toBe('')
    expect(strip.style.transform).toBe('')
  })
})

describe('ReadMode CTA «Следующий урок» (ТЗ-149)', () => {
  it('CTA видна только на последней странице', () => {
    const mid = renderReader({ page: 2, pages: 3 })
    expect(mid.container.querySelector('.nl-cta-btn, .nl-cta')).toBeNull()
    mid.unmount()

    renderReader({ page: 3, pages: 3 })
    expect(document.body.querySelector('.nl-cta-btn, .nl-cta')).toBeTruthy()
  })

  it('ArrowRight на последней странице ведёт на следующий урок с флагом цепочки (ТЗ-151)', async () => {
    renderReader({ page: 3, pages: 3 })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="next-lesson-page"]')).toBeTruthy()
    }, { timeout: 3000 })
    expect(document.body.querySelector('[data-testid="next-lesson-page"]')?.getAttribute('data-keepreader'))
      .toBe('true')
  })

  it('тап-зона «вперёд» на последней странице — тот же переход с флагом (ТЗ-151)', async () => {
    renderReader({ page: 3, pages: 3 })
    document.body.querySelector('.rm-tap.next')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="next-lesson-page"]')).toBeTruthy()
    }, { timeout: 3000 })
    expect(document.body.querySelector('[data-testid="next-lesson-page"]')?.getAttribute('data-keepreader'))
      .toBe('true')
  })

  it('ArrowRight НЕ на последней странице листает, а не ведёт на урок', async () => {
    const onPageChange = vi.fn()
    const { container } = renderReader({ page: 1, pages: 3, onPageChange })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await new Promise(r => setTimeout(r, 50))
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(container.querySelector('[data-testid="next-lesson-page"]')).toBeNull()
  })

  it('drip-следующий урок: ArrowRight на последней странице молчит', async () => {
    renderReader({
      page: 3, pages: 3,
      nextLesson: { id: 'l2', position: 2, title: 'Следующий', access: 'drip', unlock_in_days: 5 },
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await new Promise(r => setTimeout(r, 50))
    expect(document.body.querySelector('[data-testid="next-lesson-page"]')).toBeNull()
    // Карточка «через N дн.» на месте (reader-вариант — пилюля .rm-drip)
    expect(document.body.querySelector('.rm-drip')).toBeTruthy()
    expect(document.body.querySelector('.rm-drip')?.textContent).toContain('через 5 дн.')
  })

  it('«Урок засчитан» — заметка под прогресс-баром при переходе completed false→true', async () => {
    const { rerender } = renderReader({ page: 3, pages: 3, completed: false, canComplete: true })
    expect(document.body.querySelector('.rm-note')).toBeNull()
    // Засчитывание: completed false→true (как setRmDone у LessonPage)
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ReadMode {...baseProps} page={3} pages={3} />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(document.body.querySelector('.rm-note')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('статус «Уже пройден ✓» на последней странице вместо кнопки', () => {
    renderReader({ page: 3, pages: 3, completed: true })
    expect(document.body.querySelector('.rm-status')?.textContent).toBe('Уже пройден ✓')
    expect(document.body.querySelector('.rm-done')).toBeNull()
  })
})

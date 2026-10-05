// ТЗ-145: регрессия — transform листания живёт на .rm-strip (обёртка-лента),
// НЕ на мультиколоночном .content. Иначе движки (Chromium/WebKit) не клипуют
// колонки-«продолжения» за границами трансформируемого fragmented-элемента:
// по краям страницы пролезал текст соседних страниц.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ReadMode from '@/components/education/ReadMode'

// ─── Моки окружения ──────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom не умеет ResizeObserver (пересчёт пагинации при ресайзе).
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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

// ─── Тест ────────────────────────────────────────────────────────────────────

const baseProps = {
  lessonId: 'l1',
  title: 'Урок',
  html: '<p>Текст конспекта</p>',
  open: true,
  onClose: () => {},
  onPageChange: () => {},
  onPages: () => {},
  readerScale: 1,
  allVisited: false,
  hasTest: false,
  completed: false,
  canComplete: false,
  onDone: () => {},
}

describe('ReadMode листание (ТЗ-145)', () => {
  it('transform — на .rm-strip, мультиколонка не трансформируется', async () => {
    render(<ReadMode {...baseProps} page={2} pages={3} />)

    const strip = document.body.querySelector('.rm-strip') as HTMLElement
    const content = document.body.querySelector('.rm-page .content') as HTMLElement
    expect(strip).toBeTruthy()
    expect(content).toBeTruthy()
    // strip — прямая обёртка .content внутри .rm-page
    expect(strip.parentElement?.classList.contains('rm-page')).toBe(true)
    expect(strip.firstElementChild).toBe(content)

    // Листание: translateX(-(page-1)*step) на ленте, контент чист
    await waitFor(() => {
      expect(strip.style.transform).toBe('translateX(-600px)')
    }, { timeout: 3000 })
    expect(content.style.transform).toBe('')
    // transition листания тоже задаётся на ленте (§5.3) — в jsdom shorthand
    // `transition` молча дропается (cssstyle), поэтому cssText-проверки тут нет.
  })
})

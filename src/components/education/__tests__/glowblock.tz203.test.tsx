// ТЗ-203 — GlowBlock: обёртка подсветки интерактивных блоков урока.
// Покрытие: enabled=false — children без обёртки; enabled=true — BorderGlow
// (radius 12, фон #101010); prefers-reduced-motion → animated=false.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import GlowBlock from '@/components/education/GlowBlock'

// ─── Моки ────────────────────────────────────────────────────────────────────

const borderGlowProps = vi.fn()

vi.mock('@/components/BorderGlow', () => ({
  default: (props: Record<string, unknown>) => {
    borderGlowProps(props)
    return <div data-testid="border-glow">{props.children as React.ReactNode}</div>
  },
}))

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockMatchMedia(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GlowBlock (ТЗ-203)', () => {
  it('enabled=false — children рендерятся как есть, без BorderGlow', () => {
    const { container } = render(
      <GlowBlock enabled={false}>
        <div data-testid="inner">контент блока</div>
      </GlowBlock>,
    )
    expect(screen.getByTestId('inner')).toBeTruthy()
    expect(screen.queryByTestId('border-glow')).toBeNull()
    // ноль обёрток: inner — прямой ребёнок контейнера
    expect(container.firstElementChild).toBe(screen.getByTestId('inner'))
  })

  it('enabled=true — BorderGlow с radius 12 и фоном карточки урока', () => {
    render(
      <GlowBlock enabled>
        <div data-testid="inner">контент блока</div>
      </GlowBlock>,
    )
    expect(screen.getByTestId('border-glow')).toBeTruthy()
    expect(borderGlowProps).toHaveBeenCalledWith(
      expect.objectContaining({ borderRadius: 12, backgroundColor: '#101010', animated: true }),
    )
  })

  it('prefers-reduced-motion — animated=false (автопробег отключён)', () => {
    mockMatchMedia(true)
    render(
      <GlowBlock enabled>
        <div>контент блока</div>
      </GlowBlock>,
    )
    expect(borderGlowProps).toHaveBeenCalledWith(expect.objectContaining({ animated: false }))
  })

  it('onSweepEnd прокидывается в BorderGlow (ТЗ-203 v2: фокус после пробега)', () => {
    const onSweepEnd = vi.fn()
    render(
      <GlowBlock enabled onSweepEnd={onSweepEnd}>
        <div>контент блока</div>
      </GlowBlock>,
    )
    expect(borderGlowProps).toHaveBeenCalledWith(expect.objectContaining({ onSweepEnd }))
  })
})

// ТЗ-187: деталь-панель сюжета — шапка (title/summary/мета-строка: каскадов ·
// новостей · период), SVG-таймлайн (подписи first_title, полоски каскадов,
// клик → onOpenCluster), список каскадов (сортировка по first_published_at ASC,
// те же клики), состояния null («Сюжет не найден») и undefined (загрузка),
// кнопка закрытия → onClose. Пропсовый компонент — fetch не нужен.
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import StoryDetailPanel from '@/components/cascades/StoryDetailPanel'
import type { Story, StoryCluster } from '@/lib/cascadesApi'

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    cluster_id: 'cl-1',
    size: 5,
    max_sim: 0.9,
    verdict: 'dup',
    tags: [],
    first_published_at: '2026-10-18T08:00:00.000Z',
    last_seen_at: '2026-10-18T12:00:00.000Z',
    first_title: 'Первая новость каскада',
    ...overrides,
  }
}

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    story_id: 'story-1',
    title: 'Ставка ЦБ',
    summary: 'Сводка по сюжету.',
    started_at: '2026-10-18T08:00:00.000Z',
    last_seen_at: '2026-10-20T09:00:00.000Z',
    clusters: [
      makeCluster({ cluster_id: 'cl-1', size: 5, first_title: 'Первый каскад сюжета' }),
      makeCluster({
        cluster_id: 'cl-2',
        size: 3,
        first_title: 'Второй каскад сюжета',
        first_published_at: '2026-10-19T10:00:00.000Z',
        last_seen_at: '2026-10-19T14:00:00.000Z',
      }),
    ],
    ...overrides,
  }
}

const setup = (props: Partial<React.ComponentProps<typeof StoryDetailPanel>> = {}) => {
  const onOpenCluster = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <StoryDetailPanel story={makeStory()} onOpenCluster={onOpenCluster} onClose={onClose} {...props} />,
  )
  return { view, onOpenCluster, onClose }
}

beforeEach(() => vi.useRealTimers())
afterEach(() => cleanup())

describe('ТЗ-187: деталь-панель сюжета', () => {
  it('шапка: title, summary, мета-строка (кластеров · новостей · период)', () => {
    setup()
    expect(screen.getByText('Ставка ЦБ')).not.toBeNull()
    expect(screen.getByText('Сводка по сюжету.')).not.toBeNull()
    // 2 каскада, size 5+3 → «2 каскадов · 8 новостей»
    expect(screen.getByText(/2 каскадов/)).not.toBeNull()
    expect(screen.getByText(/8 новостей/)).not.toBeNull()
  })

  it('SVG-таймлайн: подписи first_title у строк, полоски — rect', () => {
    const { view } = setup()
    // Подпись есть и на таймлайне (SVG text), и в списке — проверяем оба места
    expect(screen.getAllByText('Первый каскад сюжета').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Второй каскад сюжета').length).toBeGreaterThanOrEqual(2)
    const bars = view.container.querySelectorAll('svg rect')
    expect(bars).toHaveLength(2)
  })

  it('first_title null → подпись-эмодаш на таймлайне', () => {
    setup({ story: makeStory({ clusters: [makeCluster({ first_title: null })] }) })
    const svgTexts = screen
      .getAllByText('—')
      .filter((el) => el.tagName.toLowerCase() === 'text')
    expect(svgTexts).toHaveLength(1)
  })

  it('клик по строке таймлайна → onOpenCluster(cluster_id)', () => {
    const { view, onOpenCluster } = setup()
    const rows = view.container.querySelectorAll('svg g.cursor-pointer')
    expect(rows).toHaveLength(2)
    // Сортировка по first_published_at ASC: первая строка — cl-1
    fireEvent.click(rows[0])
    expect(onOpenCluster).toHaveBeenCalledWith('cl-1')
  })

  it('список каскадов: сортировка по first_published_at ASC, клик → onOpenCluster', () => {
    const { onOpenCluster } = setup()
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('нов.'))
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent).toContain('Первый каскад сюжета')
    expect(buttons[1].textContent).toContain('Второй каскад сюжета')
    fireEvent.click(buttons[1])
    expect(onOpenCluster).toHaveBeenCalledWith('cl-2')
  })

  it('story=null → «Сюжет не найден» + крестик закрытия', () => {
    setup({ story: null })
    expect(screen.getByText('Сюжет не найден')).not.toBeNull()
  })

  it('story=undefined → состояние загрузки, без «не найден»', () => {
    setup({ story: undefined })
    expect(screen.getByText('Загрузка сюжета…')).not.toBeNull()
    expect(screen.queryByText('Сюжет не найден')).toBeNull()
  })

  it('у сюжета без кластеров — пустое состояние таймлайна', () => {
    setup({ story: makeStory({ clusters: [] }) })
    expect(screen.getByText(/пока нет каскадов/)).not.toBeNull()
  })

  it('кнопка «Закрыть» → onClose', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Закрыть детали сюжета/ }))
    expect(onClose).toHaveBeenCalled()
  })
})

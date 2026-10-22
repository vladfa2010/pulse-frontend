// ТЗ-191 Задачи 3–8 — доработки модуля advisor по ревью:
// бейдж «N новостей» в карточке (рендер при >0, скрыт при 0, плюрализация),
// upsell «Остался N портфель» (остаток ≤1, скрыт при безлимите, текст при 0,
// пример апгрейда из реальных планов /api/plans), alert-line «Алерт отправлен
// в Telegram» (< 12 ч), модал заметки (danger-кнопка «Удалить заметку» только
// при существующей заметке, клик → onSave('')), плюс хелперы парсеров.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mocks.apiGet(...args) },
}))

import { ClientCard, PortfolioUpsell } from '@/pages/AdviserPage'
import { AdvisorNoteButton } from '@/components/adviser/AdvisorHeaderActions'
import {
  ALERT_WINDOW_MS,
  alertSentRecently,
  eventKind,
  formatNewsCount,
  latestAlertAt,
  parseClientsResponse,
  type AdvisorClient,
  type AdvisorSummaryEntry,
} from '@/components/adviser/adviserTypes'

function makeClient(overrides: Partial<AdvisorClient> = {}): AdvisorClient {
  return {
    id: 1,
    name: 'Иван Петров',
    notes: null,
    is_archived: false,
    sort_order: 0,
    active_tags: 3,
    created_at: '2026-10-01T09:00:00.000Z',
    last_alert_neg_at: null,
    last_alert_pos_at: null,
    tags: [],
    ...overrides,
  }
}

function makeSummary(articlesCount: number): AdvisorSummaryEntry {
  return {
    client_id: 1,
    summary: 'Текст саммари',
    articles_count: articlesCount,
    sentiment_mix: { pos: 40, neg: 10, neu: 50 },
    tags_snapshot: null,
    generated_at: '2026-10-21T08:00:00.000Z',
  }
}

function renderCard(client: AdvisorClient, summary: AdvisorSummaryEntry | undefined) {
  return render(
    <ClientCard
      client={client}
      summary={summary}
      events={[]}
      tasks={[]}
      telegramLinked={false}
      isNew={false}
      refreshing={false}
      cooldownLeftSec={0}
      justUpdated={false}
      kebabOpen={false}
      onToggleKebab={() => {}}
      onOpen={() => {}}
      onRefresh={() => {}}
      onRename={() => {}}
      onArchive={() => {}}
      onRestore={() => {}}
      onSaveNote={() => Promise.resolve()}
      onTaskChanged={() => {}}
    />,
  )
}

describe('formatNewsCount / parseClientsResponse (ТЗ-191 Задачи 3–5)', () => {
  it('плюрализация: 1 новость / 2 новости / 5 новостей / 11 новостей', () => {
    expect(formatNewsCount(1)).toBe('1 новость')
    expect(formatNewsCount(2)).toBe('2 новости')
    expect(formatNewsCount(5)).toBe('5 новостей')
    expect(formatNewsCount(11)).toBe('11 новостей')
    expect(formatNewsCount(22)).toBe('22 новости')
  })

  it('парсит meta.portfolio_limit / active_count и штампы алертов толерантно', () => {
    const { clients, meta } = parseClientsResponse({
      clients: [{ id: 1, name: 'Иван', last_alert_neg_at: '2026-10-21T10:00:00.000Z' }],
      meta: { portfolio_limit: 3, active_count: 2 },
    })
    expect(meta).toEqual({ portfolio_limit: 3, active_count: 2 })
    expect(clients[0].last_alert_neg_at).toBe('2026-10-21T10:00:00.000Z')
    expect(clients[0].last_alert_pos_at).toBeNull()
    // meta ещё нет на сервере — фронт не падает
    const legacy = parseClientsResponse({ clients: [{ id: 2, name: 'Ольга' }], limit: 5 })
    expect(legacy.meta).toEqual({ portfolio_limit: null, active_count: null })
    expect(legacy.limit).toBe(5)
    expect(legacy.clients[0].created_at).toBeNull()
  })

  it('latestAlertAt / alertSentRecently: окно 12 ч', () => {
    const now = Date.parse('2026-10-21T12:00:00.000Z')
    const fresh = makeClient({ last_alert_pos_at: '2026-10-21T02:00:00.000Z' })
    const stale = makeClient({ last_alert_neg_at: '2026-10-20T23:00:00.000Z' })
    const none = makeClient()
    expect(alertSentRecently(fresh, now)).toBe(true)
    expect(alertSentRecently(stale, now)).toBe(false)
    expect(alertSentRecently(none, now)).toBe(false)
    expect(latestAlertAt(makeClient({
      last_alert_neg_at: '2026-10-21T01:00:00.000Z',
      last_alert_pos_at: '2026-10-21T06:00:00.000Z',
    }))).toBe('2026-10-21T06:00:00.000Z')
    expect(ALERT_WINDOW_MS).toBe(12 * 60 * 60 * 1000)
  })

  it('eventKind: СД / Дивиденды / Отчётность / неизвестный тип', () => {
    expect(eventKind('Совет директоров · Сбербанк')?.label).toBe('СД')
    expect(eventKind('Дивиденды · Лукойл')?.label).toBe('Дивиденды')
    expect(eventKind('Отчёт МСФО · Tesla')?.label).toBe('Отчётность')
    expect(eventKind('Вебинар эмитента')).toBeNull()
  })
})

describe('ClientCard — бейдж «N новостей» (ТЗ-191 Задача 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-10-21T12:00:00.000Z')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('рендерится при articles_count > 0 с плюрализацией', () => {
    renderCard(makeClient(), makeSummary(5))
    expect(screen.getByText('5 новостей')).toBeTruthy()
    cleanup()
    renderCard(makeClient(), makeSummary(1))
    expect(screen.getByText('1 новость')).toBeTruthy()
  })

  it('скрыт при articles_count = 0', () => {
    renderCard(makeClient(), makeSummary(0))
    expect(screen.queryByText(/новост(ь|ей|и)$/)).toBeNull()
  })

  it('скрыт без саммари (данные ещё не пришли)', () => {
    renderCard(makeClient(), undefined)
    expect(screen.queryByText(/новост(ь|ей|и)$/)).toBeNull()
  })

  it('бейдж стоит перед заметкой в правом кластере', () => {
    const { container } = renderCard(makeClient(), makeSummary(18))
    const badge = screen.getByText('18 новостей')
    const note = screen.getByRole('button', { name: 'Заметка' })
    const cluster = container.querySelector('.shrink-0.flex.items-center')
    expect(cluster).toBeTruthy()
    const children = Array.from(cluster!.children)
    const badgeIdx = children.indexOf(badge)
    const noteIdx = children.findIndex(el => el.contains(note))
    expect(badgeIdx).toBeGreaterThanOrEqual(0)
    expect(noteIdx).toBeGreaterThan(badgeIdx)
  })
})

describe('ClientCard — alert-line «Алерт отправлен в Telegram» (ТЗ-191 Задача 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-10-21T12:00:00.000Z')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('показывается, когда последний алерт ушёл меньше 12 ч назад', () => {
    renderCard(makeClient({ last_alert_pos_at: '2026-10-21T10:00:00.000Z' }), makeSummary(3))
    expect(screen.getByText(/Алерт отправлен в Telegram/)).toBeTruthy()
  })

  it('скрыт, когда алерт старше 12 ч или не было', () => {
    const { rerender } = render(
      <ClientCard
        client={makeClient({ last_alert_neg_at: '2026-10-20T23:00:00.000Z' })}
        summary={makeSummary(3)}
        events={[]} tasks={[]} telegramLinked={false} isNew={false}
        refreshing={false} cooldownLeftSec={0} justUpdated={false} kebabOpen={false}
        onToggleKebab={() => {}} onOpen={() => {}} onRefresh={() => {}} onRename={() => {}}
        onArchive={() => {}} onRestore={() => {}} onSaveNote={() => Promise.resolve()} onTaskChanged={() => {}}
      />,
    )
    expect(screen.queryByText(/Алерт отправлен в Telegram/)).toBeNull()
    rerender(
      <ClientCard
        client={makeClient()}
        summary={makeSummary(3)}
        events={[]} tasks={[]} telegramLinked={false} isNew={false}
        refreshing={false} cooldownLeftSec={0} justUpdated={false} kebabOpen={false}
        onToggleKebab={() => {}} onOpen={() => {}} onRefresh={() => {}} onRename={() => {}}
        onArchive={() => {}} onRestore={() => {}} onSaveNote={() => Promise.resolve()} onTaskChanged={() => {}}
      />,
    )
    expect(screen.queryByText(/Алерт отправлен в Telegram/)).toBeNull()
  })
})

describe('PortfolioUpsell (ТЗ-191 Задача 4)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
    mocks.apiGet.mockResolvedValue({
      plans: [
        { id: 'club', name: 'Club', price: 1500, portfolioLimit: 5 },
        { id: 'pro', name: 'Pro', price: 2500, portfolioLimit: 20 },
      ],
    })
  })
  afterEach(cleanup)

  it('при остатке 1 — «Остался 1 портфель.» + пример апгрейда из реальных планов', async () => {
    render(<MemoryRouter><PortfolioUpsell limit={3} activeCount={2} /></MemoryRouter>)
    expect(screen.getByText('Остался 1 портфель.')).toBeTruthy()
    // минимальный тариф с лимитом > 3 — Club (5)
    await waitFor(() => expect(screen.getByText(/На Club — до 5 клиентов/)).toBeTruthy())
    const cta = screen.getByRole('link', { name: /Смотреть тарифы/ }) as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('/pricing')
    expect(mocks.apiGet).toHaveBeenCalledWith('/plans')
  })

  it('при остатке 0 — текст «Лимит клиентских портфелей исчерпан»', async () => {
    render(<MemoryRouter><PortfolioUpsell limit={3} activeCount={3} /></MemoryRouter>)
    expect(screen.getByText('Лимит клиентских портфелей исчерпан')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/На Club — до 5 клиентов/)).toBeTruthy())
  })

  it('безлимит (-1) — блок решает родитель; компонент корректно подбирает апгрейд', async () => {
    // Показ блока целиком решает AdviserPage (limit > 0) — здесь проверяем,
    // что при большом лимите апгрейд подбирается строго больше текущего.
    render(<MemoryRouter><PortfolioUpsell limit={20} activeCount={20} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Перейдите на тариф с большим лимитом/)).toBeTruthy())
  })

  it('ошибка /api/plans — блок цел, без примера апгрейда', async () => {
    mocks.apiGet.mockRejectedValue(new Error('network'))
    render(<MemoryRouter><PortfolioUpsell limit={3} activeCount={3} /></MemoryRouter>)
    expect(screen.getByText('Лимит клиентских портфелей исчерпан')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Перейдите на тариф с большим лимитом/)).toBeTruthy())
  })
})

describe('AdvisorNoteButton — удаление заметки (ТЗ-191 Задача 8)', () => {
  afterEach(cleanup)

  it('«Удалить заметку» видна только при существующей заметке; клик → onSave(\'\') и закрытие', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AdvisorNoteButton initial="старая заметка" hasNote onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Заметка' }))
    fireEvent.click(screen.getByText('Удалить заметку'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
    // Модал закрылся — иконка заметки осталась, textarea исчезла
    expect(screen.getByRole('button', { name: 'Заметка' })).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Внутренние пометки/)).toBeNull()
  })

  it('без заметки кнопки удаления нет, подсказка про очистку — есть', () => {
    render(<AdvisorNoteButton initial={null} hasNote={false} onSave={() => Promise.resolve()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Заметка' }))
    expect(screen.queryByText('Удалить заметку')).toBeNull()
    expect(screen.getByText(/Очищенная и сохранённая заметка удаляется\./)).toBeTruthy()
  })
})

// @vitest-environment jsdom
// ТЗ-192 — Adviser: живые теги в карточке клиента.
// Чипы рендерятся из client.tags (текущие advisor_client_tags), не из
// tags_snapshot саммари: правки тегов видны сразу, без регенерации саммари.
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClientCard } from '@/pages/AdviserPage'
import { parseClientsResponse, type AdvisorClient, type AdvisorSummaryEntry } from '@/components/adviser/adviserTypes'

afterEach(cleanup)

function makeClient(overrides: Partial<AdvisorClient> = {}): AdvisorClient {
  return {
    id: 1,
    name: 'Иван Петров',
    notes: null,
    is_archived: false,
    sort_order: 0,
    active_tags: 3,
    created_at: '2026-10-22T09:00:00.000Z',
    last_alert_neg_at: null,
    last_alert_pos_at: null,
    tags: [
      { name: 'Сбербанк', type: 'company' },
      { name: 'Нефть', type: 'sector' },
      { name: 'Трамп', type: 'person' },
    ],
    ...overrides,
  }
}

function makeSummary(tagsSnapshot: AdvisorSummaryEntry['tags_snapshot']): AdvisorSummaryEntry {
  return {
    client_id: 1,
    summary: 'Текст саммари',
    articles_count: 4,
    sentiment_mix: { pos: 40, neg: 10, neu: 50 },
    tags_snapshot: tagsSnapshot,
    generated_at: '2026-10-20T08:00:00.000Z',
  }
}

function renderCard(client: AdvisorClient, summary?: AdvisorSummaryEntry) {
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

describe('ТЗ-192: живые теги в карточке клиента', () => {
  it('чипы рендерятся из client.tags, а не из tags_snapshot', () => {
    // tags_snapshot устаревший (старое имя) — живые теги из client.tags важнее
    renderCard(makeClient(), makeSummary([{ name: 'СТАРЫЙ ТЕГ', type: null }]))
    screen.getByText('Сбербанк')
    screen.getByText('Нефть')
    screen.getByText('Трамп')
    expect(screen.queryByText('СТАРЫЙ ТЕГ')).toBeNull()
  })

  it('нет summary (или пустой tags_snapshot) — живые чипы на месте', () => {
    renderCard(makeClient(), undefined)
    screen.getByText('Сбербанк')
    cleanup()
    renderCard(makeClient(), makeSummary(null))
    screen.getByText('Нефть')
  })

  it('при > 4 тегов — 4 чипа + «+N»', () => {
    renderCard(makeClient({
      active_tags: 6,
      tags: [
        { name: 'Сбербанк', type: 'company' },
        { name: 'Нефть', type: 'sector' },
        { name: 'Трамп', type: 'person' },
        { name: 'AI', type: 'trend' },
        { name: 'Лукойл', type: 'company' },
        { name: 'Газпром', type: 'company' },
      ],
    }))
    screen.getByText('Сбербанк')
    expect(screen.queryByText('Газпром')).toBeNull()
    screen.getByText('+2')
  })

  it('ровно 4 тега — «+N» не показывается', () => {
    renderCard(makeClient({
      tags: [
        { name: 'Сбербанк', type: 'company' },
        { name: 'Нефть', type: 'sector' },
        { name: 'Трамп', type: 'person' },
        { name: 'AI', type: 'trend' },
      ],
    }))
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  it('архивному клиенту чипы не рендерятся', () => {
    renderCard(makeClient({ is_archived: true, active_tags: 3 }))
    expect(screen.queryByText('Сбербанк')).toBeNull()
  })

  it('parseClientsResponse: tags парсятся толерантно (нет поля → [])', () => {
    const { clients } = parseClientsResponse({
      clients: [
        { id: 1, name: 'Иван', tags: [{ name: 'Сбербанк', type: 'company' }, { name: 'x' }] },
        { id: 2, name: 'Ольга' },
      ],
    })
    expect(clients[0].tags).toEqual([{ name: 'Сбербанк', type: 'company' }, { name: 'x', type: null }])
    expect(clients[1].tags).toEqual([])
  })
})

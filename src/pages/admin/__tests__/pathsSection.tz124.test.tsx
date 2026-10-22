// ТЗ-124: секция «Пути пользователей» (PathsSection) — таблица пользователей
// (клик → onSelectUser), RU-лейблы событий, exit-бары с n, цепочки к целям
// (пустая цель → «за период целей не было»), ветвления (% · n=), переключатель
// scope, состояния loading / пусто.
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PathsSection from '../PathsSection'
import type { PathsMetrics } from '../PathsSection'

const basePaths: PathsMetrics = {
  period: 30,
  scope: 'all',
  users: [
    {
      user_id: 'u1',
      email: 'ivan@test.ru',
      username: 'ivan',
      plan: 'pro',
      subscription_active: true,
      last_event_at: '2026-10-21T12:00:00Z',
      last_event_type: 'read_article',
      events_7d: 12,
      events_30d: 40,
      top_event_type: 'login',
      top_transition: { from: 'login', to: 'read_article', count: 5 },
      ltv: 990,
    },
    {
      user_id: 'u2',
      email: '',
      username: 'petr',
      plan: null,
      subscription_active: false,
      last_event_at: null,
      last_event_type: null,
      events_7d: 0,
      events_30d: 1,
      top_event_type: null,
      top_transition: null,
      ltv: 0,
    },
  ],
  exit_points: [
    { event_type: 'read_article', count: 120 },
    { event_type: 'login', count: 30 },
    { event_type: 'other', count: 12 },
  ],
  conversion_paths: [
    { goal: 'payment_completed', path: ['login', 'page_view_plans', 'payment_completed'], count: 8 },
    { goal: 'subscription_cancelled', path: ['login', 'subscription_cancelled'], count: 3 },
  ],
  branching: [
    {
      from: 'login',
      total_out: 120,
      next: [
        { to: 'read_article', count: 54, share: 45 },
        { to: 'other', count: 6, share: 5 },
      ],
    },
  ],
}

const defaultProps = {
  paths: basePaths,
  loading: false,
  period: 30,
  scope: 'all' as const,
  onScopeChange: vi.fn(),
  onSelectUser: vi.fn(),
}

type Props = {
  paths: PathsMetrics | null
  loading: boolean
  period: number
  scope: 'all' | 'functions'
  onScopeChange: (s: 'all' | 'functions') => void
  onSelectUser: (userId: string) => void
}

const setup = (overrides: Partial<Props> = {}) =>
  render(<PathsSection {...defaultProps} {...overrides} />)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ТЗ-124: секция «Пути пользователей»', () => {
  it('таблица рендерит email и RU-лейблы типов событий', () => {
    setup()
    screen.getByText('ivan@test.ru')
    // username как fallback, когда email пуст
    screen.getByText('petr')
    // RU-лейбл последнего события (read_article) и топ-события (login)
    expect(screen.getAllByText('Прочитал новость').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Вход').length).toBeGreaterThanOrEqual(1)
    // бейдж активной подписки
    screen.getByText('активна')
    // LTV отформатирован, 0 — прочерк
    expect(screen.getByText(/990\s?₽/)).not.toBeNull()
    const row2 = screen.getByText('petr').closest('tr') as HTMLElement
    expect(row2.textContent).toContain('—')
  })

  it('клик по строке зовёт onSelectUser с user_id', () => {
    setup()
    const row = screen.getByText('ivan@test.ru').closest('tr') as HTMLElement
    fireEvent.click(row)
    expect(defaultProps.onSelectUser).toHaveBeenCalledWith('u1')
  })

  it('«Куда уходят»: exit-бары с n и сноска про read_article', () => {
    setup()
    screen.getByText('120 · n=120')
    screen.getByText('30 · n=30')
    screen.getByText('12 · n=12')
    screen.getByText(/read_article как точка выхода — норма/)
    screen.getByText(/последнее событие сессии/)
  })

  it('conversion: цепочка «→ · n=» и пустая цель показывает «за период целей не было»', () => {
    setup()
    // Цепочка оплаты: лейблы шагов + счётчик
    screen.getByText('Тарифы')
    screen.getByText('· n=8')
    // Пустая группа (активация подписки) — честное пустое состояние
    const emptyGoal = screen.getByText('за период целей не было')
    expect(emptyGoal).not.toBeNull()
    // Группа отмены отрендерилась со своей цепочкой
    screen.getByText('· n=3')
  })

  it('branching: аккордеон показывает узел и «% · n=», other → «прочее»', () => {
    setup()
    screen.getByText('Вход · 120 исходящих')
    screen.getByText('45% · n=54')
    screen.getByText('5% · n=6')
  })

  it('переключатель scope зовёт onScopeChange', () => {
    setup()
    fireEvent.click(screen.getByText('только функции'))
    expect(defaultProps.onScopeChange).toHaveBeenCalledWith('functions')
  })

  it('состояние loading', () => {
    setup({ paths: null, loading: true })
    screen.getByText('Загрузка...')
  })

  it('пустое состояние: «Недостаточно данных за период»', () => {
    setup({
      paths: {
        period: 30,
        scope: 'all',
        users: [],
        exit_points: [],
        conversion_paths: [],
        branching: [],
      },
    })
    screen.getByText('Недостаточно данных за период')
  })

  it('методологические сноски присутствуют (таблица и ветвления)', () => {
    setup()
    const notes = screen.getAllByText(/Сессия = разрыв ≤30 мин/)
    expect(notes.length).toBeGreaterThanOrEqual(2)
    expect(notes[0].textContent).toContain('Проценты без n не показывать.')
  })
})

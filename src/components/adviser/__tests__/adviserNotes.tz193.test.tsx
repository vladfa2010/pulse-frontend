// @vitest-environment jsdom
// ТЗ-193 — Adviser: заметки клиента (до 5 штук).
// Презентационный AdvisorNotesBlock: лента DESC с метой «12 окт, 14:30» (МСК)
// и «изменено …», добавление (счётчик «N из 5», disabled на лимите, 400
// invalid_note_text не теряет ввод), inline-редактирование (Esc = отмена,
// Ctrl+Enter = сохранить), удаление без confirm (оптимистично + «Заметка удалена»),
// read-only для архивного, парсинг parseClientDetail с notes.
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdvisorNotesBlock, NOTES_LIMIT } from '@/components/adviser/AdvisorNotesBlock'
import { parseClientDetail, type AdvisorNote } from '@/components/adviser/adviserTypes'

afterEach(cleanup)

function makeNote(overrides: Partial<AdvisorNote> = {}): AdvisorNote {
  return {
    id: 1,
    text: 'Консервативный профиль',
    created_at: '2026-10-12T11:30:00.000Z',
    updated_at: null,
    ...overrides,
  }
}

function renderBlock(opts: {
  notes?: AdvisorNote[]
  archived?: boolean
  onAdd?: (text: string) => Promise<void>
  onEdit?: (noteId: number, text: string) => Promise<void>
  onDelete?: (noteId: number) => Promise<void>
} = {}) {
  return render(
    <AdvisorNotesBlock
      notes={opts.notes ?? [makeNote()]}
      archived={opts.archived ?? false}
      onAdd={opts.onAdd ?? (() => Promise.resolve())}
      onEdit={opts.onEdit ?? (() => Promise.resolve())}
      onDelete={opts.onDelete ?? (() => Promise.resolve())}
    />,
  )
}

// Тайзона тестового окружения — UTC: 2026-10-12T11:30:00Z = 14:30 МСК
describe('AdvisorNotesBlock — лента (ТЗ-193)', () => {
  it('рендерит заметки в порядке пропса (DESC) с метой «12 окт, 14:30»', () => {
    renderBlock({
      notes: [
        makeNote({ id: 2, text: 'Свежая заметка', created_at: '2026-10-15T08:00:00.000Z' }),
        makeNote({ id: 1, text: 'Старая заметка', created_at: '2026-10-10T08:00:00.000Z' }),
      ],
    })
    const texts = screen.getAllByText(/заметка$/).map(el => el.textContent)
    expect(texts).toEqual(['Свежая заметка', 'Старая заметка'])
    expect(screen.getByText('15 окт, 11:00')).toBeTruthy()
    expect(screen.getByText('10 окт, 11:00')).toBeTruthy()
  })

  it('whitespace-pre-wrap: многострочный текст рендерится с переносом строки', () => {
    renderBlock({ notes: [makeNote({ text: 'строка один\nстрока два' })] })
    const p = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'строка один\nстрока два')
    expect(p.className).toContain('whitespace-pre-wrap')
  })

  it('«изменено …» показывается, когда updated_at отличается от created_at', () => {
    renderBlock({
      notes: [makeNote({ updated_at: '2026-10-14T09:00:00.000Z' })],
    })
    expect(screen.getByText(/изменено 14 окт, 12:00/)).toBeTruthy()
  })

  it('без заметок — заглушка; у архивного без заметок — read-only заглушка', () => {
    renderBlock({ notes: [] })
    expect(screen.getByText('Заметок пока нет — добавьте первую выше.')).toBeTruthy()
    cleanup()
    renderBlock({ notes: [], archived: true })
    expect(screen.getByText('Заметок нет.')).toBeTruthy()
  })

  it('секция несёт id="notes" для скролла по хэшу', () => {
    const { container } = renderBlock()
    expect(container.querySelector('section#notes')).toBeTruthy()
  })
})

describe('AdvisorNotesBlock — добавление (ТЗ-193)', () => {
  it('textarea с maxlength 2000 и живым счётчиком «0/2000»', () => {
    renderBlock()
    const ta = screen.getByPlaceholderText(/Внутренняя пометка/) as HTMLTextAreaElement
    expect(ta.maxLength).toBe(2000)
    expect(screen.getByText('0/2000')).toBeTruthy()
    fireEvent.change(ta, { target: { value: 'позвонить в пятницу' } })
    expect(screen.getByText('19/2000')).toBeTruthy()
  })

  it('«Добавить» зовёт onAdd с триммированным текстом и очищает поле', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    renderBlock({ notes: [], onAdd })
    fireEvent.change(screen.getByPlaceholderText(/Внутренняя пометка/), { target: { value: '  новая заметка  ' } })
    fireEvent.click(screen.getByText('Добавить'))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('новая заметка'))
    await waitFor(() => expect((screen.getByPlaceholderText(/Внутренняя пометка/) as HTMLTextAreaElement).value).toBe(''))
  })

  it('400 invalid_note_text — подсказка под полем, ввод не теряется', async () => {
    const onAdd = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 400, data: { error: 'invalid_note_text' } }))
    renderBlock({ notes: [], onAdd })
    const ta = screen.getByPlaceholderText(/Внутренняя пометка/)
    fireEvent.change(ta, { target: { value: '   ' } })
    // «Добавить» при пустом trim disabled — отправка через Ctrl+Enter
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(''))
    await screen.findByText('Заметка не должна быть пустой.')
    expect((ta as HTMLTextAreaElement).value).toBe('   ')
  })

  it('пилюля «N из 5»; на лимите поле и кнопка disabled + подсказка', () => {
    renderBlock({ notes: Array.from({ length: NOTES_LIMIT }, (_, i) => makeNote({ id: i + 1 })) })
    expect(screen.getByText('5 из 5')).toBeTruthy()
    expect((screen.getByPlaceholderText(/Внутренняя пометка/) as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByText('Добавить') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Лимит — 5 заметок на клиента')).toBeTruthy()
  })

  it('архивный клиент: поля добавления и иконок нет (read-only)', () => {
    renderBlock({ archived: true })
    expect(screen.queryByPlaceholderText(/Внутренняя пометка/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редактировать заметку' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Удалить заметку' })).toBeNull()
    // сама заметка видна
    expect(screen.getByText('Консервативный профиль')).toBeTruthy()
  })
})

describe('AdvisorNotesBlock — inline-редактирование (ТЗ-193)', () => {
  it('карандаш → textarea с текущим текстом + «Сохранить»/«Отмена»', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    renderBlock({ onEdit })
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать заметку' }))
    const ta = screen.getByDisplayValue('Консервативный профиль')
    expect(ta).toBeTruthy()
    fireEvent.change(ta, { target: { value: '  умеренный профиль  ' } })
    fireEvent.click(screen.getByText('Сохранить'))
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(1, 'умеренный профиль'))
  })

  it('Esc = отмена: textarea исчезает, onEdit не зван', () => {
    const onEdit = vi.fn()
    renderBlock({ onEdit })
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать заметку' }))
    const ta = screen.getByDisplayValue('Консервативный профиль')
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(screen.queryByDisplayValue('Консервативный профиль')).toBeNull()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter = сохранить', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    renderBlock({ onEdit })
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать заметку' }))
    fireEvent.keyDown(screen.getByDisplayValue('Консервативный профиль'), { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(1, 'Консервативный профиль'))
  })

  it('400 invalid_note_text при правке — подсказка под полем, текст сохраняется', async () => {
    const onEdit = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 400, data: { error: 'invalid_note_text' } }))
    renderBlock({ onEdit })
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать заметку' }))
    const ta = screen.getByDisplayValue('Консервативный профиль')
    fireEvent.change(ta, { target: { value: '   ' } })
    // «Сохранить» при пустом trim disabled — отправка через Ctrl+Enter
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(1, ''))
    await screen.findByText('Заметка не должна быть пустой.')
    expect((ta as HTMLTextAreaElement).value).toBe('   ')
  })
})

describe('AdvisorNotesBlock — удаление (ТЗ-193)', () => {
  it('корзина — сразу, без confirm: onDelete зван, заметка исчезает оптимистично, «Заметка удалена»', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderBlock({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить заметку' }))
    // без confirm — window.confirm не переопределяли; заметка скрыта сразу
    expect(screen.queryByText('Консервативный профиль')).toBeNull()
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(1))
    expect(screen.getByText('Заметка удалена')).toBeTruthy()
  })

  it('ошибка удаления — откат: заметка возвращается + сообщение об ошибке', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('Сервер не отвечает'))
    renderBlock({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Удалить заметку' }))
    expect(screen.queryByText('Консервативный профиль')).toBeNull()
    await screen.findByText('Сервер не отвечает')
    expect(screen.getByText('Консервативный профиль')).toBeTruthy()
    // тост не показан — удаления не было
    expect(screen.queryByText('Заметка удалена')).toBeNull()
  })
})

describe('parseClientDetail — notes (ТЗ-193)', () => {
  it('парсит notes толерантно: массив → AdvisorNote[], нет массива → []', () => {
    const full = parseClientDetail({
      client: { id: 7, name: 'Иван', notes_count: 2 },
      tags: [{ id: 3, tag_id: 't1', tag_name: 'Сбербанк', tag_type: 'company' }],
      notes: [
        { id: 11, text: 'первая', created_at: '2026-10-12T11:30:00.000Z', updated_at: null },
        { id: 12, text: 'вторая', created_at: '2026-10-13T11:30:00.000Z', updated_at: '2026-10-14T11:30:00.000Z' },
      ],
      counts: { tags: 1, notes: 2 },
    })
    expect(full.client?.id).toBe(7)
    expect(full.client?.notes_count).toBe(2)
    expect(full.tags).toHaveLength(1)
    expect(full.notes).toEqual([
      { id: 11, text: 'первая', created_at: '2026-10-12T11:30:00.000Z', updated_at: null },
      { id: 12, text: 'вторая', created_at: '2026-10-13T11:30:00.000Z', updated_at: '2026-10-14T11:30:00.000Z' },
    ])

    const empty = parseClientDetail({ client: { id: 8, name: 'Ольга' }, tags: [] })
    expect(empty.notes).toEqual([])
  })

  it('отбрасывает битые записи: без id, без текста, не-объекты', () => {
    const { notes } = parseClientDetail({
      client: { id: 1, name: 'Иван' },
      notes: [
        { id: 0, text: 'без id' },
        { id: 2, text: '' },
        { id: 3, text: 'нормальная' },
        'мусор',
        null,
      ],
    })
    expect(notes).toEqual([{ id: 3, text: 'нормальная', created_at: null, updated_at: null }])
  })
})

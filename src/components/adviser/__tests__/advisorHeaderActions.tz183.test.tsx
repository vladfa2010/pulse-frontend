// ТЗ-183 v6 Задачи 7–8 — иконки шапки (AdvisorHeaderActions):
// заметка: модал с textarea (не prompt), сохранение → onSave, подсветка
// фиолетовым #A78BFA при наличии заметки; копирование: Clipboard API,
// фидбек «Скопировано ✓» на 1,5 с, disabled на саммари-заглушке.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AdvisorCopyButton, AdvisorNoteButton } from '@/components/adviser/AdvisorHeaderActions'

describe('AdvisorNoteButton (ТЗ-183 Задача 7)', () => {
  afterEach(cleanup)

  it('модал с textarea: сохранение триммит текст и зовёт onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AdvisorNoteButton initial="  старый профиль  " hasNote onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Заметка' }))
    const ta = screen.getByPlaceholderText(/Внутренние пометки/)
    expect((ta as HTMLTextAreaElement).value).toBe('  старый профиль  ')
    fireEvent.change(ta, { target: { value: '  консервативный, звонить раз в месяц  ' } })
    fireEvent.click(screen.getByText('Сохранить'))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('консервативный, звонить раз в месяц')
    })
  })

  it('ошибка onSave → модал остаётся открытым с сообщением', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Сервер не отвечает'))
    render(<AdvisorNoteButton initial={null} hasNote={false} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Заметка' }))
    fireEvent.change(screen.getByPlaceholderText(/Внутренние пометки/), { target: { value: 'текст' } })
    fireEvent.click(screen.getByText('Сохранить'))
    await screen.findByText('Сервер не отвечает')
    // Модал не закрылся — textarea на месте
    expect(screen.getByPlaceholderText(/Внутренние пометки/)).toBeTruthy()
  })

  it('подсветка has-note: фиолетовый #A78BFA при заметке, серая без', () => {
    const { rerender } = render(<AdvisorNoteButton initial="x" hasNote onSave={() => Promise.resolve()} />)
    expect(screen.getByRole('button', { name: 'Заметка' }).getAttribute('style')).toContain('rgb(167, 139, 250)')
    rerender(<AdvisorNoteButton initial={null} hasNote={false} onSave={() => Promise.resolve()} />)
    expect(screen.getByRole('button', { name: 'Заметка' }).getAttribute('style')).not.toContain('rgb(167, 139, 250)')
  })
})

describe('AdvisorCopyButton (ТЗ-183 Задача 8)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  afterEach(cleanup)

  it('копирует getText() и показывает «Скопировано ✓»', async () => {
    render(<AdvisorCopyButton getText={() => 'Иван Петров — обзор'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать обзор' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Иван Петров — обзор'))
    await screen.findByTitle('Скопировано ✓')
  })

  it('disabled — не копирует и остаётся полупрозрачной', () => {
    render(<AdvisorCopyButton disabled getText={() => 'x'} />)
    const btn = screen.getByRole('button', { name: 'Скопировать обзор' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('fallback без navigator.clipboard: textarea + execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const exec = vi.fn(() => true)
    document.execCommand = exec
    render(<AdvisorCopyButton getText={() => 'текст'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать обзор' }))
    await waitFor(() => expect(exec).toHaveBeenCalledWith('copy'))
    await screen.findByTitle('Скопировано ✓')
  })
})

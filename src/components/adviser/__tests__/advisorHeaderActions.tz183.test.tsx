// ТЗ-183 v6 Задача 8 — иконка копирования в шапке (AdvisorHeaderActions):
// Clipboard API, фидбек «Скопировано ✓» на 1,5 с, disabled на саммари-заглушке,
// fallback через execCommand, когда navigator.clipboard нет.
// (Тесты модала одиночной заметки удалены вместе с AdvisorNoteButton — ТЗ-193.)
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AdvisorCopyButton } from '@/components/adviser/AdvisorHeaderActions'

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

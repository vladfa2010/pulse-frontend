// ТЗ-159 v3: модал «Импорт из MD» — выбор файла → dry-run превью → подтверждение.
// api мокаем целиком: бэка в тесте нет, проверяем только контракт вызовов.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ImportMdModal from '../ImportMdModal'

const previewMdImport = vi.fn()
const runMdImport = vi.fn()

vi.mock('../api', () => ({
  previewMdImport: (...args: unknown[]) => previewMdImport(...args),
  runMdImport: (...args: unknown[]) => runMdImport(...args),
}))

const preview = {
  dry_run: true as const,
  course_description: { will_update: true as const, chars: 320, current_chars: 154 },
  lessons: [
    {
      position: 1, title: 'Вводный урок', chars: 1200, kind: 'text' as const,
      is_free_preview: true, duration_min: null, buttons_count: 2, test: null,
    },
    {
      position: 2, title: 'Свечи и объём', chars: 3400, kind: 'video_text' as const,
      is_free_preview: false, duration_min: 18, buttons_count: 0,
      test: { questions: 3, pass_score: 80, is_blocking: true },
    },
  ],
  warnings: ['В уроке «Свечи и объём» картинка без внутреннего src пропущена'],
}

const mdFile = new File(['# Вводный урок\n\nТекст'], 'course.md', { type: 'text/markdown' })

function pickFile(container: HTMLElement) {
  const input = container.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [mdFile] } })
}

describe('ImportMdModal (ТЗ-159 v3)', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    previewMdImport.mockResolvedValue(preview)
    runMdImport.mockResolvedValue({
      created: 2, skipped_existing: 0, tests_created: 1, description_updated: true,
      lessons: [], warnings: [],
    })
  })

  it('после выбора файла показывает превью из dry-run', async () => {
    const { container, getByText } = render(
      <ImportMdModal courseId="c-1" open onClose={() => {}} onSaved={() => {}} toast={() => {}} />,
    )
    pickFile(container)
    await waitFor(() => expect(getByText('Вводный урок')).toBeTruthy())
    expect(getByText('Свечи и объём')).toBeTruthy()
    expect(previewMdImport).toHaveBeenCalledWith('c-1', mdFile)
    // плашка замены описания (ТЗ-159 v3)
    expect(getByText(/Описание курса будет заменено из файла/)).toBeTruthy()
    expect(getByText(/320 символов/)).toBeTruthy()
    // warnings из превью видны
    expect(getByText(/картинка без внутреннего src/)).toBeTruthy()
    // кнопка создания активна
    const submit = getByText('Создать 2 урока').closest('button') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
  })

  it('бейджи кнопок и теста в превью', async () => {
    const { container, getByText } = render(
      <ImportMdModal courseId="c-1" open onClose={() => {}} onSaved={() => {}} toast={() => {}} />,
    )
    pickFile(container)
    await waitFor(() => expect(getByText('Создать 2 урока')).toBeTruthy())
    expect(getByText('2 кнопок')).toBeTruthy()
    expect(getByText(/тест: 3 вопросов · порог 80%/)).toBeTruthy()
    expect(getByText(/блокирующий/)).toBeTruthy()
  })

  it('400 с details блокирует submit и показывает ошибки', async () => {
    previewMdImport.mockRejectedValue({
      message: '400: Файл не распознан',
      data: { details: ['Урок "Вводный": buttons — массив из 0–3 кнопок', 'Урок "Тест": у вопроса должен быть ровно один правильный ответ'] },
    })
    const { container, getByText } = render(
      <ImportMdModal courseId="c-1" open onClose={() => {}} onSaved={() => {}} toast={() => {}} />,
    )
    pickFile(container)
    await waitFor(() => expect(getByText(/0–3 кнопок/)).toBeTruthy())
    expect(getByText(/ровно один правильный ответ/)).toBeTruthy()
    const submit = getByText(/Создать/).closest('button') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(runMdImport).not.toHaveBeenCalled()
  })

  it('submit вызывает импорт, тостит успех и закрывает модалку', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const toast = vi.fn()
    const { container, getByText } = render(
      <ImportMdModal courseId="c-1" open onClose={onClose} onSaved={onSaved} toast={toast} />,
    )
    pickFile(container)
    await waitFor(() => expect(getByText('Создать 2 урока')).toBeTruthy())
    fireEvent.click(getByText('Создать 2 урока'))
    await waitFor(() => expect(runMdImport).toHaveBeenCalledWith('c-1', mdFile))
    expect(toast).toHaveBeenCalledWith('Импортировано уроков: 2', 'success')
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('повторная загрузка того же файла: created=0 → info-тост, без success', async () => {
    runMdImport.mockResolvedValue({
      created: 0, skipped_existing: 2, tests_created: 0, description_updated: true,
      lessons: [], warnings: [],
    })
    const toast = vi.fn()
    const { container, getByText } = render(
      <ImportMdModal courseId="c-1" open onClose={() => {}} onSaved={() => {}} toast={toast} />,
    )
    pickFile(container)
    await waitFor(() => expect(getByText('Создать 2 урока')).toBeTruthy())
    fireEvent.click(getByText('Создать 2 урока'))
    await waitFor(() => expect(runMdImport).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith('Все 2 урока уже были созданы ранее (файл загружался)', 'info')
  })
})

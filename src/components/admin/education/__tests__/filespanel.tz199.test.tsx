// ТЗ-199: под-вкладка «Файлы» — галерея storage LMS с привязками и корзиной.
// Рендер сетки/бейджей, копирование пути в clipboard, модалка 409 со списком
// привязок, простой confirm «В корзину?», корзина (restore с подсказкой о
// «сироте» + purge навсегда), клик по бейджу → onOpenCourse.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import FilesPanel from '../FilesPanel'

const fetchFilesMock = vi.fn()
const fetchTrashMock = vi.fn()
const deleteFileMock = vi.fn()
const restoreTrashFileMock = vi.fn()
const purgeTrashFileMock = vi.fn()
const downloadFileMock = vi.fn()

vi.mock('../api', () => ({
  fetchFiles: (...args: unknown[]) => fetchFilesMock(...args),
  fetchTrash: (...args: unknown[]) => fetchTrashMock(...args),
  deleteFile: (...args: unknown[]) => deleteFileMock(...args),
  restoreTrashFile: (...args: unknown[]) => restoreTrashFileMock(...args),
  purgeTrashFile: (...args: unknown[]) => purgeTrashFileMock(...args),
  downloadFile: (...args: unknown[]) => downloadFileMock(...args),
  mediaUrl: (p: string) => `https://cdn.test${p}`,
}))

const usageCover = {
  type: 'course_cover', id: 'c1', title: 'Курс 1',
  course_id: 'c1', course_title: 'Курс 1',
  origin: null, status: null, course_deleted: false,
}
const usageUgc = {
  type: 'material', id: 'm2', title: 'Файл пользователя',
  course_id: 'c1', course_title: 'Курс 1',
  origin: 'user', status: 'pending', course_deleted: false,
}

const filesResponse = {
  files: [
    { path: '/media/courses/aaa.webp', size: 2048, mtime: '2026-10-20T10:00:00.000Z', usages: [usageCover] },
    { path: '/media/ugc/ugc1.pdf', size: 5120, mtime: '2026-10-21T10:00:00.000Z', usages: [usageUgc] },
    { path: '/media/content/orphan.png', size: 1024, mtime: '2026-10-22T10:00:00.000Z', usages: [] },
  ],
  total: 3,
  page: 1,
  pages: 1,
  summary: {
    total: 3, unused: 1, bytes: 8392, trash: 1,
    by_kind: { courses: 1, content: 1, materials: 0, ugc: 1 },
  },
}

const trashResponse = {
  items: [
    {
      trashName: '1698000000000-doc.pdf',
      originalRelPath: '/media/materials/doc.pdf',
      size: 5000,
      mtime: '2026-10-23T10:00:00.000Z',
      deletedAt: '2026-10-23T10:00:00.000Z',
      expiresAt: '2026-11-22T10:00:00.000Z',
      daysLeft: 24,
    },
    // Старая запись до ТЗ-199: манифеста нет — restore недоступен.
    {
      trashName: '1697000000000-legacy.png',
      originalRelPath: null,
      size: 100,
      mtime: '2026-10-11T10:00:00.000Z',
      deletedAt: null,
      expiresAt: null,
      daysLeft: null,
    },
  ],
}

const setup = () => {
  const toasts: Array<{ msg: string; type?: string }> = []
  const props = {
    onOpenCourse: vi.fn(),
    toast: (msg: string, type?: string) => {
      toasts.push({ msg, type })
    },
    toastError: (msg: string) => {
      toasts.push({ msg, type: 'error' })
    },
  }
  const utils = render(<FilesPanel {...props} />)
  return { ...props, ...utils, toasts }
}

const cardOf = (name: string): HTMLElement =>
  screen.getByText(name).closest('.tz199-file-card') as HTMLElement

const err409 = (usages: unknown[]) =>
  Object.assign(new Error(`Файл используется в ${usages.length} местах`), {
    status: 409,
    data: { error: 'conflict', usages },
  })

beforeEach(() => {
  vi.clearAllMocks()
  fetchFilesMock.mockResolvedValue(filesResponse)
  fetchTrashMock.mockResolvedValue(trashResponse)
  deleteFileMock.mockResolvedValue({ ok: true })
  restoreTrashFileMock.mockResolvedValue({ ok: true, path: '/media/materials/doc.pdf', usages_count: 0 })
  purgeTrashFileMock.mockResolvedValue({ ok: true })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
})

describe('ТЗ-199: галерея файлов', () => {
  it('сетка: превью, имя, вес, дата; сводная строка со счётчиками', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('aaa.webp')).not.toBeNull())
    const img = screen.getByAltText('aaa.webp') as HTMLImageElement
    expect(img.src).toBe('https://cdn.test/media/courses/aaa.webp')
    // вес и дата в meta карточки
    const card = cardOf('aaa.webp')
    expect(within(card).getByText('2 КБ')).not.toBeNull()
    // сводная строка (§8.3)
    expect(screen.getByText('файлов')).not.toBeNull()
    expect(screen.getByText('не используются')).not.toBeNull()
    expect(screen.getByText('в корзине')).not.toBeNull()
    // дата в meta карточки (локаль-зависимый формат — допускаем разделители)
    expect(within(card).getByText(/^\d{1,2}[./]\d{1,2}[./]\d{4}$/)).not.toBeNull()
  })

  it('бейджи: обложка/UGC/«Не используется»; клик ведёт в курс', async () => {
    const { onOpenCourse } = setup()
    await waitFor(() => expect(screen.getByText('Обложка: Курс 1')).not.toBeNull())
    expect(screen.getByText('UGC-заявка · на проверке')).not.toBeNull()
    expect(screen.getByText('Не используется')).not.toBeNull()
    fireEvent.click(screen.getByText('Обложка: Курс 1'))
    expect(onOpenCourse).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByText('UGC-заявка · на проверке'))
    expect(onOpenCourse).toHaveBeenCalledWith('c1')
  })

  it('копирование пути: clipboard + тост', async () => {
    const { toasts } = setup()
    await waitFor(() => expect(screen.getByText('aaa.webp')).not.toBeNull())
    fireEvent.click(within(cardOf('aaa.webp')).getByText('Скопировать путь'))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/media/courses/aaa.webp'),
    )
    expect(toasts.some(t => t.msg.includes('Путь скопирован: /media/courses/aaa.webp'))).toBe(true)
  })

  it('скачивание идёт через админ-контур downloadFile (materials/ugc не публичны)', async () => {
    downloadFileMock.mockResolvedValue(undefined)
    setup()
    await waitFor(() => expect(screen.getByText('ugc1.pdf')).not.toBeNull())
    fireEvent.click(within(cardOf('ugc1.pdf')).getByText('Скачать'))
    await waitFor(() => expect(downloadFileMock).toHaveBeenCalledWith('/media/ugc/ugc1.pdf'))
  })

  it('ошибка скачивания → toastError', async () => {
    downloadFileMock.mockRejectedValue(new Error('Скачивание не удалось (HTTP 500)'))
    const { toasts } = setup()
    await waitFor(() => expect(screen.getByText('ugc1.pdf')).not.toBeNull())
    fireEvent.click(within(cardOf('ugc1.pdf')).getByText('Скачать'))
    await waitFor(() => expect(toasts.some(t => t.type === 'error')).toBe(true))
    expect(toasts.find(t => t.type === 'error')?.msg).toContain('Скачивание не удалось')
  })

  it('удаление заюзанного файла: модалка со списком привязок → «Удалить всё равно» (force)', async () => {
    const { toasts } = setup()
    await waitFor(() => expect(screen.getByText('aaa.webp')).not.toBeNull())
    fireEvent.click(within(cardOf('aaa.webp')).getByText('Удалить'))
    // Модалка «Файл используется» со списком привязок (§8.7)
    await waitFor(() => expect(screen.getByText('Файл используется')).not.toBeNull())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Сломается отображение в этих местах/)).not.toBeNull()
    expect(within(dialog).getByText('Обложка: Курс 1')).not.toBeNull()
    fireEvent.click(within(dialog).getByText('Удалить всё равно'))
    await waitFor(() => expect(deleteFileMock).toHaveBeenCalledWith('/media/courses/aaa.webp', true))
    await waitFor(() => expect(toasts.some(t => t.msg === 'Файл в корзине')).toBe(true))
  })

  it('409 от бэка (привязки появились позже листинга) → та же модалка', async () => {
    deleteFileMock.mockRejectedValue(err409([usageCover]))
    setup()
    await waitFor(() => expect(screen.getByText('orphan.png')).not.toBeNull())
    fireEvent.click(within(cardOf('orphan.png')).getByText('Удалить'))
    // usages в листинге пустые → простой confirm; после 409 бэка — модалка привязок.
    await waitFor(() => expect(screen.getByText('В корзину?')).not.toBeNull())
    fireEvent.click(screen.getByText('В корзину'))
    await waitFor(() => expect(screen.getByText('Файл используется')).not.toBeNull())
    expect(within(screen.getByRole('dialog')).getByText('Обложка: Курс 1')).not.toBeNull()
  })

  it('удаление сироты: простой confirm «В корзину?» → delete без force', async () => {
    const { toasts } = setup()
    await waitFor(() => expect(screen.getByText('orphan.png')).not.toBeNull())
    fireEvent.click(within(cardOf('orphan.png')).getByText('Удалить'))
    await waitFor(() => expect(screen.getByText('В корзину?')).not.toBeNull())
    expect(screen.getByText(/автоматически удалён через 30 дней/)).not.toBeNull()
    fireEvent.click(screen.getByText('В корзину'))
    await waitFor(() => expect(deleteFileMock).toHaveBeenCalledWith('/media/content/orphan.png', false))
    expect(toasts.some(t => t.msg === 'Файл в корзине')).toBe(true)
  })

  it('корзина: строки с путём и сроком, restore с подсказкой о «сироте», purge навсегда', async () => {
    const { toasts } = setup()
    await waitFor(() => expect(screen.getByText('aaa.webp')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Корзина/ }))
    await waitFor(() => expect(fetchTrashMock).toHaveBeenCalled())
    expect(screen.getByText('/media/materials/doc.pdf')).not.toBeNull()
    expect(screen.getByText('автоочистка через 24 дн.')).not.toBeNull()
    // Старая запись без манифеста: её кнопка «Восстановить» задизейблена.
    const restoreBtns = screen.getAllByText('Восстановить') as HTMLButtonElement[]
    expect(restoreBtns.length).toBe(2)
    expect(restoreBtns.filter(b => b.disabled).length).toBe(1)

    // Restore: файл вернулся, но записи в БД нет (usages_count=0) → подсказка.
    fireEvent.click(restoreBtns.find(b => !b.disabled)!)
    await waitFor(() => expect(restoreTrashFileMock).toHaveBeenCalledWith('1698000000000-doc.pdf'))
    await waitFor(() => expect(toasts.some(t => t.msg.includes('Восстановлен: /media/materials/doc.pdf'))).toBe(true))
    expect(toasts.some(t => t.msg.includes('сиротой'))).toBe(true)

    // Purge: красный confirm «Безвозвратно» (кнопок «Удалить навсегда» — в строке и в модалке).
    fireEvent.click(screen.getAllByText('Удалить навсегда')[0])
    await waitFor(() => expect(screen.getByText(/Действие безвозвратно/)).not.toBeNull())
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('Удалить навсегда'))
    await waitFor(() => expect(purgeTrashFileMock).toHaveBeenCalledWith('1698000000000-doc.pdf'))
    expect(toasts.some(t => t.msg === 'Удалено навсегда')).toBe(true)
  })

  it('фильтр-сегмент «Обложки» запрашивает kind=courses', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('aaa.webp')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Обложки/ }))
    await waitFor(() =>
      expect(fetchFilesMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'courses', page: 1 }),
      ),
    )
  })
})

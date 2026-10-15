// ТЗ-176: таблицы в RichTextField (TipTap). До фикса схема не включала
// table-расширения — чужой <table> молча выбрасывался при парсинге, и цикл
// «открыть урок с таблицей → сохранить» стирал её из БД.
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react'
import RichTextField from '../RichTextField'

// RTL auto-cleanup в проекте не зарегистрирован — иначе рендеры
// накапливаются между тестами (коллизия title кнопок).
afterEach(cleanup)

const TABLE_HTML =
  '<p>Перед</p><table><thead><tr><th>А</th><th>Б</th></tr></thead>' +
  '<tbody><tr><td>1</td><td>2</td></tr></tbody></table><p>После</p>'

const mount = async (value: string, onChange: (html: string) => void = () => {}) => {
  const view = render(
    <StrictMode>
      <RichTextField value={value} onChange={onChange} />
    </StrictMode>,
  )
  await waitFor(() => {
    expect(view.container.querySelector('.ProseMirror')).toBeTruthy()
  }, { timeout: 3000 })
  return view
}

describe('ТЗ-176: таблицы в редакторе урока', () => {
  it('HTML с таблицей парсится в схему (table не выброшен)', async () => {
    const { container } = await mount(TABLE_HTML)
    const table = container.querySelector('.ProseMirror table')
    expect(table).toBeTruthy()
    expect(table!.querySelectorAll('th').length).toBe(2)
    expect(table!.querySelectorAll('td').length).toBe(2)
  })

  it('round-trip: внешняя смена value с таблицей → onChange отдаёт getHTML с таблицей', async () => {
    const changes: string[] = []
    const view = await mount('<p>Старт</p>', (html: string) => changes.push(html))
    // внешняя смена value (открыт урок с таблицей) → useEffect setContent → onUpdate
    view.rerender(
      <StrictMode>
        <RichTextField value={TABLE_HTML} onChange={(html: string) => changes.push(html)} />
      </StrictMode>,
    )
    await waitFor(() => {
      // TipTap сериализует ячейки как <th><p>А</p></th>; colgroup/min-width
      // из расширения на проде вырезает sanitizeLessonHtml (нет в whitelist).
      expect(changes.some((h) => h.includes('<table') && h.includes('<th>') && h.includes('А'))).toBe(true)
    }, { timeout: 3000 })
  })

  it('тулбар: «Таблица 3×3 с шапкой» вставляет 3×3 с thead', async () => {
    const changes: string[] = []
    const { container, getByTitle } = await mount('<p></p>', (html: string) => changes.push(html))
    fireEvent.click(getByTitle('Таблица 3×3 с шапкой'))
    await waitFor(() => {
      const table = container.querySelector('.ProseMirror table')
      expect(table).toBeTruthy()
      expect(table!.querySelectorAll('tr').length).toBe(3)
      // шапка — первая строка из th (TipTap v3 сериализует её в tbody)
      expect(table!.querySelectorAll('th').length).toBe(3)
    }, { timeout: 3000 })
    expect(changes.some((h) => h.includes('<table') && h.includes('<th>'))).toBe(true)
  })
})

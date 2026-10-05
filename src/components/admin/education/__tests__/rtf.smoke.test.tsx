// Регрессия ТЗ-137-фикс: рендер RichTextField (TipTap) в jsdom.
// Пойманный на проде краш: getHTML() на уничтоженном редакторе в useEffect
// (TipTap v3 уничтожает инстанс асинхронно, гвард !editor недостаточен).
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor } from '@testing-library/react'
import RichTextField from '../RichTextField'

const mount = async (value: string) => {
  const { container } = render(
    <StrictMode>
      <RichTextField value={value} onChange={() => {}} />
    </StrictMode>,
  )
  await waitFor(() => {
    expect(container.querySelector('.ProseMirror')).toBeTruthy()
  }, { timeout: 3000 })
  return container
}

describe('RichTextField smoke', () => {
  it('простой контент', async () => {
    await mount('<p>Привет</p><ul><li>Раз</li></ul><div class="callout"><p>Выноска</p></div>')
  })

  it('с html-блоком', async () => {
    await mount('<p>До</p><div class="html-block"><div style="color:red"><b>Своя вёрстка</b></div></div><p>После</p>')
  })

  it('с картинкой width и таблицей', async () => {
    await mount('<h2>Заголовок</h2><img src="/media/a.webp" width="50%" /><table><tr><td>1</td></tr></table><blockquote>Цитата</blockquote><pre><code>x=1</code></pre><a href="https://example.com">ссылка</a>')
  })

  it('пустое и не-HTML значение', async () => {
    await mount('')
    await mount('Просто текст без тегов\n\nВторой абзац')
  })
})

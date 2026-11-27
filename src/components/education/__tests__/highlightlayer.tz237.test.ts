// @vitest-environment jsdom
/**
 * ТЗ-237 приёмка (блокер F1): painting нескольких хайлайтов в одной текстовой
 * ноде. До фикса splitText первого протухал карту — рисовался только один.
 */
import { describe, it, expect } from 'vitest'
import { paintHighlights } from '@/components/education/HighlightLayer'
import type { Highlight } from '@/lib/educationApi'

function hl(id: string, exact: string, pos = 0): Highlight {
  return {
    id, lesson_id: 'l', lesson_title: '', course_id: 'c', course_slug: 's',
    course_title: '', exact_text: exact, prefix: null, suffix: null,
    pos_hint: pos, note: null, share_token: null, created_at: '',
  }
}

function mount(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('paintHighlights (ТЗ-237, F1)', () => {
  it('два хайлайта в ОДНОМ абзаце — рисуются оба', () => {
    const root = mount('<p>раз два три четыре пять шесть семь восемь девять</p>')
    paintHighlights(root, [hl('a', 'три четыре'), hl('b', 'семь восемь')])
    const marks = root.querySelectorAll('mark.edu-hl')
    expect(marks.length).toBe(2)
    const ids = [...marks].map(m => (m as HTMLElement).dataset.hlId).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('три хайлайта в одной ноде + порядок created_at DESC — все на месте', () => {
    const root = mount('<p>alpha beta gamma delta epsilon zeta</p>')
    paintHighlights(root, [hl('c', 'epsilon'), hl('b', 'gamma'), hl('a', 'alpha')])
    expect(root.querySelectorAll('mark.edu-hl').length).toBe(3)
  })

  it('хайлайт через границу inline-тега — несколько <mark> с одним id', () => {
    const root = mount('<p>до <b>жирный</b> после</p>')
    paintHighlights(root, [hl('x', 'до жирный после')])
    const marks = root.querySelectorAll('mark.edu-hl[data-hl-id="x"]')
    expect(marks.length).toBeGreaterThanOrEqual(2) // диапазон через ноды
    expect(root.textContent).toBe('до жирный после')
  })

  it('orphan (текст не найден) — молча пропускается, остальные рисуются', () => {
    const root = mount('<p>есть только это</p>')
    paintHighlights(root, [hl('gone', 'нет такого'), hl('ok', 'только это')])
    expect(root.querySelectorAll('mark.edu-hl').length).toBe(1)
    expect((root.querySelector('mark') as HTMLElement).dataset.hlId).toBe('ok')
  })

  it('повторный paint идемпотентен (unpaint → paint)', () => {
    const root = mount('<p>раз два три четыре</p>')
    const list = [hl('a', 'раз два'), hl('b', 'три четыре')]
    paintHighlights(root, list)
    paintHighlights(root, list)
    expect(root.querySelectorAll('mark.edu-hl').length).toBe(2)
  })
})

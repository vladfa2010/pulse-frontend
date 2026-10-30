// ТЗ-203 — регрессия: атрибут glow теговых нод сериализуется в data-glow="1"
// при сохранении (renderHTML разворачивает HTMLAttributes) и парсится обратно.
// Баг-репорт: подсветка включалась в превью, но терялась после сохранения —
// renderHTML нод возвращал статический { class } без HTMLAttributes.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { generateHTML, generateJSON } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

// RichTextField тянет @tiptap/react и NodeView-компоненты — мокаем тяжёлые
vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: (comp: unknown) => comp,
  EditorContent: () => null,
  useEditor: () => null,
}))

const { TagSelectBlock, CommunityTagsBlock } = await import(
  '@/components/admin/education/RichTextField'
)

// StarterKit даёт схему doc/text/paragraph (top node) — без него schema не собирается
const EXT = [StarterKit, TagSelectBlock, CommunityTagsBlock]

function docWith(type: string, glow: boolean) {
  return { type: 'doc', content: [{ type, attrs: { glow } }] }
}

describe('ТЗ-203 — сериализация glow теговых нод', () => {
  it('tagSelectBlock: glow=true → data-glow="1" в HTML', () => {
    const html = generateHTML(docWith('tagSelectBlock', true), EXT)
    expect(html).toContain('class="tag-select-block"')
    expect(html).toContain('data-glow="1"')
  })

  it('tagSelectBlock: glow=false → атрибута нет (чистый HTML)', () => {
    const html = generateHTML(docWith('tagSelectBlock', false), EXT)
    expect(html).toContain('class="tag-select-block"')
    expect(html).not.toContain('data-glow')
  })

  it('communityTagsBlock: glow=true → data-glow="1", glow=false → нет', () => {
    const on = generateHTML(docWith('communityTagsBlock', true), EXT)
    expect(on).toContain('class="community-tags-block"')
    expect(on).toContain('data-glow="1"')
    const off = generateHTML(docWith('communityTagsBlock', false), EXT)
    expect(off).not.toContain('data-glow')
  })

  it('round-trip: HTML с data-glow="1" парсится в attrs.glow=true (обе ноды)', () => {
    const tag = generateJSON('<div class="tag-select-block" data-glow="1"></div>', EXT)
    expect((tag.content[0] as { attrs: { glow: boolean } }).attrs.glow).toBe(true)
    const plain = generateJSON('<div class="tag-select-block"></div>', EXT)
    expect((plain.content[0] as { attrs: { glow: boolean } }).attrs.glow).toBe(false)
    const comm = generateJSON('<div class="community-tags-block" data-glow="1"></div>', EXT)
    expect((comm.content[0] as { attrs: { glow: boolean } }).attrs.glow).toBe(true)
  })
})

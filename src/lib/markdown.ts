function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderMarkdown(text: string): string {
  if (!text) return ''

  let html = escapeHtml(text)

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-gray-200 mt-3 mb-1">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold text-gray-100 mt-4 mb-2">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-gray-100 mt-4 mb-2">$1</h1>')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-200">$1</strong>')

  // Lists
  const lines = html.split('\n')
  let inList = false
  const out: string[] = []

  for (const line of lines) {
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (listMatch) {
      if (!inList) {
        out.push('<ul class="list-disc list-inside text-gray-300 space-y-0.5 my-2">')
        inList = true
      }
      out.push(`<li>${listMatch[1]}</li>`)
    } else {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(line)
    }
  }
  if (inList) out.push('</ul>')

  html = out.join('\n')

  // Paragraphs for remaining blocks
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('</ul')
      ) {
        return trimmed
      }
      return `<p class="mb-2">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')

  return html
}

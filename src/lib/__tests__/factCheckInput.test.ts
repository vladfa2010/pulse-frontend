import { describe, it, expect } from 'vitest'
import {
  detectInputType,
  detectFileInputType,
  fileValidationError,
  verdictColor,
  formatFactCheckDate,
  MAX_FILE_SIZE_BYTES,
} from '../factCheckInput'

describe('detectInputType', () => {
  it('http-ссылка → url', () => expect(detectInputType('https://example.com/a?b=1')).toBe('url'))
  it('http-ссылка без path → url', () => expect(detectInputType('http://example.com')).toBe('url'))
  it('обрезает пробелы по краям', () => expect(detectInputType('  https://example.com  ')).toBe('url'))
  it('plain-текст → text', () =>
    expect(detectInputType('ЦБ сохранил ключевую ставку 21%')).toBe('text'))
  it('текст со ссылкой внутри → text (regex — только целиком)', () =>
    expect(detectInputType('см. https://example.com')).toBe('text'))
  it('ссылка с пробелом → text', () =>
    expect(detectInputType('https://example.com/a b')).toBe('text'))
  it('ftp-ссылка → text', () => expect(detectInputType('ftp://example.com')).toBe('text'))
  it('пустая строка → text', () => expect(detectInputType('')).toBe('text'))
})

describe('detectFileInputType', () => {
  it('jpeg/png/webp/gif (регистр не важен) → image', () => {
    expect(detectFileInputType('фото.JPG', 'application/octet-stream')).toBe('image')
    expect(detectFileInputType('img.png', '')).toBe('image')
    expect(detectFileInputType('img.webp', '')).toBe('image')
    expect(detectFileInputType('img.gif', '')).toBe('image')
  })
  it('pdf/doc/docx/txt/md → file', () => {
    expect(detectFileInputType('отчёт.pdf', 'application/pdf')).toBe('file')
    expect(detectFileInputType('doc.docx', '')).toBe('file')
    expect(detectFileInputType('notes.md', '')).toBe('file')
    expect(detectFileInputType('a.txt', 'text/plain')).toBe('file')
  })
  it('image/* по MIME без расширения → image', () =>
    expect(detectFileInputType('blob', 'image/png')).toBe('image'))
  it('неподдерживаемое → null', () => {
    expect(detectFileInputType('archive.zip', 'application/zip')).toBeNull()
    expect(detectFileInputType('song.mp3', 'audio/mpeg')).toBeNull()
    expect(detectFileInputType('noext', '')).toBeNull()
  })
})

describe('fileValidationError', () => {
  it('превышение 8 МБ → сообщение о лимите', () => {
    const err = fileValidationError('big.pdf', MAX_FILE_SIZE_BYTES + 1, 'application/pdf')
    expect(err).toContain('8 МБ')
  })
  it('невалидный тип → сообщение о форматах', () => {
    expect(fileValidationError('a.zip', 100, 'application/zip')).toContain('PDF')
  })
  it('валидный файл → null', () =>
    expect(fileValidationError('a.pdf', 1000, 'application/pdf')).toBeNull())
})

describe('verdictColor', () => {
  it('по label', () => {
    expect(verdictColor('Высокая')).toBe('#34D399')
    expect(verdictColor('Средняя')).toBe('#FBBF24')
    expect(verdictColor('Низкая')).toBe('#F97316')
    expect(verdictColor('Критическая')).toBe('#EF4444')
  })
  it('fallback по score, если label нет', () => {
    expect(verdictColor(undefined, 91)).toBe('#34D399')
    expect(verdictColor(undefined, 58)).toBe('#FBBF24')
    expect(verdictColor(undefined, 34)).toBe('#F97316')
    expect(verdictColor(undefined, 12)).toBe('#EF4444')
  })
  it('нет ни label, ни score → muted', () => expect(verdictColor()).toBe('#6B7280'))
})

describe('formatFactCheckDate', () => {
  it('форматирует в «14 июн»', () =>
    expect(formatFactCheckDate('2026-06-14T12:00:00Z')).toContain('14'))
  it('невалидная дата → пустая строка', () =>
    expect(formatFactCheckDate('not-a-date')).toBe(''))
})

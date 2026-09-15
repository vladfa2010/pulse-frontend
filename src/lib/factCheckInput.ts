/**
 * PULSE — Фактчекинг: чистые хелперы ввода и отображения
 *
 * Используются страницей /factcheck, карточками и модалками.
 * Вынесены отдельно, чтобы покрыть тестами (vitest).
 */

import type { FactCheckInputType } from '@/types/factCheck'

// ─── Лимиты ввода ───────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8 МБ

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md']
const IMAGE_MIME_PREFIX = 'image/'

// ─── Определение типа ввода ─────────────────────────────────────────────────

const URL_REGEX = /^https?:\/\/\S+$/

/** Текст, состоящий ровно из одной ссылки → url, иначе text. */
export function detectInputType(text: string): 'url' | 'text' {
  const trimmed = text.trim()
  return URL_REGEX.test(trimmed) ? 'url' : 'text'
}

function extOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

/**
 * Определяет input_type прикреплённого файла по имени/MIME.
 * Картинки: JPEG/PNG/WebP/GIF. Файлы: PDF/DOC/DOCX/TXT/MD.
 * Неопознанное → null (фронт не отправляет).
 */
export function detectFileInputType(fileName: string, mime: string): 'image' | 'file' | null {
  const ext = extOf(fileName)
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (FILE_EXTENSIONS.includes(ext)) return 'file'
  if (mime.startsWith(IMAGE_MIME_PREFIX)) return 'image'
  return null
}

/** Дружелюбное сообщение о превышении лимита / неподдерживаемом типе. */
export function fileValidationError(fileName: string, size: number, mime: string): string | null {
  if (size > MAX_FILE_SIZE_BYTES) {
    return `Файл больше 8 МБ. Сохраните текст из него и вставьте в поле ввода.`
  }
  if (detectFileInputType(fileName, mime) === null) {
    return 'Поддерживаются картинки (JPEG, PNG, WebP, GIF) и файлы (PDF, DOC, DOCX, TXT, MD).'
  }
  return null
}

// ─── Отображение ────────────────────────────────────────────────────────────

export const INPUT_TYPE_LABELS: Record<FactCheckInputType, string> = {
  text: 'Текст',
  url: 'Ссылка',
  image: 'Картинка',
  file: 'Файл',
}

export const ASSESSMENT_COLORS: Record<string, string> = {
  'Высокая': '#34D399',
  'Средняя': '#FBBF24',
  'Низкая': '#F97316',
  'Критическая': '#EF4444',
}

/** Цвет вердикта: по credibility_label, fallback — по score. */
export function verdictColor(label?: string, score?: number): string {
  if (label && ASSESSMENT_COLORS[label]) return ASSESSMENT_COLORS[label]
  if (typeof score === 'number') {
    if (score >= 70) return '#34D399'
    if (score >= 50) return '#FBBF24'
    if (score >= 30) return '#F97316'
    return '#EF4444'
  }
  return '#6B7280'
}

/** «14 июн» — короткая дата для карточек. Невалидная дата → пустая строка. */
export function formatFactCheckDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
    .format(d)
    .replace('.', '')
}

/** Полная дата для модалки и вкладки «Ваши данные». */
export function formatFactCheckDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// ─── Base64 ─────────────────────────────────────────────────────────────────

/** File → base64 без data:-префикса (контракт бэкенда: file_base64). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      const idx = url.indexOf(',')
      resolve(idx >= 0 ? url.slice(idx + 1) : url)
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

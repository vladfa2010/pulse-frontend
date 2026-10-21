/**
 * ТЗ-183 v6 — браузерные действия модуля advisor:
 * копирование в буфер (с fallback для Safari) и скачивание .ics
 * через fetch + Blob (нужен Authorization-заголовок — НЕ <a href>).
 */

import { API_BASE, getToken } from '@/lib/api'
import type { AdvisorTask } from './adviserTypes'

/**
 * Clipboard API → fallback: временный textarea + execCommand('copy')
 * (старый Safari / небезопасный контекст). true = текст в буфере.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ниже — fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Имя файла из тайтла задачи: безопасные символы, fallback по id */
export function icsFileName(task: AdvisorTask): string {
  const safe = task.title
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${safe || `advisor-task-${task.id}`}.ics`
}

/**
 * GET /api/advisor/tasks/:id/ics → text/calendar → Blob-скачивание.
 * Авторизация только заголовком, поэтому fetch, а не <a href>.
 */
export async function downloadTaskIcs(task: AdvisorTask): Promise<void> {
  const res = await fetch(`${API_BASE}/advisor/tasks/${task.id}/ics`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err: any = new Error(`Ошибка ${res.status}`)
    err.status = res.status
    throw err
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = icsFileName(task)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

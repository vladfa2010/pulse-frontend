/**
 * =============================================================================
 * PULSE Frontend — Safe Storage
 * =============================================================================
 *
 * Единая точка доступа к localStorage с in-memory fallback.
 * Нужен для сред, где localStorage заблокирован (корпоративные политики,
 * Chrome «Блокировать данные сайтов», приватные режимы, часть in-app WebView).
 *
 * В fallback-режиме данные живут только в памяти вкладки и теряются при F5.
 */

const memory = new Map<string, string>()
let available: boolean | null = null

function isAvailable(): boolean {
  if (available !== null) return available
  try {
    const k = '__probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    available = true
  } catch {
    available = false
  }
  return available
}

export const safeStorage = {
  get(key: string): string | null {
    if (isAvailable()) {
      try {
        return localStorage.getItem(key)
      } catch {
        // fallthrough
      }
    }
    return memory.get(key) ?? null
  },

  set(key: string, value: string): void {
    if (isAvailable()) {
      try {
        localStorage.setItem(key, value)
        return
      } catch {
        // fallthrough
      }
    }
    memory.set(key, value)
  },

  remove(key: string): void {
    if (isAvailable()) {
      try {
        localStorage.removeItem(key)
        return
      } catch {
        // fallthrough
      }
    }
    memory.delete(key)
  },

  /** true — используется настоящий localStorage; false — in-memory fallback */
  isPersistent(): boolean {
    return isAvailable()
  },
}

/**
 * =============================================================================
 * PULSE Frontend — API Client
 * =============================================================================
 *
 * Единая точка входа для ВСЕХ запросов к бэкенду.
 *
 * Возможности:
 *   - Автоматически добавляет JWT токен в каждый запрос
 *   - При 401 (сессия истекла) → чистит auth и dispatch событие logout
 *   - Retry: при сетевой ошибке делает 1 повторную попытку через 1 сек (только GET)
 *   - Обработка JSON-ответов
 *
 * Использование:
 *   import { api } from '@/lib/api'
 *   const data = await api.get('/auth/me')
 *   const data = await api.post('/auth/login', { email, password })
 *   const data = await api.delete(`/user/tags/${tagId}`)
 *
 * ⚠️ ВАЖНО: API URL жёстко прописан (не через import.meta.env)
 *   import.meta.env пустой на Render Static Site → запросы уходили в пустоту
 */

import { safeStorage } from './safeStorage'

// API_BASE — жёстко прописан для продакшена
// Для локальной разработки: http://localhost:3001/api
export const API_BASE = 'https://pulse-api-bsov.onrender.com/api'

// ─── Получение токена ─────────────────────────────────────────────────────
function getToken() {
  return safeStorage.get('pulse_token') || ''
}

// ─── Очистка аутентификации при 401 ──────────────────────────────────────
// ВАЖНО: Сначала удаляем токен, ПОТОМ dispatch событие.
// Если наоборот — handleLogout увидит, что токена нет, и проигнорирует событие,
// React state не обновится, и при следующем клике пользователя разлогинит.
function clearAuth() {
  // 1. Сначала удаляем токен — чтобы handleLogout видел, что токена нет
  safeStorage.remove('pulse_token')
  // 2. Потом dispatch — useAuth обновит React state
  window.dispatchEvent(new CustomEvent('auth:logout'))
}

// ═══════════════════════════════════════════════════════════════════════════
// request — базовая функция для HTTP-запросов
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_TIMEOUT_MS = 15_000
const EXTENDED_TIMEOUT_MS = 60_000

async function request(
  method: string,           // GET, POST, PUT, DELETE
  path: string,            // '/auth/login', '/user/tags', ...
  body?: any,              // Тело запроса (для POST/PUT)
  retry = method === 'GET', // Повторная попытка только для GET (идемпотентные)
  timeoutMs = DEFAULT_TIMEOUT_MS // Таймаут текущей попытки
): Promise<any> {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,  // JWT токен
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // ─── 401 Unauthorized ────────────────────────────────────────────
    // Различаем: логин/регистрация (ошибка ввода) vs защищённые endpoint (сессия протухла)
    if (res.status === 401) {
      const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-code', '/auth/reset-password'].includes(path)
      const data = await res.json().catch(() => ({}))
      if (isAuthEndpoint) {
        // Логин/регистрация: 401 = неверный пароль/email — НЕ чистим токен
        throw new Error(data.error || 'Неправильный логин или пароль')
      }
      // Защищённые endpoint: 401 = сессия истекла — чистим токен
      clearAuth()
      throw new Error(data.error || 'Сессия истекла. Пожалуйста, войдите снова.')
    }

    // ─── 429 Too Many Requests ───────────────────────────────────────
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '15'
      const data = await res.json().catch(() => ({}))
      const err: any = new Error(data.error || `Слишком много запросов. Попробуйте через ${retryAfter} сек.`)
      err.status = 429
      err.retryAfter = data.retry_after || parseInt(retryAfter, 10) || 15
      throw err
    }

    // ─── Ошибка сервера (4xx, 5xx) ────────────────────────────────────
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err: any = new Error(data.message || data.error || `Ошибка ${res.status}`)
      err.status = res.status
      throw err
    }

    // ─── Успех → парсим JSON ──────────────────────────────────────────
    return res.status === 204 ? null : res.json()

  } catch (err) {
    clearTimeout(timeoutId)
    // ─── Таймаут ─────────────────────────────────────────────────────
    // AbortError — таймаут запроса. Для GET делаем одну повторную попытку
    // с увеличенным таймаутом, чтобы пережить медленные деплой-окна бэкенда.
    if (err instanceof Error && err.name === 'AbortError') {
      if (retry) {
        await new Promise(r => setTimeout(r, 1000))  // Ждём 1 сек
        return request(method, path, body, false, EXTENDED_TIMEOUT_MS) // Повтор с extended timeout
      }
      const e: any = new Error('Сервер не отвечает. Проверьте интернет и попробуйте снова.')
      e.isTransportError = true
      throw e
    }
    // ─── Сетевая ошибка (offline, DNS, CORS) → retry ─────────────────
    // TypeError = fetch не смог выполнить запрос (сеть, CORS, DNS)
    if (retry && err instanceof TypeError) {
      await new Promise(r => setTimeout(r, 1000))  // Ждём 1 сек
      return request(method, path, body, false)     // Повтор без retry
    }
    // ─── Повторный TypeError (retry исчерпан) — тоже транспорт ──────
    if (err instanceof TypeError) {
      (err as any).isTransportError = true
    }
    throw err  // Пробрасываем ошибку дальше (useAuth покажет сообщение)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Экспорт удобных методов
// ═══════════════════════════════════════════════════════════════════════════
export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
  put: (path: string, body: any) => request('PUT', path, body),
  patch: (path: string, body: any) => request('PATCH', path, body),
  delete: (path: string) => request('DELETE', path),
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin API (root path, NOT /api prefix)
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_BASE = 'https://pulse-api-bsov.onrender.com'

async function adminRequest(method: string, path: string, body?: any): Promise<any> {
  const url = `${ADMIN_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
  }
  if (body) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '15'
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.message || data.error || `Слишком много запросов. Попробуйте через ${retryAfter} сек.`)
      ;(err as any).status = 429
      throw err
    }
    if (res.status === 401) {
      clearAuth()
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || data.error || 'Admin access required')
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err: any = new Error(data.message || data.error || `Ошибка ${res.status}`)
      err.errors = data.errors || null
      err.status = res.status
      throw err
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      const e: any = new Error('Сервер не отвечает. Проверьте интернет и попробуйте снова.')
      e.isTransportError = true
      throw e
    }
    throw err
  }
}

export const adminApi = {
  get: (path: string) => adminRequest('GET', path),
  post: (path: string, body: any) => adminRequest('POST', path, body),
  put: (path: string, body: any) => adminRequest('PUT', path, body),
  patch: (path: string, body: any) => adminRequest('PATCH', path, body),
  delete: (path: string) => adminRequest('DELETE', path),
  /**
   * POST multipart/form-data (TZ70: upload mp3-треков радио). FormData передаётся
   * как есть — Content-Type НЕ ставим руками: браузер сам добавит boundary.
   * Таймаут увеличен до 120 с: файл до 50 МБ на медленном аплинке.
   * Ошибки бэка (413/400/409) пробрасываются с кодом в err.code.
   */
  postForm: async (path: string, formData: FormData): Promise<any> => {
    const url = `${ADMIN_BASE}${path}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 401) {
        clearAuth()
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Admin access required')
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err: any = new Error(data.message || data.error || `Ошибка ${res.status}`)
        err.status = res.status
        err.code = data.error || null
        err.reason = data.reason || null
        throw err
      }
      return res.json()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        const e: any = new Error('Загрузка заняла слишком много времени. Попробуйте снова.')
        e.isTransportError = true
        throw e
      }
      throw err
    }
  },
  /**
   * POST, возвращающий бинарный ответ (Blob) — например mp3-превью голоса
   * (ТЗ68). Обрабатывает 401/429/прочие ошибки так же, как adminRequest.
   */
  postBlob: async (path: string, body: any): Promise<Blob> => {
    const url = `${ADMIN_BASE}${path}`
    // Превью TTS до 1000 символов может генерироваться до ~30 сек — таймаут
    // больше дефолтного 15s общего adminRequest.
    const BLOB_TIMEOUT_MS = 60_000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BLOB_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 401) {
        clearAuth()
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Admin access required')
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const err: any = new Error(data.message || data.error || `Ошибка ${res.status}`)
        err.status = res.status
        err.code = data.error || null
        throw err
      }
      return await res.blob()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof TypeError) {
        const e: any = new Error('Сервер не отвечает. Проверьте интернет и попробуйте снова.')
        e.isTransportError = true
        throw e
      }
      throw err
    }
  },
}

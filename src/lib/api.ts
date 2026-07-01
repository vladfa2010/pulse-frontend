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
 *   - Retry: при сетевой ошибке делает 1 повторную попытку через 1 сек
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

// API_BASE — жёстко прописан для продакшена
// Для локальной разработки: http://localhost:3001/api
const API_BASE = 'https://pulse-api-bsov.onrender.com/api'

// ─── Получение токена из localStorage ─────────────────────────────────────
function getToken() {
  return localStorage.getItem('pulse_token') || ''
}

// ─── Очистка аутентификации при 401 ──────────────────────────────────────
// ВАЖНО: Сначала dispatch событие (useAuth проверит токен), ПОТОМ удаляем токен.
// Это предотвращает race condition когда пользователь только что залогинился.
function clearAuth() {
  // 1. Dispatch event FIRST — useAuth увидит и проверит localStorage
  window.dispatchEvent(new CustomEvent('auth:logout'))
  // 2. Then remove token — useAuth уже принял решение
  localStorage.removeItem('pulse_token')
}

// ═══════════════════════════════════════════════════════════════════════════
// request — базовая функция для HTTP-запросов
// ═══════════════════════════════════════════════════════════════════════════
async function request(
  method: string,           // GET, POST, PUT, DELETE
  path: string,            // '/auth/login', '/user/tags', ...
  body?: any,              // Тело запроса (для POST/PUT)
  retry = true             // Разрешить повторную попытку при ошибке
): Promise<any> {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,  // JWT токен
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    // ─── 401 Unauthorized ────────────────────────────────────────────
    // Различаем: логин/регистрация (ошибка ввода) vs защищённые endpoint (сессия протухла)
    if (res.status === 401) {
      const isAuthEndpoint = path === '/auth/login' || path === '/auth/register'
      const data = await res.json().catch(() => ({}))
      if (isAuthEndpoint) {
        // Логин/регистрация: 401 = неверный пароль/email — НЕ чистим токен
        throw new Error(data.error || 'Неправильный логин или пароль')
      }
      // Защищённые endpoint: 401 = сессия истекла — чистим токен
      clearAuth()
      throw new Error(data.error || 'Сессия истекла. Пожалуйста, войдите снова.')
    }

    // ─── Ошибка сервера (4xx, 5xx) ────────────────────────────────────
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Ошибка ${res.status}`)
    }

    // ─── Успех → парсим JSON ──────────────────────────────────────────
    return res.status === 204 ? null : res.json()

  } catch (err) {
    // ─── Сетевая ошибка (offline, timeout) → retry ────────────────────
    // TypeError = fetch не смог выполнить запрос (сеть, CORS, DNS)
    if (retry && err instanceof TypeError) {
      await new Promise(r => setTimeout(r, 1000))  // Ждём 1 сек
      return request(method, path, body, false)     // Повтор без retry
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

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 401) {
    clearAuth()
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Admin access required')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err: any = new Error(data.error || `Ошибка ${res.status}`)
    err.errors = data.errors || null
    err.status = res.status
    throw err
  }
  return res.json()
}

export const adminApi = {
  get: (path: string) => adminRequest('GET', path),
  post: (path: string, body: any) => adminRequest('POST', path, body),
  put: (path: string, body: any) => adminRequest('PUT', path, body),
  delete: (path: string) => adminRequest('DELETE', path),
}

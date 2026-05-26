// API Base URL — жёстко прописан для продакшена
// Для локальной разработки: http://localhost:3000/api
const API_BASE = 'https://pulse-api-bsov.onrender.com/api'

function getToken() {
  return localStorage.getItem('pulse_token') || ''
}

function clearAuth() {
  // 1. Dispatch event FIRST so useAuth can check token before it's removed
  window.dispatchEvent(new CustomEvent('auth:logout'))
  // 2. Then remove token — useAuth will have already decided
  localStorage.removeItem('pulse_token')
}

async function request(method: string, path: string, body?: any, retry = true): Promise<any> {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
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

    if (res.status === 401) {
      clearAuth()
      throw new Error('Сессия истекла. Пожалуйста, войдите снова.')
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Ошибка ${res.status}`)
    }

    return res.status === 204 ? null : res.json()
  } catch (err) {
    if (retry && err instanceof TypeError) {
      await new Promise(r => setTimeout(r, 1000))
      return request(method, path, body, false)
    }
    throw err
  }
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
  put: (path: string, body: any) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
}

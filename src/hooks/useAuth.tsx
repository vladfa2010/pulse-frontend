/**
 * =============================================================================
 * PULSE Frontend — Auth Context (useAuth)
 * =============================================================================
 *
 * Центральный хук управления аутентификацией.
 * Хранит состояние: user, isLoggedIn, portfolio (теги пользователя).
 *
 * Архитектура:
 *   - React Context API (данные доступны во всём приложении)
 *   - JWT токен хранится ТОЛЬКО в localStorage (ключ: 'pulse_token')
 *   - Всё остальное (user, теги) — на бэкенде (PostgreSQL)
 *
 * Проблема: Race Condition (ИСПРАВЛЕНО)
 *   При загрузке страницы useEffect шлёт GET /auth/me (проверка старого токена).
 *   Если пользователь быстро вводит логин/пароль — login() сохраняет НОВЫЙ токен.
 *   Старый запрос возвращается с 401 и НЕ должен стирать новый токен.
 *
 * Решение:
 *   - Запоминаем токен на момент старта запроса (tokenAtStart)
 *   - При 401: стираем localStorage ТОЛЬКО если токен не изменился
 *   - api.ts: dispatch 'auth:logout' ДО удаления токена (useAuth проверяет)
 */

import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'

// ─── Типы данных ──────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  isVerified: boolean
  isAdmin: boolean
  subscription: {
    active: boolean
    expiresAt: string | null
    autoRenew: boolean
  }
}

export interface PortfolioTag {
  id: string
  tag_id: string
  tag_name: string
  tag_type: string
}

// Интерфейс контекста — что доступно через useAuth()
interface AuthCtx {
  user: User | null           // Данные пользователя (null = не вошёл)
  isLoggedIn: boolean         // Упрощённая проверка
  isLoading: boolean          // Идёт инициализация (показываем спиннер)
  portfolio: PortfolioTag[]   // Теги пользователя (портфель)
  tagVersion: number          // Инкрементируется при изменении тегов
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loadPortfolio: () => Promise<void>
  addTag: (tag: { tagId: string; tagName: string; tagType: string }) => Promise<{ success: boolean; error?: string }>
  removeTag: (tagId: string) => Promise<boolean>
  refreshUser: () => Promise<void>
}

// Создаём React Context (глобальное хранилище для auth)
const AuthContext = createContext<AuthCtx | null>(null)

// ═══════════════════════════════════════════════════════════════════════════
// AuthProvider — обёртка для всего приложения (в main.tsx)
// ═══════════════════════════════════════════════════════════════════════════
export function AuthProvider({ children }: { children: ReactNode }) {
  // ─── Состояние ────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)  // true = проверяем токен
  const [portfolio, setPortfolio] = useState<PortfolioTag[]>([])
  const [tagVersion, setTagVersion] = useState(0)

  // ═══════════════════════════════════════════════════════════════════════
  // Эффект 1: Инициализация при загрузке страницы (F5)
  // ═══════════════════════════════════════════════════════════════════════
  // Проверяем: есть ли токен в localStorage? Валиден ли он?
  // Если да — восстанавливаем сессию без повторного ввода пароля.
  useEffect(() => {
    const tokenAtStart = localStorage.getItem('pulse_token')
    if (!tokenAtStart) {
      setIsLoading(false)  // Нет токена — сразу показываем "Войти"
      return
    }

    // Запрашиваем данные пользователя по токену
    api.get('/auth/me')
      .then(data => {
        // RACE CONDITION FIX: проверяем, не залогинился ли пользователь
        // пока шёл этот запрос (токен мог измениться)
        const currentToken = localStorage.getItem('pulse_token')
        if (currentToken !== tokenAtStart) return  // Игнорируем — устаревший запрос

        if (data.user) {
          setUser(mapUser(data.user))
          setIsLoggedIn(true)
          // Загружаем портфель в фоне (не блокируем UI)
          api.get('/user/tags').then(d => {
            setPortfolio(d.tags || [])
          }).catch(() => setPortfolio([]))
        }
      })
      .catch(() => {
        // RACE CONDITION FIX: чистим localStorage ТОЛЬКО если токен не изменился
        const currentToken = localStorage.getItem('pulse_token')
        if (currentToken === tokenAtStart) {
          localStorage.removeItem('pulse_token')
        }
      })
      .finally(() => {
        setIsLoading(false)  // Инициализация завершена
      })
  }, [])  // [] = выполняется один раз при монтировании

  // ═══════════════════════════════════════════════════════════════════════
  // Эффект 2: Слушаем событие 401 logout от api.ts
  // ═══════════════════════════════════════════════════════════════════════
  // Когда api.ts получает 401 — он dispatch 'auth:logout' CustomEvent.
  // Мы слушаем это событие и обновляем React state.
  useEffect(() => {
    const handleLogout = () => {
      // Только если токена НЕТ — иначе это ложное срабатывание
      if (localStorage.getItem('pulse_token')) return
      setUser(null)
      setPortfolio([])
      setIsLoggedIn(false)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  // ─── Загрузка портфеля (тегов) с бэкенда ────────────────────────────
  const loadPortfolio = useCallback(async () => {
    try {
      const data = await api.get('/user/tags')
      setPortfolio(data.tags || [])
    } catch {
      setPortfolio([])
    }
  }, [])

  // ─── Добавление тега ────────────────────────────────────────────────
  const addTag = useCallback(async (tag: { tagId: string; tagName: string; tagType: string }) => {
    try {
      const data = await api.post('/user/tags', tag)
      if (data.tag) {
        setPortfolio(prev => [...prev, data.tag])
        setTagVersion(v => v + 1)  // инвалидируем кэш каруселей
        return { success: true }
      }
      return { success: false, error: 'Unknown error' }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to add tag',
      }
    }
  }, [])

  // ─── Удаление тега ──────────────────────────────────────────────────
  const removeTag = useCallback(async (tagId: string) => {
    try {
      await api.delete(`/user/tags/${tagId}`)
      setPortfolio(prev => prev.filter(t => t.tag_id !== tagId))
      setTagVersion(v => v + 1)  // инвалидируем кэш каруселей
      return true
    } catch {
      return false
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // Логин ────────────────────────────────────────────────────────────────
  // 1. Шлём email/password на бэкенд
  // 2. Получаем JWT токен → сохраняем в localStorage
  // 3. Загружаем данные пользователя и портфель
  // ═══════════════════════════════════════════════════════════════════════
  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('pulse_token', data.token)  // Сохраняем токен
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      await loadPortfolio()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Неправильный логин или пароль' }
    }
  }, [loadPortfolio])

  // ─── Регистрация ────────────────────────────────────────────────────
  const register = useCallback(async (username: string, email: string, password: string) => {
    try {
      const data = await api.post('/auth/register', { username, email, password })
      localStorage.setItem('pulse_token', data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      setPortfolio([])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка регистрации' }
    }
  }, [])

  // ─── Обновление данных пользователя (после оплаты и т.д.) ───────────
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me')
      if (data.user) {
        setUser(mapUser(data.user))
      }
    } catch {
      // ignore — не логируем ошибку, это опциональный вызов
    }
  }, [])

  // ─── Выход ──────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('pulse_token')  // Удаляем токен
    setUser(null)
    setPortfolio([])
    setIsLoggedIn(false)
  }, [])

  // ─── Провайдер — делает данные доступными всему приложению ──────────
  return (
    <AuthContext.Provider value={{
      user, isLoggedIn, isLoading, portfolio, tagVersion,
      login, logout, register, loadPortfolio, addTag, removeTag, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// mapUser — преобразуем ответ бэкенда в тип User
// ═══════════════════════════════════════════════════════════════════════════
function mapUser(u: any): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    isVerified: u.is_verified ?? false,
    isAdmin: u.is_admin === true || u.is_admin === 1,
    subscription: {
      active: u.subscription_active ?? false,
      expiresAt: u.subscription_expires_at ?? null,
      autoRenew: u.subscription_auto_renew ?? true,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// useAuth — хук для доступа к контексту
// ═══════════════════════════════════════════════════════════════════════════
// Использование: const { user, isLoggedIn, login, logout } = useAuth()
export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

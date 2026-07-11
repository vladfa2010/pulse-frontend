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
import { initPushNotifications } from '@/lib/push'
import { saveTokenToNativeStorage, clearNativeStorage } from '@/lib/nativeAuth'

// ─── Типы данных ──────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  isVerified: boolean
  isAdmin: boolean
  subscription: {
    plan: 'free' | 'base' | 'premium' | 'club' | 'pro'
    active: boolean
    expiresAt: string | null
    autoRenew: boolean
    daysLeft: number
    inGracePeriod: boolean
    scheduledDowngrade: string | null
  }
}

export interface PortfolioTag {
  id: string
  tag_id: string
  tag_name: string
  tag_type: string
  enriched?: boolean
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
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  verifyCode: (email: string, code: string) => Promise<{ success: boolean; resetToken?: string; error?: string }>
  resetPassword: (resetToken: string, password: string) => Promise<{ success: boolean; error?: string }>
  loadPortfolio: () => Promise<void>
  addTag: (tag: { tagId: string; tagName: string; tagType: string }) => Promise<{ success: boolean; tag?: PortfolioTag; alreadySubscribed?: boolean; error?: string }>
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
          // Синхронизируем JWT в нативное хранилище для push-голосования
          saveTokenToNativeStorage(tokenAtStart).catch(() => {})
          // Загружаем портфель в фоне (не блокируем UI)
          api.get('/user/tags').then(d => {
            setPortfolio(d.tags || [])
          }).catch(() => setPortfolio([]))
          // Register push token after session restore
          initPushNotifications().catch(() => {})
        } else {
          setIsLoading(false)
        }
      })
      .catch(() => {
        // RACE CONDITION FIX: чистим localStorage ТОЛЬКО если токен не изменился
        const currentToken = localStorage.getItem('pulse_token')
        if (currentToken === tokenAtStart) {
          localStorage.removeItem('pulse_token')
          clearNativeStorage().catch(() => {})
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
      clearNativeStorage().catch(() => {})
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
        const returnedTag: PortfolioTag = {
          id: data.tag.tag_id,
          tag_id: data.tag.tag_id,
          tag_name: data.tag.tag_name,
          tag_type: data.tag.tag_type,
          enriched: data.tag.enriched,
        }

        setPortfolio(prev => {
          // Если тег уже есть (например, найден по транслиту), не дублируем строку
          if (prev.some(t => t.tag_id === returnedTag.tag_id)) {
            return prev.map(t => (t.tag_id === returnedTag.tag_id ? { ...t, ...returnedTag } : t))
          }
          return [...prev, returnedTag]
        })
        setTagVersion(v => v + 1)  // инвалидируем кэш каруселей

        // Если обогащение пошло в фон — опрашиваем статус через 5/10/20 сек
        if (data.backgroundEnrichmentStarted && returnedTag.tag_id) {
          const delays = [5000, 10000, 20000]
          const tagId = returnedTag.tag_id
          ;(async () => {
            for (const delay of delays) {
              await new Promise(r => setTimeout(r, delay))
              try {
                const fresh = await api.get('/user/tags')
                const freshTags: PortfolioTag[] = fresh.tags || []
                const freshTag = freshTags.find((t: PortfolioTag) => t.tag_id === tagId)
                if (freshTag) {
                  setPortfolio(prev =>
                    prev.map(t => (t.tag_id === tagId ? { ...t, enriched: freshTag.enriched } : t))
                  )
                  if (freshTag.enriched) break
                }
              } catch (e) {
                // игнорируем ошибки polling
              }
            }
          })().catch(() => {})
        }

        return { success: true, tag: returnedTag, alreadySubscribed: data.alreadySubscribed === true }
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
      await saveTokenToNativeStorage(data.token)       // Синхронизируем с нативным хранилищем
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      await loadPortfolio()
      // Register push token after login
      initPushNotifications().catch(() => {})
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
      await saveTokenToNativeStorage(data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      setPortfolio([])
      // Register push token after registration
      initPushNotifications().catch(() => {})
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

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — запрос кода
  // ═══════════════════════════════════════════════════════════════════════
  const forgotPassword = useCallback(async (email: string) => {
    try {
      await api.post('/auth/forgot-password', { email })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не удалось отправить код' }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — проверка кода
  // ═══════════════════════════════════════════════════════════════════════
  const verifyCode = useCallback(async (email: string, code: string) => {
    try {
      const data = await api.post('/auth/verify-code', { email, code })
      return { success: true, resetToken: data.resetToken }
    } catch (err: any) {
      return { success: false, error: err.message || 'Неверный или просроченный код' }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — установка нового пароля
  // ═══════════════════════════════════════════════════════════════════════
  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    try {
      const data = await api.post('/auth/reset-password', { resetToken, password })
      localStorage.setItem('pulse_token', data.token)
      await saveTokenToNativeStorage(data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      await loadPortfolio()
      initPushNotifications().catch(() => {})
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Не удалось сменить пароль' }
    }
  }, [loadPortfolio])

  // ─── Выход ──────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('pulse_token')  // Удаляем токен
    clearNativeStorage().catch(() => {})
    setUser(null)
    setPortfolio([])
    setIsLoggedIn(false)
  }, [])

  // ─── Провайдер — делает данные доступными всему приложению ──────────
  return (
    <AuthContext.Provider value={{
      user, isLoggedIn, isLoading, portfolio, tagVersion,
      login, logout, register, forgotPassword, verifyCode, resetPassword,
      loadPortfolio, addTag, removeTag, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// mapUser — преобразуем ответ бэкенда в тип User
// ═══════════════════════════════════════════════════════════════════════════
function mapUser(u: any): User {
  const sub = u.subscription || {}
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    isVerified: u.is_verified ?? false,
    isAdmin: u.is_admin === true || u.is_admin === 1,
    subscription: {
      plan: sub.plan || 'free',
      active: sub.active ?? false,
      expiresAt: sub.expiresAt ?? null,
      autoRenew: sub.autoRenew ?? true,
      daysLeft: sub.daysLeft ?? 0,
      inGracePeriod: sub.inGracePeriod ?? false,
      scheduledDowngrade: sub.scheduledDowngrade ?? null,
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

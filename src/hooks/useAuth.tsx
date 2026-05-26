import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'

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

interface AuthCtx {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  portfolio: PortfolioTag[]
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  demoLogin: () => Promise<{ success: boolean; error?: string }>
  loadPortfolio: () => Promise<void>
  addTag: (tag: { tagId: string; tagName: string; tagType: string }) => Promise<boolean>
  removeTag: (tagId: string) => Promise<boolean>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [portfolio, setPortfolio] = useState<PortfolioTag[]>([])

  // Initialize: check token on mount — restores session after page refresh
  useEffect(() => {
    const tokenAtStart = localStorage.getItem('pulse_token')
    if (!tokenAtStart) {
      setIsLoading(false)
      return
    }

    api.get('/auth/me')
      .then(data => {
        // Race condition guard: ignore if user logged in while this request was in flight
        const currentToken = localStorage.getItem('pulse_token')
        if (currentToken !== tokenAtStart) return

        if (data.user) {
          setUser(mapUser(data.user))
          setIsLoggedIn(true)
          // Load portfolio in background
          api.get('/user/tags').then(d => {
            setPortfolio(d.tags || [])
          }).catch(() => setPortfolio([]))
        }
      })
      .catch(() => {
        // Race condition guard: only clear if token wasn't replaced by a new login
        const currentToken = localStorage.getItem('pulse_token')
        if (currentToken === tokenAtStart) {
          localStorage.removeItem('pulse_token')
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Listen for 401 logout events from api.ts
  useEffect(() => {
    const handleLogout = () => {
      setUser(null)
      setPortfolio([])
      setIsLoggedIn(false)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await api.get('/user/tags')
      setPortfolio(data.tags || [])
    } catch {
      setPortfolio([])
    }
  }, [])

  const addTag = useCallback(async (tag: { tagId: string; tagName: string; tagType: string }) => {
    try {
      const data = await api.post('/user/tags', tag)
      if (data.tag) {
        setPortfolio(prev => [...prev, data.tag])
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const removeTag = useCallback(async (tagId: string) => {
    try {
      await api.delete(`/user/tags/${tagId}`)
      setPortfolio(prev => prev.filter(t => t.tag_id !== tagId))
      return true
    } catch {
      return false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('pulse_token', data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      await loadPortfolio()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Неправильный логин или пароль' }
    }
  }, [loadPortfolio])

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

  const demoLogin = useCallback(async () => {
    try {
      const data = await api.post('/auth/demo', {})
      localStorage.setItem('pulse_token', data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      await loadPortfolio()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка входа' }
    }
  }, [loadPortfolio])

  const logout = useCallback(() => {
    localStorage.removeItem('pulse_token')
    setUser(null)
    setPortfolio([])
    setIsLoggedIn(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isLoggedIn, isLoading, portfolio,
      login, logout, register, demoLogin, loadPortfolio, addTag, removeTag
    }}>
      {children}
    </AuthContext.Provider>
  )
}

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

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

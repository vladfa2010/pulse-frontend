import { useState, useCallback, createContext, useContext } from 'react'
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

interface AuthCtx {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  demoLogin: () => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('pulse_token', data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Неправильный логин или пароль' }
    }
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    try {
      const data = await api.post('/auth/register', { username, email, password })
      localStorage.setItem('pulse_token', data.token)
      setUser(mapUser(data.user))
      setIsLoggedIn(true)
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
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка входа' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pulse_token')
    setUser(null)
    setIsLoggedIn(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, isLoading: false, login, logout, register, demoLogin }}>
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

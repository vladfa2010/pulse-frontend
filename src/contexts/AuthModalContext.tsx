import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { logAnalyticsEvent } from '@/lib/analytics'
import { saveReturnUrl } from '@/lib/returnUrl'

type AuthModalMode = 'login' | 'register'

export interface AuthModalOpenOptions {
  /** URL для возврата после успешного входа/регистрации. Если не передан — берётся текущий location. */
  returnUrl?: string
}

interface AuthModalContextType {
  isOpen: boolean
  defaultMode: AuthModalMode
  open: (mode?: AuthModalMode, options?: AuthModalOpenOptions) => void
  close: () => void
}

const AuthModalContext = createContext<AuthModalContextType>({
  isOpen: false,
  defaultMode: 'login',
  open: () => {},
  close: () => {},
})

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultMode, setDefaultMode] = useState<AuthModalMode>('login')

  const open = useCallback((mode: AuthModalMode = 'login', options?: AuthModalOpenOptions) => {
    setDefaultMode(mode)
    setIsOpen(true)
    saveReturnUrl(options?.returnUrl)
    logAnalyticsEvent('open_auth_modal', { mode })
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <AuthModalContext.Provider value={{ isOpen, defaultMode, open, close }}>
      {children}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  return useContext(AuthModalContext)
}

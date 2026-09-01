/**
 * =============================================================================
 * PULSE Frontend — Return URL helpers
 * =============================================================================
 *
 * Сохраняет и восстанавливает URL, на который нужно вернуть пользователя
 * после успешного входа/регистрации. Хранит в sessionStorage, чтобы пережить
 * перезагрузку страницы на экране входа, но не утекать между вкладками.
 */

const RETURN_URL_KEY = 'pulse:returnUrl'

export function isInternalPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

/**
 * Сохранить returnUrl. Если url не передан — берётся текущий путь + поиск.
 * Сохраняются только внутренние пути (защита от open redirect).
 */
export function saveReturnUrl(url?: string): void {
  const value =
    url ??
    (typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '')

  if (!value || !isInternalPath(value)) return

  try {
    sessionStorage.setItem(RETURN_URL_KEY, value)
  } catch {
    // ignore storage errors (private mode, disabled storage, etc.)
  }
}

/**
 * Прочитать и удалить сохранённый returnUrl.
 */
export function popReturnUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = sessionStorage.getItem(RETURN_URL_KEY)
    if (value !== null) {
      sessionStorage.removeItem(RETURN_URL_KEY)
    }
    return value
  } catch {
    return null
  }
}

/**
 * Прочитать returnUrl, не удаляя.
 */
export function peekReturnUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(RETURN_URL_KEY)
  } catch {
    return null
  }
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { Crown, Loader2, MessageCircle } from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface TelegramStatus {
  connected: boolean
  chatId?: string
  digestEnabled: boolean
  frequency: string
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

interface TelegramConfig {
  botId: number
  botUsername: string
}

interface TelegramAuthData {
  id: number
  first_name: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface Props {
  isLoggedIn: boolean
  isPremium: boolean
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export default function TelegramConnectBanner({ isLoggedIn, isPremium }: Props) {
  const navigate = useNavigate()

  // ── State ──
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [tgConfig, setTgConfig] = useState<TelegramConfig | null>(null)

  // ── Refs ──
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ═══════════════════════════════════════════════════════════
  // 1. Load Telegram connection status
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isLoggedIn) return

    let cancelled = false
    setLoadingStatus(true)

    api
      .get('/user/telegram-status')
      .then((data) => {
        if (!cancelled) setStatus(data as TelegramStatus)
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            connected: false,
            digestEnabled: false,
            frequency: '1h',
            quietHoursEnabled: false,
            quietHoursStart: '23:00',
            quietHoursEnd: '07:00',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  // ═══════════════════════════════════════════════════════════
  // 2. Load Telegram config (bot username for widget)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isLoggedIn || !isPremium) return

    let cancelled = false

    api
      .get('/telegram/config')
      .then((data) => {
        if (!cancelled) setTgConfig(data as TelegramConfig)
      })
      .catch((err) => {
        console.error('[TelegramBanner] Failed to load config:', err)
      })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, isPremium])

  // ═══════════════════════════════════════════════════════════
  // 3. Polling after connection attempt
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!polling) return

    const check = async () => {
      try {
        const data = (await api.get('/user/telegram-status')) as TelegramStatus
        setStatus(data)
        if (data.connected) {
          stopPolling()
        }
      } catch (err) {
        console.error('[TelegramBanner] polling error:', err)
      }
    }

    check()
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setError('Таймаут подключения. Попробуйте снова.')
    }, POLL_TIMEOUT_MS)

    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling])

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setPolling(false)
    setConnecting(false)
  }

  // ═══════════════════════════════════════════════════════════
  // 4. Send auth data to backend
  // ═══════════════════════════════════════════════════════════

  const sendAuthToBackend = useCallback(async (user: TelegramAuthData) => {
    setConnecting(true)
    setError(null)

    try {
      await api.post('/auth/telegram', user)
      setPolling(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('403') || msg.includes('Premium')) {
        setError('Требуется подписка Premium')
      } else if (msg.includes('signature') || msg.includes('Invalid')) {
        setError('Ошибка проверки подписи Telegram. Попробуйте ещё раз.')
      } else {
        setError('Не удалось подключить Telegram. Попробуйте другой способ.')
      }
      setConnecting(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 5. MAIN: Open Telegram OAuth popup via official Login API
  // ═══════════════════════════════════════════════════════════

  const handleConnect = () => {
    if (!isPremium) {
      navigate('/pricing')
      return
    }

    if (!tgConfig) {
      handleDeepLink()
      return
    }

    const telegram = (window as any).Telegram
    if (!telegram?.Login?.auth) {
      console.error('[TelegramBanner] Telegram Login API not loaded')
      setError('Не удалось загрузить Telegram. Используем альтернативный способ.')
      handleDeepLink()
      return
    }

    setError(null)
    setConnecting(true)

    telegram.Login.auth(
      {
        bot_id: tgConfig.botId,
        request_access: 'write',
        lang: 'ru',
      },
      (user: TelegramAuthData | false) => {
        setConnecting(false)

        if (!user || typeof user !== 'object') {
          setError('Авторизация не завершена')
          return
        }

        if (!user.id || !user.hash || !user.auth_date) {
          console.error('[TelegramBanner] Invalid auth data:', user)
          setError('Не удалось получить данные Telegram')
          return
        }

        console.log('[TelegramBanner] Auth success:', user.id)
        sendAuthToBackend(user)
      }
    )
  }

  // ═══════════════════════════════════════════════════════════
  // 6. FALLBACK: Deep link (classic method)
  // ═══════════════════════════════════════════════════════════

  const handleDeepLink = async () => {
    if (!isPremium) {
      navigate('/pricing')
      return
    }

    if (deepLink) {
      window.open(deepLink, '_blank')
      setPolling(true)
      return
    }

    setLoadingLink(true)
    setError(null)

    try {
      const data = await api.get('/telegram/link')
      if (data.deepLink) {
        setDeepLink(data.deepLink)
        window.open(data.deepLink, '_blank')
        setPolling(true)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('403') || msg.includes('Premium')) {
        setError('Требуется подписка Premium')
      } else {
        setError('Не удалось получить ссылку. Попробуйте позже.')
      }
    } finally {
      setLoadingLink(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. Cleanup on unmount
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (!isLoggedIn) return null
  if (loadingStatus) return null
  if (status?.connected) return null

  return (
    <section className="px-6 md:px-12 py-10 max-w-[1400px] mx-auto">
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(0, 136, 204, 0.18)',
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0088CC 0%, transparent 70%)' }}
        />

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Icon */}
          <div
            className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0, 136, 204, 0.12)',
              border: '1px solid rgba(0, 136, 204, 0.25)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7"
              style={{ color: '#00A8E8' }}
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold text-white mb-1">Подключите Telegram</h3>
            <p className="text-sm text-[#9CA3AF] max-w-xl">
              Дайджесты новостей, алерты по тегам и управление подпиской — прямо в мессенджере.
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          {/* CTA */}
          <div className="shrink-0 flex flex-col items-stretch md:items-end gap-3 min-w-[200px]">
            {isPremium ? (
              <>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center justify-center gap-2.5 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #0088CC, #0055AA)',
                    color: '#fff',
                  }}
                >
                  {connecting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  )}
                  {connecting ? 'Подключение...' : 'Подключить бота'}
                </button>

                <button
                  onClick={handleDeepLink}
                  disabled={loadingLink}
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-[#6B7280] hover:text-[#0088CC] transition-colors disabled:opacity-50"
                >
                  {loadingLink ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <MessageCircle size={12} />
                  )}
                  {deepLink ? 'Открыть Telegram (классический способ)' : 'Не работает? Нажмите здесь'}
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                  color: '#fff',
                }}
              >
                <Crown size={16} />
                Оформить Premium
              </button>
            )}
          </div>
        </div>

        {polling && (
          <div className="relative mt-4 flex items-center gap-2 text-xs text-[#6B7280]">
            <div className="w-4 h-4 border-2 border-[#0088CC] border-t-transparent rounded-full animate-spin" />
            <span>Ожидаем подтверждения подключения...</span>
          </div>
        )}
      </div>
    </section>
  )
}

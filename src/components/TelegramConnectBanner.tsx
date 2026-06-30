import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { Send, Crown, Loader2, MessageCircle } from 'lucide-react'

interface TelegramStatus {
  connected: boolean
  chatId?: string
  digestEnabled: boolean
  frequency: string
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
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

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
const BOT_USERNAME = 'Insidepulse_bot'

const WIDGET_SCRIPT_SRC = 'https://telegram.org/js/telegram-widget.js?22'

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void
  }
}

export default function TelegramConnectBanner({ isLoggedIn, isPremium }: Props) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [widgetLoaded, setWidgetLoaded] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetContainerRef = useRef<HTMLDivElement>(null)

  // Load Telegram connection status on mount
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

  // Telegram Login Widget callback
  const onTelegramAuth = useCallback(async (user: TelegramAuthData) => {
    setError(null)
    try {
      await api.post('/auth/telegram', user)
      setPolling(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('403') || msg.includes('Premium')) {
        setError('Требуется подписка Premium')
      } else {
        setError('Не удалось подключить Telegram. Попробуйте другой способ.')
      }
    }
  }, [])

  // Register global callback for widget
  useEffect(() => {
    window.onTelegramAuth = onTelegramAuth
    return () => {
      window.onTelegramAuth = undefined
    }
  }, [onTelegramAuth])

  // Load Telegram Login Widget script
  useEffect(() => {
    if (!isLoggedIn || !isPremium || status?.connected) return
    if (widgetLoaded) return

    // Avoid loading twice
    if (document.getElementById('telegram-widget-script')) {
      setWidgetLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'telegram-widget-script'
    script.src = WIDGET_SCRIPT_SRC
    script.async = true
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', 'onTelegramAuth')
    script.setAttribute('data-request-access', 'write')

    script.onload = () => setWidgetLoaded(true)
    script.onerror = () => {
      console.error('[TelegramBanner] Failed to load widget script')
      setWidgetLoaded(false)
    }

    if (widgetContainerRef.current) {
      widgetContainerRef.current.appendChild(script)
    }
  }, [isLoggedIn, isPremium, status?.connected, widgetLoaded])

  // Polling status after user opens Telegram
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
  }

  // Fallback: deep link (classic method)
  const handleDeepLink = async () => {
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

  const handleAction = () => {
    if (!isPremium) {
      navigate('/pricing')
    }
  }

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
            style={{ backgroundColor: 'rgba(0, 136, 204, 0.12)', border: '1px solid rgba(0, 136, 204, 0.25)' }}
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
              {isPremium && ' Нажмите кнопку ниже, чтобы авторизоваться через Telegram.'}
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          {/* CTA Area */}
          <div className="shrink-0 flex flex-col items-end gap-3">
            {isPremium ? (
              <>
                {/* Primary: Telegram Login Widget */}
                <div ref={widgetContainerRef} className="telegram-widget-container" />

                {/* Fallback: deep link button (shown while widget loads or on error) */}
                {!widgetLoaded && (
                  <button
                    onClick={handleDeepLink}
                    disabled={loadingLink}
                    className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #0088CC, #0055AA)',
                      color: '#fff',
                    }}
                  >
                    {loadingLink ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {deepLink ? 'Открыть Telegram' : 'Подключить Telegram'}
                  </button>
                )}

                {/* Always show fallback link when widget loaded */}
                {widgetLoaded && (
                  <button
                    onClick={handleDeepLink}
                    disabled={loadingLink}
                    className="text-xs text-[#6B7280] hover:text-[#0088CC] transition-colors flex items-center gap-1"
                  >
                    <MessageCircle size={12} />
                    {deepLink ? 'Открыть Telegram (классический способ)' : 'Не работает кнопка? Нажмите здесь'}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handleAction}
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
            <span>Ожидаём подтверждения подключения…</span>
          </div>
        )}
      </div>
    </section>
  )
}

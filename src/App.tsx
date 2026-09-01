import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router'
import { WifiOff, RotateCcw, Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import { AppUpdateModal } from './components/AppUpdateModal'
import { useAuth } from './hooks/useAuth'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useAnalyticsPageTracking } from './hooks/useAnalyticsPageTracking'
import { useBackButton } from './hooks/useBackButton'
import { useSseNews } from './hooks/useSseNews'
import { useSoundToggle } from './hooks/useSoundToggle'
import { useUnreadBadge } from './hooks/useUnreadBadge'
import { useUnreadCount } from './contexts/UnreadCountContext'
import Home from './pages/Home'
import NewsDetailModal from './components/NewsDetailModal'

// Lazy-loaded routes — keep main bundle small
const Pricing = lazy(() => import('./pages/Pricing'))
const Profile = lazy(() => import('./pages/Profile'))
const NewsFeed = lazy(() => import('./pages/NewsFeed'))
const Admin = lazy(() => import('./pages/Admin'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'))
const Instructions = lazy(() => import('./pages/Instructions'))
const SentimentIndex = lazy(() => import('./pages/SentimentIndex'))
const DownloadPage = lazy(() => import('./pages/DownloadPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const ActivityMap = lazy(() => import('./pages/ActivityMap'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NewsDetailModalRoute() {
  const { slugOrId } = useParams<{ slugOrId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  if (!slugOrId) return null

  const handleClose = useCallback(() => {
    if (location.state?.background) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }, [location.state, navigate])

  return (
    <NewsDetailModal
      slugOrId={slugOrId}
      onClose={handleClose}
    />
  )
}

function AppRoutes() {
  const location = useLocation()
  const state = location.state as { background?: Location } | null

  return (
    <Suspense fallback={<div className="min-h-[50dvh]" style={{ backgroundColor: '#060606' }} />}>
      <Routes location={state?.background || location}>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:tab" element={<Profile />} />
        <Route path="/feed" element={<NewsFeed />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/sentiment" element={<SentimentIndex />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/payment/return" element={<PaymentReturn />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/activity-map" element={<ActivityMap />} />
        <Route path="/news/:slugOrId" element={null} />
      </Routes>

      <Routes>
        <Route path="/news/:slugOrId" element={<NewsDetailModalRoute />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  useBackButton()
  useAnalyticsPageTracking()
  const { initError, retryInit, isLoading } = useAuth()
  const [autoAttempts, setAutoAttempts] = useState(0)
  const { showModal, info, dismiss, update, updating, progress } = useAppUpdate()
  const { isMuted } = useSoundToggle()
  const { unreadCount } = useUnreadCount()
  useSseNews(true, isMuted)
  useUnreadBadge(unreadCount)

  // Авторекавери: при транспортной ошибке повторяем /auth/me каждые 7 сек, до 5 попыток
  useEffect(() => {
    if (initError !== 'transport' || autoAttempts >= 5) return
    const t = setTimeout(() => {
      setAutoAttempts(n => n + 1)
      retryInit()
    }, 7000)
    return () => clearTimeout(t)
  }, [initError, autoAttempts, retryInit])

  // Сброс счётчика автопопыток — только после успешно завершённой инициализации
  useEffect(() => {
    if (initError === null && !isLoading) setAutoAttempts(0)
  }, [initError, isLoading])

  // Migrate old hash-based links (e.g. #/news/slug) to clean URLs
  useEffect(() => {
    if (window.location.hash.startsWith('#/')) {
      const path = window.location.hash.slice(1)
      window.location.replace(path)
    }
  }, [])

  if (initError === 'transport') {
    const isRetrying = autoAttempts > 0 && autoAttempts < 5
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#060606' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(0, 212, 255, 0.12)' }}>
          {isRetrying ? (
            <Loader2 size={32} style={{ color: '#00D4FF' }} className="animate-spin" />
          ) : (
            <WifiOff size={32} style={{ color: '#00D4FF' }} />
          )}
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">
          {isRetrying ? 'Пробуем снова…' : 'Сервер недоступен'}
        </h1>
        <p className="text-sm mb-8 max-w-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {isRetrying
            ? `Попытка ${autoAttempts} из 5. Идёт обновление или пропала связь.`
            : 'Идёт обновление или пропала связь. Попробуйте ещё раз через несколько секунд.'}
        </p>
        <button
          onClick={() => { setAutoAttempts(0); retryInit() }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: '#00D4FF', color: '#060606' }}
        >
          <RotateCcw size={18} />
          Повторить
        </button>
      </div>
    )
  }

  return (
    <>
      <Layout>
        <ScrollToTop />
        <AppRoutes />
      </Layout>
      {showModal && info && (
        <AppUpdateModal version={info.version} onUpdate={update} onDismiss={dismiss} updating={updating} progress={progress} />
      )}
    </>
  )
}

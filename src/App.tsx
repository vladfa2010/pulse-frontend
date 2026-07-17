import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router'
import Layout from './components/Layout'
import { AppUpdateModal } from './components/AppUpdateModal'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useAnalyticsPageTracking } from './hooks/useAnalyticsPageTracking'
import { useBackButton } from './hooks/useBackButton'
import { useSseNews } from './hooks/useSseNews'
import { useSoundToggle } from './hooks/useSoundToggle'
import { useUnreadBadge } from './hooks/useUnreadBadge'
import { useUnreadCount } from './contexts/UnreadCountContext'
import Home from './pages/Home'
import Pricing from './pages/Pricing'
import Profile from './pages/Profile'
import NewsFeed from './pages/NewsFeed'
import Admin from './pages/Admin'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import PaymentReturn from './pages/PaymentReturn'
import Instructions from './pages/Instructions'
import SentimentIndex from './pages/SentimentIndex'
import DownloadPage from './pages/DownloadPage'
import NewsDetailModal from './components/NewsDetailModal'

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
  if (!slugOrId) return null
  return (
    <NewsDetailModal
      slugOrId={slugOrId}
      onClose={() => navigate(-1)}
    />
  )
}

function AppRoutes() {
  const location = useLocation()
  const state = location.state as { background?: Location } | null

  return (
    <>
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
        <Route path="/news/:slugOrId" element={null} />
      </Routes>

      {state?.background && (
        <Routes>
          <Route path="/news/:slugOrId" element={<NewsDetailModalRoute />} />
        </Routes>
      )}
    </>
  )
}

export default function App() {
  useBackButton()
  useAnalyticsPageTracking()
  const { showModal, info, dismiss, update, updating, progress } = useAppUpdate()
  const { isMuted } = useSoundToggle()
  const { unreadCount } = useUnreadCount()
  useSseNews(true, isMuted)
  useUnreadBadge(unreadCount)

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

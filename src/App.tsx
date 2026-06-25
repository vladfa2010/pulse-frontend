import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Layout from './components/Layout'
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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/feed" element={<NewsFeed />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/sentiment" element={<SentimentIndex />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/payment/return" element={<PaymentReturn />} />
      </Routes>
    </Layout>
  )
}

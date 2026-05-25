import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Login from './pages/Login'
import Pricing from './pages/Pricing'
import Profile from './pages/Profile'
import NewsFeed from './pages/NewsFeed'
import Admin from './pages/Admin'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/news" element={<NewsFeed />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
    </Routes>
  )
}

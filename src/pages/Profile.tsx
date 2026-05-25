import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { User, Shield, Calendar, Newspaper, LogOut } from 'lucide-react'

export default function Profile() {
  const { user, isLoggedIn, logout } = useAuth()
  const [stats, setStats] = useState({ newsCount: 0, memberSince: '' })

  useEffect(() => {
    if (user?.id) {
      // Fetch user stats from API
      fetch(`https://pulse-api-bsov.onrender.com/api/user/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('pulse_token')}` }
      })
        .then(r => r.json())
        .then(data => setStats({
          newsCount: data.stats?.newsCount || 0,
          memberSince: data.stats?.memberSince ? new Date(data.stats.memberSince).toLocaleDateString('ru-RU') : ''
        }))
        .catch(() => {})
    }
  }, [user?.id])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Войдите, чтобы увидеть профиль</p>
          <Link to="/login" className="px-6 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400">Войти</Link>
        </div>
      </div>
    )
  }

  return (
     if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Войдите, чтобы увидеть профиль</p>
          <Link to="/login" className="px-6 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400">Войти</Link>
        </div>
      </div>
    )
  }

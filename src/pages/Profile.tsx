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
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-lg mx-auto pt-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <User className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.username}</h1>
            <p className="text-slate-400 text-sm">{user?.email}</p>
            {user?.isAdmin && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded mt-1">
                <Shield size={12} /> Admin
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Newspaper className="w-5 h-5 text-cyan-400 mb-2" />
            <div className="text-2xl font-bold">{stats.newsCount}</div>
            <div className="text-xs text-slate-400">Новостей прочитано</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Calendar className="w-5 h-5 text-purple-400 mb-2" />
            <div className="text-lg font-bold">{stats.memberSince || '—'}</div>
            <div className="text-xs text-slate-400">Дата регистрации</div>
          </div>
        </div>

        <div className="space

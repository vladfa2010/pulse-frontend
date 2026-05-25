import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Shield, Users, Newspaper, CreditCard, ArrowLeft } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  username: string
  is_verified: number
  is_admin: number
  subscription_active: number
  news_count: number
  created_at: string
}

export default function Admin() {
  const { user, isLoggedIn } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.isAdmin) return
    const token = localStorage.getItem('pulse_token')
    fetch('https://pulse-api-bsov.onrender.com/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUsers(data.users || []); setLoading(false) })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false) })
  }, [user?.isAdmin])

  if (!isLoggedIn || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl mb-2">Доступ запрещен</h2>
          <p className="text-slate-400 mb-4">Требуются права администратора</p>
          <Link to="/" className="text-cyan-400 hover:underline">На главную</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <Shield className="w-5 h-5 text-blue-400" />
          <h1 className="text-xl font-bold">Админ-панель</h1>
          <span className="ml-auto text-sm text-slate-500">{user.email}</span>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Users size={18} />} label="Пользователи" value={users.length} />
          <StatCard icon={<Shield size={18} />} label="Premium" value={users.filter(u => u.subscription_active).length} />
          <StatCard icon={<Newspaper size={18} />} label="Всего новостей" value="—" />
          <StatCard icon={<CreditCard size={18} />} label="Выручка" value="—" />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <span className="font-medium">Пользователи</span>
            <span className="ml-auto text-sm text-slate-500">{users.length}</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
               

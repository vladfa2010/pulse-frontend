import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
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
    setLoading(true)
    api.get('/admin/users')
      .then(data => setUsers(data.users || []))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [user?.isAdmin])

  if (!isLoggedIn || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl mb-2">Доступ запрещен</h2>
          <p className="text-text-secondary mb-4">Требуются права администратора</p>
          <Link to="/" className="text-[#00D4FF] hover:underline">На главную</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="text-[#00D4FF]" size={24} />
            Админ-панель
          </h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Users className="text-[#00D4FF] mb-2" size={20} />
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-text-muted">Пользователей</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <CreditCard className="text-emerald-400 mb-2" size={20} />
            <div className="text-2xl font-bold">{users.filter(u => u.subscription_active).length}</div>
            <div className="text-sm text-text-muted">Premium</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Newspaper className="text-amber-400 mb-2" size={20} />
            <div className="text-2xl font-bold">{users.reduce((sum, u) => sum + (u.news_count || 0), 0)}</div>
            <div className="text-sm text-text-muted">Новостей изучено</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Shield className="text-purple-400 mb-2" size={20} />
            <div className="text-2xl font-bold">{users.filter(u => u.is_admin).length}</div>
            <div className="text-sm text-text-muted">Админов</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users size={16} className="text-text-muted" />
            <span className="font-medium">Пользователи</span>
            <span className="ml-auto text-sm text-text-muted">{users.length}</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-text-muted">Загрузка...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted text-left">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Premium</th>
                    <th className="px-4 py-3">Новостей</th>
                    <th className="px-4 py-3">Роль</th>
                    <th className="px-4 py-3">С нами с</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">{u.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.username}</td>
                      <td className="px-4 py-3">
                        {u.is_verified ? <span className="text-emerald-400">&#10003;</span> : <span className="text-amber-400">&#9675;</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.subscription_active ? <span className="text-emerald-400">&#10003;</span> : <span className="text-text-muted">&#8212;</span>}
                      </td>
                      <td className="px-4 py-3">{u.news_count || 0}</td>
                      <td className="px-4 py-3">
                        {u.is_admin ? (
                          <span className="text-purple-400 text-xs font-medium">admin</span>
                        ) : (
                          <span className="text-text-muted text-xs">user</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '&#8212;'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

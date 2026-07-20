import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Shield, ShieldOff, Lock, Unlock, User, Search, X } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  username: string
  is_verified: boolean
  is_admin: boolean
  is_blocked: boolean
  subscription_active: boolean
  subscription_expires_at: string
  subscription_auto_renew: boolean
  subscription_plan: string
  news_count: number
  created_at: string
  last_login_at: string
  total_payments: number
  total_amount: number
  tag_count: number
  active_channels: number
  articles_read: number
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function daysLeft(iso: string): number {
  if (!iso) return -1
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

interface UsersTabProps {
  onSelectUser: (userId: string) => void
  refreshKey?: number
}

export default function UsersTab({ onSelectUser, refreshKey }: UsersTabProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUsers = searchQuery.trim()
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get('/admin/users')
      setUsers(data.users || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Users load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  const handleToggleAdmin = async (userId: string) => {
    try {
      await adminApi.post(`/admin/users/${userId}/toggle-admin`, {})
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !u.is_admin } : u))
    } catch (err: any) {
      alert(err.message || 'Failed')
    }
  }

  const handleToggleBlock = async (userId: string) => {
    try {
      await adminApi.post(`/admin/users/${userId}/toggle-block`, {})
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: !u.is_blocked } : u))
    } catch (err: any) {
      alert(err.message || 'Failed')
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
        <span className="text-sm" style={{ color: '#9CA3AF' }}>Loading users...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7280' }} />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:border-[#444444]"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#FFFFFF' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[#222222]"
              style={{ color: '#6B7280' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>
            {filteredUsers.length}{searchQuery ? ' found' : ' users'}
          </span>
          <span className="text-sm" style={{ color: '#6B7280' }}>
            {filteredUsers.filter(u => u.subscription_active).length} subscribed
          </span>
          <span className="text-sm" style={{ color: '#6B7280' }}>
            {filteredUsers.filter(u => u.is_blocked).length} blocked
          </span>
          <span className="text-sm" style={{ color: '#34D399' }}>
            {filteredUsers.reduce((s, u) => s + u.total_amount, 0).toFixed(0)} RUB total
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs" style={{ color: '#6B7280' }}>
              Last updated: {formatDate(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Sub</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Tags</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Reads</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-32" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const dl = daysLeft(u.subscription_expires_at)
                return (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-[#161616] cursor-pointer"
                    style={{ borderTop: '1px solid #1a1a1a' }}
                    onClick={() => onSelectUser(u.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#222222' }}>
                          <User size={14} style={{ color: '#9CA3AF' }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{u.username}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.is_admin && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F59E0B22', color: '#FBBF24' }}>admin</span>
                        )}
                        {u.is_blocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EF444422', color: '#EF4444' }}>blocked</span>
                        )}
                        {!u.is_blocked && !u.is_admin && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#34D39922', color: '#34D399' }}>active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.subscription_active ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs" style={{ color: dl < 7 ? '#EF4444' : '#34D399' }}>
                            {dl}d
                          </span>
                          {!u.subscription_auto_renew && (
                            <span className="text-[10px] px-1 py-0.5 rounded mt-0.5" style={{ backgroundColor: '#F59E0B22', color: '#FBBF24' }}>
                              no renew
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#6B7280' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{u.tag_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{u.articles_read}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{u.total_payments}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono" style={{ color: '#34D399' }}>{u.total_amount.toFixed(0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleAdmin(u.id) }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]"
                          title={u.is_admin ? 'Remove admin' : 'Make admin'}
                          style={{ color: u.is_admin ? '#FBBF24' : '#6B7280' }}
                        >
                          {u.is_admin ? <Shield size={14} /> : <ShieldOff size={14} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleBlock(u.id) }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]"
                          title={u.is_blocked ? 'Unblock' : 'Block'}
                          style={{ color: u.is_blocked ? '#EF4444' : '#6B7280' }}
                        >
                          {u.is_blocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

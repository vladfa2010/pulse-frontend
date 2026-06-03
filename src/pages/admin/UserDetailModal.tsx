import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, CreditCard, Tag, MessageSquare, Mail, Shield, Lock, Unlock, RefreshCw } from 'lucide-react'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysLeft(iso: string): number {
  if (!iso) return -1
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

interface Payment {
  id: string
  amount: number
  status: string
  method: string
  paid_at: string
  created_at: string
}

interface UserTag {
  tag_id: string
  tag_name: string
  tag_type: string
  created_at: string
}

interface Channel {
  channel: string
  target: string
  is_active: boolean
}

interface LoginDay {
  day: string
  count: number
}

interface UserDetail {
  id: string
  email: string
  username: string
  is_verified: boolean
  is_admin: boolean
  is_blocked: boolean
  subscription_active: boolean
  subscription_expires_at: string
  subscription_auto_renew: boolean
  news_count: number
  created_at: string
  last_login_at: string
  articles_read: number
}

interface UserDetailResponse {
  user: UserDetail
  payments: Payment[]
  total_amount: number
  tags: UserTag[]
  channels: Channel[]
  login_history: LoginDay[]
  notifications: any
}

interface Props {
  userId: string
  onClose: () => void
}

// SVG Bar Chart for login history
function LoginChart({ data }: { data: LoginDay[] }) {
  if (!data || data.length === 0) {
    return <div className="text-xs py-8 text-center" style={{ color: '#6B7280' }}>No login data</div>
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const barWidth = Math.max(8, 300 / data.length - 2)
  const chartH = 80

  return (
    <svg width={data.length * (barWidth + 2)} height={chartH + 20} className="mx-auto">
      {data.map((d, i) => {
        const h = (d.count / maxCount) * chartH
        const date = new Date(d.day).getDate()
        return (
          <g key={d.day}>
            <rect
              x={i * (barWidth + 2)}
              y={chartH - h}
              width={barWidth}
              height={h}
              rx={2}
              fill={d.count > 0 ? '#34D399' : '#222222'}
              opacity={0.8}
            />
            <text
              x={i * (barWidth + 2) + barWidth / 2}
              y={chartH + 14}
              textAnchor="middle"
              fill="#6B7280"
              fontSize="9"
            >
              {date}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function UserDetailModal({ userId, onClose }: Props) {
  const [data, setData] = useState<UserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [pwResult, setPwResult] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/users/${userId}`)
      setData(res)
    } catch (err) {
      console.error('User detail load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPwResult('Min 6 characters')
      return
    }
    setActionLoading(true)
    try {
      await adminApi.post(`/admin/users/${userId}/reset-password`, { password: newPassword })
      setPwResult('Password updated!')
      setNewPassword('')
    } catch (err: any) {
      setPwResult(err.message || 'Failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleAdmin = async () => {
    if (!data) return
    setActionLoading(true)
    try {
      const res = await adminApi.post(`/admin/users/${userId}/toggle-admin`, {})
      setData(prev => prev ? { ...prev, user: { ...prev.user, is_admin: res.is_admin } } : null)
    } catch (err: any) {
      alert(err.message || 'Failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleBlock = async () => {
    if (!data) return
    setActionLoading(true)
    try {
      const res = await adminApi.post(`/admin/users/${userId}/toggle-block`, {})
      setData(prev => prev ? { ...prev, user: { ...prev.user, is_blocked: res.is_blocked } } : null)
    } catch (err: any) {
      alert(err.message || 'Failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !data) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <RefreshCw size={18} className="animate-spin" />
          Loading...
        </div>
      </div>,
      document.body
    )
  }

  const u = data.user
  const dl = daysLeft(u.subscription_expires_at)
  const tgChannel = data.channels.find(c => c.channel === 'telegram')
  const emailChannel = data.channels.find(c => c.channel === 'email')

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="rounded-xl border w-full mx-4 overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 720, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#222222' }}>
              <Shield size={18} style={{ color: u.is_admin ? '#FBBF24' : '#9CA3AF' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{u.username}</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>{u.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAdmin}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{
                backgroundColor: u.is_admin ? '#F59E0B22' : 'transparent',
                borderColor: u.is_admin ? '#F59E0B44' : '#222222',
                color: u.is_admin ? '#FBBF24' : '#6B7280',
              }}
            >
              <Shield size={12} />
              {u.is_admin ? 'Admin' : 'Make Admin'}
            </button>
            <button
              onClick={handleToggleBlock}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{
                backgroundColor: u.is_blocked ? '#EF444422' : 'transparent',
                borderColor: u.is_blocked ? '#EF444444' : '#222222',
                color: u.is_blocked ? '#EF4444' : '#6B7280',
              }}
            >
              {u.is_blocked ? <Lock size={12} /> : <Unlock size={12} />}
              {u.is_blocked ? 'Blocked' : 'Block'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#222222] ml-2" style={{ color: '#9CA3AF' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">

          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Subscription</p>
              <p className="text-sm font-semibold mt-1" style={{ color: u.subscription_active ? '#34D399' : '#6B7280' }}>
                {u.subscription_active ? `${dl} days left` : 'Inactive'}
              </p>
              {u.subscription_auto_renew && (
                <p className="text-xs" style={{ color: '#60A5FA' }}>Auto-renew</p>
              )}
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Total Paid</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#34D399' }}>{data.total_amount.toFixed(0)} RUB</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>{data.payments.length} payments</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Tags</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{data.tags.length}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>{data.channels.length} channels</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Articles Read</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{u.articles_read}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>Registered: {formatDate(u.created_at).split(',')[0]}</p>
            </div>
          </div>

          {/* Row 2: Channels */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <MessageSquare size={14} style={{ color: tgChannel?.is_active ? '#34D399' : '#6B7280' }} />
              <span className="text-xs" style={{ color: tgChannel?.is_active ? '#34D399' : '#6B7280' }}>
                Telegram {tgChannel?.is_active ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <Mail size={14} style={{ color: emailChannel?.is_active ? '#34D399' : '#6B7280' }} />
              <span className="text-xs" style={{ color: emailChannel?.is_active ? '#34D399' : '#6B7280' }}>
                Email {emailChannel?.is_active ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <CreditCard size={14} style={{ color: '#9CA3AF' }} />
              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                Last login: {formatDate(u.last_login_at)}
              </span>
            </div>
          </div>

          {/* Row 3: Login Chart */}
          {data.login_history.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs font-medium mb-3" style={{ color: '#9CA3AF' }}>Activity (last 30 days)</p>
              <LoginChart data={data.login_history} />
            </div>
          )}

          {/* Row 4: Tags */}
          {data.tags.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Tags</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.tags.map(t => (
                  <span key={t.tag_id} className="text-xs px-2 py-1 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#FFFFFF' }}>
                    {t.tag_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Row 5: Payments */}
          {data.payments.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Payments</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <th className="text-left text-xs py-2" style={{ color: '#6B7280' }}>Date</th>
                    <th className="text-right text-xs py-2" style={{ color: '#6B7280' }}>Amount</th>
                    <th className="text-right text-xs py-2" style={{ color: '#6B7280' }}>Status</th>
                    <th className="text-right text-xs py-2" style={{ color: '#6B7280' }}>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid #1a1a1a' }}>
                      <td className="text-xs py-2" style={{ color: '#9CA3AF' }}>{formatDate(p.created_at)}</td>
                      <td className="text-xs py-2 text-right font-mono" style={{ color: '#FFFFFF' }}>{p.amount.toFixed(0)}</td>
                      <td className="text-xs py-2 text-right" style={{ color: p.status === 'succeeded' ? '#34D399' : p.status === 'pending' ? '#FBBF24' : '#EF4444' }}>{p.status}</td>
                      <td className="text-xs py-2 text-right" style={{ color: '#6B7280' }}>{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Row 6: Reset Password */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} style={{ color: '#EF4444' }} />
              <p className="text-xs font-medium" style={{ color: '#EF4444' }}>Reset Password</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="password"
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwResult(null) }}
                className="flex-1 min-w-0 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#FFFFFF' }}
              />
              <button
                onClick={handleResetPassword}
                disabled={actionLoading || !newPassword}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
              >
                {actionLoading ? '...' : 'Set Password'}
              </button>
            </div>
            {pwResult && (
              <p className="text-xs mt-2" style={{ color: pwResult.includes('updated') ? '#34D399' : '#EF4444' }}>{pwResult}</p>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

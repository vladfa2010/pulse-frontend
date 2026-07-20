import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, CreditCard, Tag, MessageSquare, Mail, Shield, Lock, Unlock, RefreshCw, Trash2, CheckCircle } from 'lucide-react'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
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
  subscription_plan: string
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

interface DeletePreview {
  user: {
    id: string
    email: string
    name: string
    is_admin: boolean
    subscription_expires_at: string | null
    payment_method: string | null
    has_auto_renew: boolean
  }
  owned_tags: { tag_id: string; tag_name: string }[]
  shared_portfolio_tags: { tag_id: string; tag_name: string }[]
  summary: {
    has_owned_tags: boolean
    has_shared_tags: boolean
    total_tags: number
    has_auto_renew: boolean
    subscription_expires_at: string | null
  }
}

interface Props {
  userId: string
  onClose: () => void
  onDeleted?: () => void
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

export default function UserDetailModal({ userId, onClose, onDeleted }: Props) {
  const [data, setData] = useState<UserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [pwResult, setPwResult] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // TZ_CANCEL_RECURRING: auto-renew confirmation dialog
  const [autoRenewConfirm, setAutoRenewConfirm] = useState<{ open: boolean; next: boolean } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // TZ_DELETE_SUCCESS_MODAL: success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [deletedEmail, setDeletedEmail] = useState<string>('')

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

  // TZ_CANCEL_RECURRING: open confirmation dialog
  const handleAutoRenewClick = () => {
    if (!data) return
    setAutoRenewConfirm({ open: true, next: !data.user.subscription_auto_renew })
  }

  // TZ_CANCEL_RECURRING: confirm and call backend
  const confirmAutoRenew = async () => {
    if (!data || !autoRenewConfirm) return
    setActionLoading(true)
    try {
      const res = await adminApi.post(`/admin/users/${userId}/auto-renew`, { enabled: autoRenewConfirm.next })
      setData(prev => prev ? { ...prev, user: { ...prev.user, subscription_auto_renew: res.enabled } } : null)
      setAutoRenewConfirm(null)
    } catch (err: any) {
      alert(err.message || 'Failed')
    } finally {
      setActionLoading(false)
    }
  }
  const fetchDeletePreview = async () => {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await adminApi.get(`/admin/users/${userId}/delete-preview`)
      setDeletePreview(res)
      setShowDeleteConfirm(true)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to load preview')
    } finally {
      setDeleteLoading(false)
    }
  }

  // TZ_DELETE_ACCOUNT: delete user
  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await adminApi.delete(`/admin/users/${userId}`)
      // Call onDeleted callback (parent refreshes list)
      onDeleted?.()
      // TZ_DELETE_SUCCESS_MODAL: show success instead of closing
      setDeletedEmail(data?.user.email || '')
      setShowDeleteConfirm(false)
      setDeletePreview(null)
      setShowSuccessModal(true)
    } catch (err: any) {
      setDeleteError(err.message || 'Delete failed')
    } finally {
      setDeleteLoading(false)
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
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs" style={{ color: u.subscription_auto_renew ? '#60A5FA' : '#F59E0B' }}>
                  {u.subscription_auto_renew ? 'Auto-renew ON' : 'Auto-renew OFF'}
                </p>
                {u.subscription_active && (
                  <button
                    onClick={handleAutoRenewClick}
                    disabled={actionLoading}
                    className="text-xs px-2 py-1 rounded border transition-all"
                    style={{
                      backgroundColor: u.subscription_auto_renew ? '#EF444422' : '#34D39922',
                      borderColor: u.subscription_auto_renew ? '#EF444444' : '#34D39944',
                      color: u.subscription_auto_renew ? '#EF4444' : '#34D399',
                    }}
                  >
                    {u.subscription_auto_renew ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
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

          {/* TZ_DELETE_ACCOUNT: Danger Zone */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#EF444444' }}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={14} style={{ color: '#DC2626' }} />
              <p className="text-xs font-medium" style={{ color: '#DC2626' }}>Danger Zone</p>
            </div>

            {!showDeleteConfirm ? (
              <>
                <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                  This will permanently delete the user account and all associated data.
                </p>
                <button
                  onClick={fetchDeletePreview}
                  disabled={deleteLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.05)',
                    borderColor: 'rgba(220, 38, 38, 0.2)',
                    color: '#DC2626',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.05)'
                    e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.2)'
                  }}
                >
                  <Trash2 size={14} />
                  {deleteLoading ? 'Loading...' : 'Delete Account'}
                </button>
                {deleteError && (
                  <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{deleteError}</p>
                )}
              </>
            ) : (
              <>
                {/* Confirmation overlay — 4 sections */}
                {deletePreview && (
                  <div className="space-y-3">

                    {/* Section 1: User */}
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#222222' }}>
                        <span className="text-xs font-medium" style={{ color: '#FFFFFF' }}>
                          {deletePreview.user.name?.charAt(0).toUpperCase() || deletePreview.user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#FFFFFF' }}>{deletePreview.user.name || deletePreview.user.email}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>{deletePreview.user.email}</p>
                        {deletePreview.user.is_admin && (
                          <p className="text-xs mt-1 px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: '#F59E0B22', color: '#FBBF24' }}>Admin</p>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Tags */}
                    {deletePreview.summary.total_tags > 0 && (
                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: '#DC2626' }}>
                          Tags ({deletePreview.summary.total_tags})
                        </p>
                        {deletePreview.summary.has_owned_tags && (
                          <div className="mb-2">
                            <p className="text-xs mb-1" style={{ color: '#FBBF24' }}>Owned — will be set to «no owner»</p>
                            <div className="flex flex-wrap gap-1">
                              {deletePreview.owned_tags.map(t => (
                                <span key={t.tag_id} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#F59E0B11', borderColor: '#F59E0B33', color: '#FBBF24' }}>{t.tag_name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {deletePreview.summary.has_shared_tags && (
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#34D399' }}>Shared — will remain (others use)</p>
                            <div className="flex flex-wrap gap-1">
                              {deletePreview.shared_portfolio_tags.map(t => (
                                <span key={t.tag_id} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#34D39911', borderColor: '#34D39933', color: '#34D399' }}>{t.tag_name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: Payments */}
                    {deletePreview.summary.has_auto_renew && (
                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                        <p className="text-xs font-medium mb-1" style={{ color: '#DC2626' }}>Auto-renew active</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                          {deletePreview.user.payment_method === 'yookassa'
                            ? 'YooKassa auto-renew will be cancelled automatically'
                            : 'Active subscription auto-renew detected'}
                        </p>
                      </div>
                    )}

                    {/* Section 4: Final confirm */}
                    <div className="p-3 rounded-lg border" style={{ backgroundColor: '#111111', borderColor: '#DC262644' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: '#DC2626' }}>Final confirmation</p>
                      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                        Type <span className="font-mono" style={{ color: '#FFFFFF' }}>{deletePreview.user.email}</span> to confirm deletion
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeletePreview(null); setDeleteError(null) }}
                          className="px-4 py-2 rounded-lg text-sm border transition-all"
                          style={{ backgroundColor: 'transparent', borderColor: '#222222', color: '#9CA3AF' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete Forever'}
                        </button>
                      </div>
                      {deleteError && (
                        <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{deleteError}</p>
                      )}
                    </div>

                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* TZ_CANCEL_RECURRING: Auto-renew confirmation overlay */}
      {autoRenewConfirm?.open && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', animation: 'fadeIn 200ms ease' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-xl border p-6 mx-4"
            style={{
              backgroundColor: '#111111',
              borderColor: '#222222',
              maxWidth: 400,
              width: '100%',
            }}
          >
            <h3 className="text-base font-semibold mb-4" style={{ color: '#FFFFFF' }}>
              {autoRenewConfirm.next ? 'Включить автопродление?' : 'Отключить автопродление?'}
            </h3>
            <div className="space-y-2 mb-6">
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                Пользователь: <span style={{ color: '#FFFFFF' }}>{u.username}</span>
              </p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                Тариф: <span style={{ color: '#FFFFFF' }}>{u.subscription_active ? u.subscription_plan : 'free'}</span>
              </p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {autoRenewConfirm.next
                  ? `Следующее списание: ${formatDateOnly(u.subscription_expires_at)}`
                  : `Подписка останется активной до ${formatDateOnly(u.subscription_expires_at)}. После этой даты автопродление не произойдёт.`}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAutoRenewConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border transition-all"
                style={{ backgroundColor: 'transparent', borderColor: '#222222', color: '#9CA3AF' }}
              >
                Отмена
              </button>
              <button
                onClick={confirmAutoRenew}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: autoRenewConfirm.next ? '#34D399' : '#EF4444', color: '#000000' }}
              >
                {actionLoading ? '...' : (autoRenewConfirm.next ? 'Включить' : 'Отключить')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TZ_DELETE_SUCCESS_MODAL: Success overlay */}
      {showSuccessModal && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', animation: 'fadeIn 200ms ease' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-xl border p-8 flex flex-col items-center text-center mx-4"
            style={{
              backgroundColor: '#111111',
              borderColor: '#222222',
              maxWidth: 360,
              width: '100%',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)' }}
            >
              <CheckCircle size={32} style={{ color: '#34D399' }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#FFFFFF' }}>
              Пользователь удалён
            </h3>
            <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
              {deletedEmail}
            </p>
            <button
              onClick={() => {
                setShowSuccessModal(false)
                onClose()
              }}
              className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#34D399', color: '#000000' }}
            >
              ОК
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

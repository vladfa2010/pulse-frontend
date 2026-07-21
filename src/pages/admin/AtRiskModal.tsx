import { useEffect, useState, useRef, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import {
  X,
  RefreshCw,
  ExternalLink,
  Shield,
  Search,
  AlertTriangle,
  User,
} from 'lucide-react'

interface AtRiskAccount {
  id: string
  email: string
  username: string
  subscription_active: boolean
  subscription_expires_at: string | null
  last_login_at: string | null
}

interface AtRiskResponse {
  type: string
  label: string
  count: number
  accounts: AtRiskAccount[]
}

type AtRiskType = 'dormant_7d' | 'dormant_30d' | 'no_tags' | 'sub_expiring'

interface AtRiskModalProps {
  type: AtRiskType
  onClose: () => void
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Никогда'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 30) return `${diffDays} дн назад`
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getSubscriptionDaysLeft(iso: string | null): number | null {
  if (!iso) return null
  const diffMs = new Date(iso).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function AtRiskModal({ type, onClose }: AtRiskModalProps) {
  const [data, setData] = useState<AtRiskResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get(`/admin/metrics/at-risk-accounts?type=${type}&limit=200`)
      setData(res)
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const filtered = data?.accounts.filter((acc) => {
    const q = search.toLowerCase()
    return (
      acc.email.toLowerCase().includes(q) ||
      (acc.username || '').toLowerCase().includes(q)
    )
  }) || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[90vh] rounded-xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', borderColor: '#222222' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#2a1515' }}>
              <AlertTriangle size={18} style={{ color: '#F87171' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{data?.label || 'Аккаунты'}</h3>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {data ? `${data.count} аккаунтов` : 'Загрузка...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Обновить
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all hover:bg-[#1a1a1a]"
              style={{ color: '#9CA3AF' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7280' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email или username..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none focus:border-[#444444]"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
            />
          </div>
          {data && (
            <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
              Показано {filtered.length} из {data.accounts.length}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
              <span className="text-sm" style={{ color: '#9CA3AF' }}>Загрузка аккаунтов...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: '#F87171' }}>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: '#6B7280' }}>
                {search ? 'Нет совпадений' : 'Нет аккаунтов в этой категории'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0" style={{ backgroundColor: '#0A0A0A' }}>
                <tr style={{ borderBottom: '1px solid #222222' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Пользователь</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Последний вход</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Подписка</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc) => {
                  const daysLeft = getSubscriptionDaysLeft(acc.subscription_expires_at)
                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-[#161616]"
                      style={{ borderTop: '1px solid #1a1a1a' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: '#222222', color: '#9CA3AF' }}
                          >
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{acc.username || '—'}</p>
                            <p className="text-xs" style={{ color: '#6B7280' }}>{acc.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{formatLastLogin(acc.last_login_at)}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                          {acc.last_login_at ? formatDate(acc.last_login_at) : 'Нет данных'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Shield
                            size={14}
                            style={{ color: acc.subscription_active ? '#34D399' : '#6B7280' }}
                          />
                          <span className="text-sm text-white">
                            {acc.subscription_active ? 'Active' : '—'}
                          </span>
                        </div>
                        {acc.subscription_active && acc.subscription_expires_at && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: daysLeft !== null && daysLeft <= 3 ? '#F87171' : '#6B7280' }}
                          >
                            до {formatDate(acc.subscription_expires_at)}
                            {daysLeft !== null && ` (${daysLeft} дн)`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => window.open(`/admin/users/${acc.id}`, '_blank')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border transition-all hover:border-[#333333]"
                          style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
                        >
                          <ExternalLink size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

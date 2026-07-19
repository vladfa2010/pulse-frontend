import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Plus, Edit2, Trash2, RotateCcw, X, AlertTriangle, Check, Loader2, Users } from 'lucide-react'
import UserDetailModal from './UserDetailModal'

interface AdminPlan {
  id: string
  name: string
  price: number
  billing_frequency: string
  yearly_discount: number
  tag_limit: number
  plan_level: number
  features: Record<string, boolean>
  is_active: boolean
  is_popular: boolean
  coming_soon_label: string | null
  display_order: number
  deleted_at: string | null
}

interface FeatureDef {
  id: string
  label: string
  description: string | null
  is_active: boolean
}

interface Subscriber {
  id: string
  name: string
  email: string
  subscription_start: string
  subscription_end: string
}

const FREQ_OPTIONS = ['weekly', 'monthly', 'quarterly', 'yearly']

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function PlansSubTab() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [features, setFeatures] = useState<FeatureDef[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<AdminPlan | null>(null)
  const [deleteSubscribers, setDeleteSubscribers] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [subscribersTotal, setSubscribersTotal] = useState(0)
  const [subscribersLoading, setSubscribersLoading] = useState(false)
  const [showAllSubscribers, setShowAllSubscribers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, f] = await Promise.all([
        adminApi.get('/api/admin/plans'),
        adminApi.get('/api/admin/features'),
      ])
      setPlans(Array.isArray(p) ? p : (p.plans || []))
      setFeatures(Array.isArray(f) ? f : (f.features || []))
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Plans load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const activeFeatures = features.filter(f => f.is_active)

  const openCreate = () => {
    const initialFeatures: Record<string, boolean> = {}
    activeFeatures.forEach(f => {
      initialFeatures[f.id] = false
    })
    setEditingPlan(null)
    setSubscribers([])
    setSubscribersTotal(0)
    setShowAllSubscribers(false)
    setSelectedUserId(null)
    setForm({
      id: '',
      name: '',
      price: '',
      billing_frequency: 'monthly',
      yearly_discount: '',
      tag_limit: '',
      plan_level: '',
      features: initialFeatures,
      is_active: true,
      is_popular: false,
      coming_soon_label: '',
      display_order: '',
    })
    setSaveError(null)
    setModalOpen(true)
  }

  const loadSubscribers = useCallback(async (planId: string) => {
    setSubscribersLoading(true)
    try {
      const res = await adminApi.get(`/api/admin/plans/${planId}/subscribers`)
      setSubscribers(Array.isArray(res.subscribers) ? res.subscribers : [])
      setSubscribersTotal(typeof res.total === 'number' ? res.total : (res.subscribers?.length || 0))
    } catch (err: any) {
      console.error('Subscribers load error:', err)
      setSubscribers([])
      setSubscribersTotal(0)
    } finally {
      setSubscribersLoading(false)
    }
  }, [])

  const openEdit = (plan: AdminPlan) => {
    const initialFeatures: Record<string, boolean> = {}
    activeFeatures.forEach(f => {
      initialFeatures[f.id] = plan.features?.[f.id] === true
    })
    setEditingPlan(plan)
    setSubscribers([])
    setSubscribersTotal(0)
    setShowAllSubscribers(false)
    setSelectedUserId(null)
    setForm({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      billing_frequency: plan.billing_frequency,
      yearly_discount: plan.yearly_discount,
      tag_limit: plan.tag_limit,
      plan_level: plan.plan_level,
      features: initialFeatures,
      is_active: plan.is_active,
      is_popular: plan.is_popular,
      coming_soon_label: plan.coming_soon_label || '',
      display_order: plan.display_order,
    })
    setSaveError(null)
    setModalOpen(true)
    loadSubscribers(plan.id)
  }

  const handleFeatureChange = (featureId: string, value: boolean) => {
    setForm((prev: any) => ({ ...prev, features: { ...prev.features, [featureId]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const body: any = {
        name: form.name,
        price: Number(form.price),
        billing_frequency: form.billing_frequency,
        yearly_discount: Number(form.yearly_discount || 0),
        tag_limit: Number(form.tag_limit),
        plan_level: Number(form.plan_level),
        features: form.features,
        is_active: form.is_active,
        is_popular: form.is_popular,
        coming_soon_label: form.coming_soon_label || null,
        display_order: Number(form.display_order || 0),
      }
      if (!editingPlan) {
        body.id = form.id
        await adminApi.post('/api/admin/plans', body)
        setSuccessMsg('Тариф создан')
      } else {
        await adminApi.patch(`/api/admin/plans/${editingPlan.id}`, body)
        setSuccessMsg('Тариф сохранён')
      }
      setModalOpen(false)
      await load()
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const result = await adminApi.delete(`/api/admin/plans/${deleteConfirm.id}`)
      setSuccessMsg(result.message || 'Тариф удалён')
      setDeleteConfirm(null)
      setDeleteSubscribers(null)
      await load()
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  const handleRestore = async (plan: AdminPlan) => {
    try {
      await adminApi.post(`/api/admin/plans/${plan.id}/restore`, {})
      setSuccessMsg('Тариф восстановлен')
      await load()
    } catch (err: any) {
      alert(err.message || 'Ошибка восстановления')
    }
  }

  const openDelete = async (plan: AdminPlan) => {
    setDeleteConfirm(plan)
    setDeleteSubscribers(null)
    // Fetch subscriber count via delete preview? We can call GET /api/admin/plans/:id/subscribers if exists,
    // but TZ says DELETE returns count. We will call DELETE only after confirmation.
    // For preview we can just set plan and show confirmation with unknown count.
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>{plans.length} тарифов</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>{plans.filter(p => !p.deleted_at).length} активных</span>
          {lastRefresh && (
            <span className="text-xs hidden sm:inline" style={{ color: '#6B7280' }}>
              {formatDate(lastRefresh.toISOString())}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
          >
            <Plus size={14} />
            Новый тариф
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#10B98122', color: '#34D399', border: '1px solid #10B98144' }}>
          <Check size={14} />
          {successMsg}
        </div>
      )}

      {/* Plans table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Freq</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Yearly %</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Tags</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Level</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Active</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Popular</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Coming Soon</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-32" style={{ color: '#6B7280' }}>Deleted</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => {
                const isDeleted = !!plan.deleted_at
                return (
                  <tr
                    key={plan.id}
                    className="transition-colors hover:bg-[#161616]"
                    style={{ borderTop: '1px solid #1a1a1a', opacity: isDeleted ? 0.55 : 1, backgroundColor: isDeleted ? '#0f0f0f' : undefined }}
                  >
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: '#9CA3AF' }}>{plan.id}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{plan.name}</span>
                      {isDeleted && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EF444422', color: '#EF4444' }}>Удалён</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{Number(plan.price).toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-3 text-left text-xs" style={{ color: '#9CA3AF' }}>{plan.billing_frequency}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{plan.yearly_discount}%</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{plan.tag_limit < 0 ? '∞' : plan.tag_limit}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{plan.plan_level}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${plan.is_active ? 'text-emerald-400' : 'text-[#6B7280]'}`} style={{ backgroundColor: plan.is_active ? '#10B98122' : '#1a1a1a' }}>
                        {plan.is_active ? 'Да' : 'Нет'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {plan.is_popular ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#00D4FF22', color: '#00D4FF' }}>Да</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full text-[#6B7280]" style={{ backgroundColor: '#1a1a1a' }}>Нет</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left text-xs" style={{ color: '#9CA3AF' }}>{plan.coming_soon_label || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{plan.display_order}</td>
                    <td className="px-4 py-3 text-left text-xs" style={{ color: '#6B7280' }}>{formatDate(plan.deleted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isDeleted ? (
                          <button
                            onClick={() => handleRestore(plan)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]"
                            style={{ color: '#34D399' }}
                            title="Восстановить"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(plan)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]"
                              style={{ color: '#60A5FA' }}
                              title="Редактировать"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => openDelete(plan)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                              style={{ color: '#EF4444' }}
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {plans.length === 0 && !loading && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    Нет тарифов
                  </td>
                </tr>
              )}
              {loading && plans.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: '#60A5FA' }} />
                    Загрузка...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#222222' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{editingPlan ? 'Редактировать тариф' : 'Новый тариф'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-[#222222]" style={{ color: '#6B7280' }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>ID</label>
                  <input
                    type="text"
                    value={form.id}
                    disabled={!!editingPlan}
                    onChange={e => setForm({ ...form, id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] disabled:opacity-50"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                    placeholder="premium"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Название</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Цена</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Период оплаты</label>
                  <select
                    value={form.billing_frequency}
                    onChange={e => setForm({ ...form, billing_frequency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  >
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Годовая скидка (%)</label>
                  <input
                    type="number"
                    value={form.yearly_discount}
                    onChange={e => setForm({ ...form, yearly_discount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Лимит тегов (-1 = ∞)</label>
                  <input
                    type="number"
                    value={form.tag_limit}
                    onChange={e => setForm({ ...form, tag_limit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Уровень плана</label>
                  <input
                    type="number"
                    value={form.plan_level}
                    onChange={e => setForm({ ...form, plan_level: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Порядок отображения</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={e => setForm({ ...form, display_order: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                    style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Метка «скоро»</label>
                <input
                  type="text"
                  value={form.coming_soon_label}
                  onChange={e => setForm({ ...form, coming_soon_label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                  style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                  placeholder="Скоро"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded"
                    style={{ accentColor: '#34D399' }}
                  />
                  Активен
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input
                    type="checkbox"
                    checked={form.is_popular}
                    onChange={e => setForm({ ...form, is_popular: e.target.checked })}
                    className="rounded"
                    style={{ accentColor: '#00D4FF' }}
                  />
                  Популярный
                </label>
              </div>

              {/* Features */}
              <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#6B7280' }}>Фичи</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeFeatures.map(f => (
                    <label key={f.id} className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                      <input
                        type="checkbox"
                        checked={!!form.features?.[f.id]}
                        onChange={e => handleFeatureChange(f.id, e.target.checked)}
                        className="rounded"
                        style={{ accentColor: '#34D399' }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Active subscribers */}
              {editingPlan && (
                <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} style={{ color: '#6B7280' }} />
                    <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                      Активные подписчики ({subscribersLoading ? '...' : subscribersTotal})
                    </h4>
                  </div>

                  {subscribersLoading ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                      <Loader2 size={14} className="animate-spin" />
                      Загрузка подписчиков...
                    </div>
                  ) : subscribers.length === 0 ? (
                    <p className="text-xs" style={{ color: '#6B7280' }}>Нет активных подписчиков</p>
                  ) : (
                    <div className="space-y-1">
                      {(showAllSubscribers ? subscribers : subscribers.slice(0, 5)).map(user => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[#1a1a1a]"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                            style={{ backgroundColor: '#00D4FF20', color: '#00D4FF' }}
                          >
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium truncate" style={{ color: '#FFFFFF', flex: 1 }}>
                            {user.name || user.email}
                          </span>
                          <span className="text-xs hidden sm:inline truncate" style={{ color: '#9CA3AF', maxWidth: 160 }}>
                            {user.email}
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: '#6B7280' }}>
                            {formatDateShort(user.subscription_start)}
                          </span>
                        </button>
                      ))}

                      {subscribers.length > 5 && (
                        <button
                          onClick={() => setShowAllSubscribers(v => !v)}
                          className="w-full text-center text-xs py-2 rounded-lg transition-colors hover:bg-[#1a1a1a]"
                          style={{ color: '#60A5FA' }}
                        >
                          {showAllSubscribers
                            ? 'Свернуть'
                            : `Показать все (${subscribersTotal})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {saveError && <p className="text-sm" style={{ color: '#EF4444' }}>{saveError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: '#222222' }}>
              <button onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50" style={{ color: '#9CA3AF' }}>Отмена</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="w-full max-w-md rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#222222' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF444422' }}>
                <AlertTriangle size={16} style={{ color: '#EF4444' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Удалить тариф {deleteConfirm.name}?</h3>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="ml-auto p-1 rounded-lg hover:bg-[#222222] disabled:opacity-50" style={{ color: '#6B7280' }}><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm" style={{ color: '#D1D5DB' }}>
                Тариф будет скрыт из каталога. Текущие подписчики останутся на нём до конца оплаченного периода.
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Активных подписчиков: <strong style={{ color: deleteSubscribers ? '#EF4444' : '#FFFFFF' }}>{deleteSubscribers ?? '—'}</strong>
              </p>
              {saveError && <p className="text-sm" style={{ color: '#EF4444' }}>{saveError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: '#222222' }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50" style={{ color: '#9CA3AF' }}>Отмена</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50" style={{ backgroundColor: deleting ? '#333333' : '#EF4444', color: '#FFFFFF' }}>
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User detail/edit modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}

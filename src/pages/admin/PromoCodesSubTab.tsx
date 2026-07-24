import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Plus, Edit2, Trash2, BarChart3, X, Check, Loader2 } from 'lucide-react'
import PromoStatsModal from './PromoStatsModal'

interface PromoCode {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'trial'
  discount_value: number
  applicable_plans: string[] | null
  max_uses: number | null
  uses_count: number
  valid_from: string
  expires_at: string | null
  is_active: boolean
}

interface AdminPlan {
  id: string
  name: string
  is_active: boolean
  deleted_at: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function PromoCodesSubTab() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PromoCode | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [statsId, setStatsId] = useState<string | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const [form, setForm] = useState<any>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validate = useCallback((form: any) => {
    const next: Record<string, string> = {}

    const code = (form.code || '').toUpperCase().replace(/[^A-Z0-9_]/g, '')
    if (!code) {
      next.code = 'Code is required.'
    } else if (code.length > 50) {
      next.code = 'Maximum 50 characters.'
    }

    if ((form.description || '').length > 255) {
      next.description = 'Maximum 255 characters.'
    }

    if (!form.discount_type) {
      next.discount_type = 'Select a type.'
    }

    const value = Number(form.discount_value)
    if (form.discount_value === '' || Number.isNaN(value)) {
      next.discount_value = 'Enter a value.'
    } else if (!Number.isInteger(value) || value < 1) {
      next.discount_value = 'Minimum 1.'
    } else if (form.discount_type === 'percent' && value > 100) {
      next.discount_value = 'Enter 1-100.'
    } else if (form.discount_type === 'trial' && value > 365) {
      next.discount_value = 'Enter 1-365 days.'
    }

    const maxUses = form.max_uses === '' ? null : Number(form.max_uses)
    if (form.max_uses !== '' && !Number.isNaN(maxUses) && maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      next.max_uses = 'Must be at least 1 or empty.'
    }

    if (!form.valid_from) {
      next.valid_from = 'Select a start date.'
    }
    if (!form.expires_at) {
      next.expires_at = 'Select an end date.'
    }
    if (form.valid_from && form.expires_at) {
      const from = new Date(form.valid_from)
      const to = new Date(form.expires_at)
      if (to <= from) {
        next.expires_at = 'Must be after Valid From.'
      }
    }

    return next
  }, [])

  const isFormValid = useCallback(() => {
    const e = validate(form)
    return Object.keys(e).length === 0 && Object.values(touched).some(Boolean)
  }, [form, validate, touched])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        adminApi.get('/api/admin/promo-codes'),
        adminApi.get('/api/admin/plans'),
      ])
      const promoList = Array.isArray(c) ? c : (c.promo_codes || c.promos || [])
      setCodes(promoList)
      const planList = Array.isArray(p) ? p : (p.plans || [])
      setPlans(planList.filter((pl: AdminPlan) => pl.is_active && !pl.deleted_at))
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Promo codes load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    setErrors(validate(form))
  }, [form, validate])

  const resetForm = (code?: PromoCode) => {
    setEditing(code || null)
    setForm({
      code: code?.code || '',
      description: code?.description || '',
      discount_type: code?.discount_type || 'percent',
      discount_value: code?.discount_value ?? '',
      applicable_plans: code?.applicable_plans || [],
      valid_from: toDateInput(code?.valid_from || new Date().toISOString()),
      expires_at: toDateInput(code?.expires_at || null),
      max_uses: code?.max_uses ?? '',
      is_active: code ? code.is_active : true,
    })
    setSaveError(null)
    setErrors({})
    setTouched({})
  }

  const touchField = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const updateForm = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }))
    touchField(field)
  }

  const openCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEdit = (code: PromoCode) => {
    resetForm(code)
    setModalOpen(true)
  }

  const togglePlan = (planId: string) => {
    setForm((prev: any) => {
      const set = new Set(prev.applicable_plans || [])
      if (set.has(planId)) set.delete(planId)
      else set.add(planId)
      return { ...prev, applicable_plans: Array.from(set) }
    })
    touchField('applicable_plans')
  }

  const handleSave = async () => {
    setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])))
    const validationErrors = validate(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setSaveError('Исправьте ошибки в форме')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const body: any = {
        code: form.code.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        applicable_plans: form.applicable_plans?.length ? form.applicable_plans : null,
        valid_from: new Date(form.valid_from).toISOString(),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        is_active: form.is_active,
      }
      if (!editing) {
        await adminApi.post('/api/admin/promo-codes', body)
        setSuccessMsg('Промокод создан')
      } else {
        await adminApi.put(`/api/admin/promo-codes/${editing.id}`, body)
        setSuccessMsg('Промокод обновлён')
      }
      setModalOpen(false)
      await load()
    } catch (err: any) {
      const serverErrors = err.details || err.response?.data?.details
      if (Array.isArray(serverErrors)) {
        const mapped: Record<string, string> = {}
        serverErrors.forEach((d: any) => {
          const field = d.field || d.path?.[0]
          if (field) mapped[field] = d.message
        })
        setErrors(prev => ({ ...prev, ...mapped }))
        setSaveError(err.response?.data?.error || 'Ошибка сохранения')
      } else {
        setSaveError(err.message || 'Ошибка сохранения')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return
    setDeactivating(true)
    try {
      await adminApi.delete(`/api/admin/promo-codes/${deactivateId}`)
      setSuccessMsg('Промокод деактивирован')
      setDeactivateId(null)
      await load()
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка деактивации')
    } finally {
      setDeactivating(false)
    }
  }

  const planName = (id: string) => plans.find(p => p.id === id)?.name || id

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>{codes.length} промокодов</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>{codes.filter(c => c.is_active).length} активных</span>
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
            Новый промокод
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#10B98122', color: '#34D399', border: '1px solid #10B98144' }}>
          <Check size={14} />
          {successMsg}
        </div>
      )}

      {/* Promo codes table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Applicable Plans</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Uses</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-32" style={{ color: '#6B7280' }}>Expires</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id} className="transition-colors hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a', opacity: code.is_active ? 1 : 0.55 }}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium" style={{ color: '#FFFFFF' }}>{code.code}</span>
                    {code.description && <p className="text-xs truncate max-w-[200px]" style={{ color: '#6B7280' }}>{code.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: code.discount_type === 'percent' ? '#10B98122' : '#2563EB22', color: code.discount_type === 'percent' ? '#34D399' : '#60A5FA' }}>
                      {code.discount_type === 'percent' ? 'percent' : 'trial'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>
                    {code.discount_type === 'percent' ? `${code.discount_value}%` : `${code.discount_value} дн.`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {code.applicable_plans?.length ? (
                        code.applicable_plans.map(id => (
                          <span key={id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF' }}>{planName(id)}</span>
                        ))
                      ) : (
                        <span className="text-xs" style={{ color: '#6B7280' }}>Все</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>
                    {code.uses_count}{code.max_uses ? ` / ${code.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{formatDate(code.expires_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${code.is_active ? 'text-emerald-400' : 'text-[#6B7280]'}`} style={{ backgroundColor: code.is_active ? '#10B98122' : '#1a1a1a' }}>
                      {code.is_active ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setStatsId(code.id)} className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]" style={{ color: '#60A5FA' }} title="Статистика"><BarChart3 size={14} /></button>
                      <button onClick={() => openEdit(code)} className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]" style={{ color: '#9CA3AF' }} title="Редактировать"><Edit2 size={14} /></button>
                      {code.is_active && (
                        <button onClick={() => setDeactivateId(code.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: '#EF4444' }} title="Деактивировать"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>Нет промокодов</td></tr>
              )}
              {loading && codes.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}><RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: '#60A5FA' }} />Загрузка...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#222222' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{editing ? 'Редактировать промокод' : 'Новый промокод'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-[#222222]" style={{ color: '#6B7280' }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Код <span style={{ color: '#EF4444' }}>*</span> (A-Z, 0-9, _)</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => updateForm('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  onBlur={() => touchField('code')}
                  className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.code ? 'input-error' : ''}`}
                  style={{ backgroundColor: '#0A0A0A', borderColor: errors.code ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                  placeholder="START50"
                />
                {errors.code && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.code}</p>}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Описание</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  onBlur={() => touchField('description')}
                  className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.description ? 'input-error' : ''}`}
                  style={{ backgroundColor: '#0A0A0A', borderColor: errors.description ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                />
                {errors.description && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.description}</p>}
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input type="radio" name="discount_type" checked={form.discount_type === 'percent'} onChange={() => updateForm('discount_type', 'percent')} className="rounded" style={{ accentColor: '#34D399' }} />
                  Процент
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input type="radio" name="discount_type" checked={form.discount_type === 'trial'} onChange={() => updateForm('discount_type', 'trial')} className="rounded" style={{ accentColor: '#60A5FA' }} />
                  Пробный период
                </label>
              </div>
              {errors.discount_type && <p className="text-xs -mt-2" style={{ color: '#EF4444' }}>{errors.discount_type}</p>}
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>
                  {form.discount_type === 'percent' ? 'Скидка, % *' : 'Дни trial *'}
                </label>
                <input
                  type="number"
                  value={form.discount_value}
                  onChange={e => updateForm('discount_value', e.target.value)}
                  onBlur={() => touchField('discount_value')}
                  className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.discount_value ? 'input-error' : ''}`}
                  style={{ backgroundColor: '#0A0A0A', borderColor: errors.discount_value ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                />
                {errors.discount_value && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.discount_value}</p>}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Действует для тарифов</label>
                <div className={`rounded-lg border p-3 space-y-2 ${errors.applicable_plans ? 'input-error' : ''}`} style={{ backgroundColor: '#0A0A0A', borderColor: errors.applicable_plans ? '#EF4444' : '#222222' }}>
                  {plans.length === 0 && <span className="text-xs" style={{ color: '#6B7280' }}>Нет активных тарифов</span>}
                  {plans.map(plan => (
                    <label key={plan.id} className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                      <input
                        type="checkbox"
                        checked={(form.applicable_plans || []).includes(plan.id)}
                        onChange={() => togglePlan(plan.id)}
                        className="rounded"
                        style={{ accentColor: '#34D399' }}
                      />
                      {plan.name}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm" style={{ color: '#9CA3AF' }}>
                    <input
                      type="checkbox"
                      checked={!form.applicable_plans?.length}
                      onChange={() => setForm({ ...form, applicable_plans: [] })}
                      className="rounded"
                      style={{ accentColor: '#60A5FA' }}
                    />
                    Все тарифы
                  </label>
                </div>
                {errors.applicable_plans && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.applicable_plans}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Действует с <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={e => updateForm('valid_from', e.target.value)}
                    onBlur={() => touchField('valid_from')}
                    className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.valid_from ? 'input-error' : ''}`}
                    style={{ backgroundColor: '#0A0A0A', borderColor: errors.valid_from ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                  />
                  {errors.valid_from && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.valid_from}</p>}
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Истекает <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={e => updateForm('expires_at', e.target.value)}
                    onBlur={() => touchField('expires_at')}
                    className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.expires_at ? 'input-error' : ''}`}
                    style={{ backgroundColor: '#0A0A0A', borderColor: errors.expires_at ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                  />
                  {errors.expires_at && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.expires_at}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Максимум использований (пусто = ∞)</label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={e => updateForm('max_uses', e.target.value)}
                  onBlur={() => touchField('max_uses')}
                  className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] ${errors.max_uses ? 'input-error' : ''}`}
                  style={{ backgroundColor: '#0A0A0A', borderColor: errors.max_uses ? '#EF4444' : '#222222', color: '#FFFFFF' }}
                />
                {errors.max_uses && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.max_uses}</p>}
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => updateForm('is_active', e.target.checked)} className="rounded" style={{ accentColor: '#34D399' }} />
                  Активен
                </label>
              </div>
              {saveError && <p className="text-sm" style={{ color: '#EF4444' }}>{saveError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: '#222222' }}>
              <button onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50" style={{ color: '#9CA3AF' }}>Отмена</button>
              <button onClick={handleSave} disabled={saving || !isFormValid()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deactivateId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => !deactivating && setDeactivateId(null)}>
          <div className="w-full max-w-sm rounded-xl border p-5" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#FFFFFF' }}>Деактивировать промокод?</h3>
            <p className="text-sm mb-4" style={{ color: '#D1D5DB' }}>Промокод больше не будет применяться при новых подписках. Ранее использованные останутся в силе.</p>
            {saveError && <p className="text-sm mb-3" style={{ color: '#EF4444' }}>{saveError}</p>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeactivateId(null)} disabled={deactivating} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50" style={{ color: '#9CA3AF' }}>Отмена</button>
              <button onClick={handleDeactivate} disabled={deactivating} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50" style={{ backgroundColor: deactivating ? '#333333' : '#EF4444', color: '#FFFFFF' }}>
                {deactivating && <Loader2 size={14} className="animate-spin" />}
                {deactivating ? 'Деактивация...' : 'Деактивировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsId && <PromoStatsModal promoId={statsId} onClose={() => setStatsId(null)} />}
    </div>
  )
}

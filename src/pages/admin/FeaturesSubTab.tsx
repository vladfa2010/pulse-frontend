import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Plus, Edit2, X, Check, Loader2 } from 'lucide-react'

interface FeatureDef {
  id: string
  label: string
  description: string | null
  is_active: boolean
}

export default function FeaturesSubTab() {
  const [features, setFeatures] = useState<FeatureDef[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FeatureDef | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get('/api/admin/features')
      setFeatures(Array.isArray(data) ? data : (data.features || []))
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Features load error:', err)
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

  const resetForm = (feature?: FeatureDef) => {
    setEditing(feature || null)
    setForm({
      id: feature?.id || '',
      label: feature?.label || '',
      description: feature?.description || '',
      is_active: feature ? feature.is_active : true,
    })
    setSaveError(null)
  }

  const openCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEdit = (feature: FeatureDef) => {
    resetForm(feature)
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const body: any = {
        label: form.label,
        description: form.description || null,
        is_active: form.is_active,
      }
      if (!editing) {
        body.id = form.id
        await adminApi.post('/api/admin/features', body)
        setSuccessMsg('Фича создана')
      } else {
        await adminApi.put(`/api/admin/features/${editing.id}`, body)
        setSuccessMsg('Фича обновлена')
      }
      setModalOpen(false)
      await load()
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>{features.length} фич</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>{features.filter(f => f.is_active).length} активных</span>
          {lastRefresh && (
            <span className="text-xs hidden sm:inline" style={{ color: '#6B7280' }}>
              {lastRefresh.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
            Новая фича
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#10B98122', color: '#34D399', border: '1px solid #10B98144' }}>
          <Check size={14} />
          {successMsg}
        </div>
      )}

      {/* Features table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Label</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Description</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-16" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.id} className="transition-colors hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a', opacity: f.is_active ? 1 : 0.55 }}>
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: '#9CA3AF' }}>{f.id}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#FFFFFF' }}>{f.label}</td>
                  <td className="px-4 py-3 text-xs truncate max-w-[200px]" style={{ color: '#6B7280' }}>{f.description || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${f.is_active ? 'text-emerald-400' : 'text-[#6B7280]'}`} style={{ backgroundColor: f.is_active ? '#10B98122' : '#1a1a1a' }}>
                      {f.is_active ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]" style={{ color: '#60A5FA' }} title="Редактировать"><Edit2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {features.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>Нет фич</td></tr>
              )}
              {loading && features.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}><RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: '#60A5FA' }} />Загрузка...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl border" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#222222' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{editing ? 'Редактировать фичу' : 'Новая фича'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-[#222222]" style={{ color: '#6B7280' }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>ID</label>
                <input
                  type="text"
                  value={form.id}
                  disabled={!!editing}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] disabled:opacity-50"
                  style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Название</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                  style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#9CA3AF' }}>Описание</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
                  style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" style={{ accentColor: '#34D399' }} />
                  Активна
                </label>
              </div>
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
    </div>
  )
}

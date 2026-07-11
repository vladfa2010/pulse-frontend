import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, Tag, RefreshCw, Users, FileText, RotateCcw, Trash2, Sparkles, CheckCircle2 } from 'lucide-react'
import { EditableCard } from '@/components/admin/EditableCard'
import { TagChipsInput } from '@/components/admin/TagChipsInput'
import { TagTypeSelect } from '@/components/admin/TagTypeSelect'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface DailyStat {
  day: string
  count: number
  avg_sentiment: number
}

interface Article {
  id: string
  title: string
  published_at: string
  sentiment_score: number
  sentiment_source: string
  source: string
}

interface Subscriber {
  email: string
  username: string
  created_at: string
}

interface TagDetail {
  tag_id: string
  tag_name: string
  tag_type: string
  keywords: string[]
  created_at: string
  related_tags: string[]
  ticker: string | null
  website: string | null
  description: string | null
  key_products: string[]
  synonyms_ru: string[]
  synonyms_en: string[]
  exchange: string | null
  trend: string | null
  sector: string | null
}

interface TagDetailResponse {
  tag: TagDetail
  daily_stats: DailyStat[]
  recent_articles: Article[]
  subscribers: Subscriber[]
  subscriber_count: number
}

interface Props {
  tagId: string
  onClose: () => void
}

function ActivityChart({ data }: { data: DailyStat[] }) {
  if (!data || data.length === 0) {
    return <div className="text-xs py-8 text-center" style={{ color: '#6B7280' }}>No activity data</div>
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const barWidth = Math.max(8, 340 / data.length - 2)
  const chartH = 100

  return (
    <svg width={data.length * (barWidth + 2)} height={chartH + 20} className="mx-auto">
      {data.map((d, i) => {
        const h = (d.count / maxCount) * chartH
        const date = new Date(d.day).getDate()
        return (
          <g key={d.day}>
            <rect
              x={i * (barWidth + 2)} y={chartH - h} width={barWidth} height={h} rx={2}
              fill={d.count > 0 ? '#60A5FA' : '#222222'} opacity={0.8}
            />
            <text x={i * (barWidth + 2) + barWidth / 2} y={chartH + 14} textAnchor="middle" fill="#6B7280" fontSize="9">
              {date}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function TagDetailModal({ tagId, onClose }: Props) {
  const [data, setData] = useState<TagDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichSuccess, setEnrichSuccess] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TagDetail>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedField, setLastSavedField] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setData(null)
    try {
      const res = await adminApi.get(`/admin/tags/${tagId}`)
      setData(res)
    } catch (err: any) {
      console.error('Tag detail load error:', err)
      setLoadError(err.message || 'Failed to load tag')
    } finally {
      setLoading(false)
    }
  }, [tagId])

  const handleDeleted = () => {
    // dispatchEvent FIRST — before onClose potentially unmounts parent
    window.dispatchEvent(new CustomEvent('tag:deleted', { detail: { tagId, tagName: data?.tag?.tag_name } }))
    setShowDeleteConfirm(false)
    onClose()
  }

  useEffect(() => {
    load()
    setEditingField(null)
    setSaveStatus('idle')
    setSaveError(null)
  }, [tagId])

  const handleBackfill = async () => {
    try {
      setBackfillResult('Processing...')
      const res = await adminApi.post('/admin/backfill', { tag: tagId })
      setBackfillResult(`Processed: ${res.processed}, OK: ${res.succeeded}, Fail: ${res.failed}`)
    } catch (err: any) {
      setBackfillResult(err.message || 'Failed')
    }
  }

  const handleEnrich = async () => {
    setEnrichLoading(true)
    setEnrichSuccess(false)
    try {
      const res = await adminApi.post(`/admin/tags/${tagId}/enrich`, {})
      if (res.success) {
        setEnrichSuccess(true)
        await load()
        setTimeout(() => setEnrichSuccess(false), 3000)
      }
    } catch (err: any) {
      console.error('Enrich failed:', err)
      alert(err.message || 'Enrichment failed')
    } finally {
      setEnrichLoading(false)
    }
  }

  const handleEdit = (field: string) => {
    if (!data) return
    setEditingField(field)
    setEditValues({ ...data.tag })
    setSaveStatus('idle')
    setSaveError(null)
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditValues({})
    setSaveStatus('idle')
    setSaveError(null)
  }

  const FIELD_MAP: Record<string, string> = {
    description: 'description_ru',
    synonyms_ru: 'synonyms_ru',
    synonyms_en: 'synonyms_en',
  }

  const handleSave = async (field: string) => {
    if (!data || !editValues) return
    setSaveStatus('saving')
    setSaveError(null)

    try {
      const payload: Record<string, any> = {}
      const apiField = FIELD_MAP[field] || field
      const value = editValues[field as keyof TagDetail]
      if (value !== undefined) payload[apiField] = value

      const res = await adminApi.put(`/admin/tags/${tagId}`, payload)

      // Only merge fields that were actually updated — don't overwrite others with null
      const updatedFields = res.updated_fields || []
      const tagUpdates: Partial<TagDetail> = {}
      for (const f of updatedFields) {
        const frontendField = f === 'description_ru' ? 'description' : f
        const value = res.tag?.[f as keyof typeof res.tag] ?? res.tag?.[frontendField as keyof typeof res.tag]
        if (value !== undefined && value !== null) {
          (tagUpdates as any)[frontendField] = value
        } else {
          // Поле очищено — явно ставим null, чтобы UI показал "Not set"
          (tagUpdates as any)[frontendField] = null
        }
      }
      setData(prev => prev ? { ...prev, tag: { ...prev.tag, ...tagUpdates } } : null)
      setSaveStatus('success')
      setLastSavedField(field)
      setEditingField(null)
      setEditValues({})

      setTimeout(() => {
        setSaveStatus('idle')
        setLastSavedField(null)
      }, 2000)
    } catch (err: any) {
      setSaveStatus('error')
      // Show detailed validation errors from backend
      if (err.errors) {
        const errorMessages = Object.entries(err.errors).map(([k, v]) => `${k}: ${v}`).join('; ')
        setSaveError(errorMessages)
      } else {
        setSaveError(err.message || 'Save failed')
      }
    }
  }

  const updateEditValue = (field: string, value: any) => {
    setEditValues(prev => ({ ...prev, [field]: value }))
    setSaveError(null)
  }

  if (loadError) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: '#EF4444' }}>{loadError}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-[#222222]"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="ml-2 px-4 py-2 rounded-lg text-sm"
            style={{ color: '#6B7280' }}
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    )
  }

  if (loading || !data) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <RefreshCw size={18} className="animate-spin" /> Loading...
        </div>
      </div>,
      document.body
    )
  }

  const t = data.tag

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
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2563EB22' }}>
              <Tag size={18} style={{ color: '#60A5FA' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{t.tag_name}</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>ID: {t.tag_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnrich}
              disabled={enrichLoading}
              title="Запустить LLM-обогащение тега (поиск в интернете + заполнение полей)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
              style={{
                backgroundColor: '#111111',
                borderColor: enrichLoading ? '#222222' : '#10B98144',
                color: enrichLoading ? '#6B7280' : '#34D399',
                opacity: enrichLoading ? 0.7 : 1,
              }}
            >
              {enrichLoading ? (
                <><RefreshCw size={12} className="animate-spin" /> Enriching...</>
              ) : enrichSuccess ? (
                <><CheckCircle2 size={12} /> Enriched!</>
              ) : (
                <><Sparkles size={12} /> Enrich Tag</>
              )}
            </button>
            <button
              onClick={handleBackfill}
              title="Пересчитает LLM-анализ для статей этого тега (до 100 шт). Очищает ошибки, обновляет sentiment и reasoning."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:border-[#333333]"
              style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RotateCcw size={12} /> Backfill
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#222222] ml-2" style={{ color: '#9CA3AF' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">

          {/* Backfill result */}
          {backfillResult && (
            <div className="rounded-lg border px-4 py-2 text-xs" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: backfillResult.includes('OK') ? '#34D399' : '#EF4444' }}>
              {backfillResult}
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Subscribers</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#60A5FA' }}>{data.subscriber_count}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>30d Articles</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{data.daily_stats.reduce((s, d) => s + d.count, 0)}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Keywords</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{t.keywords.length}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Created</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{formatDate(t.created_at).split(',')[0]}</p>
            </div>
          </div>

          {/* Type */}
          <EditableCard
            title="Type"
            isEditing={editingField === 'tag_type'}
            onEdit={() => handleEdit('tag_type')}
            onSave={() => handleSave('tag_type')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'tag_type'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'tag_type'}
            saveError={editingField === 'tag_type' ? saveError : null}
            editChildren={
              <TagTypeSelect
                value={editValues.tag_type || t.tag_type}
                onChange={(v) => updateEditValue('tag_type', v)}
              />
            }
          >
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{t.tag_type}</p>
          </EditableCard>

          {/* Ticker */}
          <EditableCard
            title="Ticker"
            isEditing={editingField === 'ticker'}
            onEdit={() => handleEdit('ticker')}
            onSave={() => handleSave('ticker')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'ticker'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'ticker'}
            saveError={editingField === 'ticker' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.ticker || ''}
                onChange={(e) => updateEditValue('ticker', e.target.value.toUpperCase())}
                placeholder="e.g. SBER"
                className="w-full text-sm px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-sm font-semibold" style={{ color: '#60A5FA' }}>
              {t.ticker && t.ticker !== 'null' && t.ticker !== '' ? t.ticker : <span className="text-xs font-normal" style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Website */}
          <EditableCard
            title="Website"
            isEditing={editingField === 'website'}
            onEdit={() => handleEdit('website')}
            onSave={() => handleSave('website')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'website'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'website'}
            saveError={editingField === 'website' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.website || ''}
                onChange={(e) => updateEditValue('website', e.target.value)}
                placeholder="https://..."
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs">
              {t.website && t.website !== 'null' && t.website !== '' ? (
                <a href={t.website} target="_blank" rel="noopener" style={{ color: '#60A5FA' }}>{t.website} ↗</a>
              ) : (
                <span style={{ color: '#6B7280' }}>Not set</span>
              )}
            </p>
          </EditableCard>

          {/* Description */}
          <EditableCard
            title="Description"
            isEditing={editingField === 'description'}
            onEdit={() => handleEdit('description')}
            onSave={() => handleSave('description')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'description'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'description'}
            saveError={editingField === 'description' ? saveError : null}
            editChildren={
              <textarea
                value={editValues.description || ''}
                onChange={(e) => updateEditValue('description', e.target.value)}
                placeholder="Enter description..."
                rows={4}
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333] resize-vertical"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs leading-relaxed" style={{ color: '#D1D5DB' }}>
              {t.description && t.description !== 'null' ? t.description : <span style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Exchange */}
          <EditableCard
            title="Exchange"
            isEditing={editingField === 'exchange'}
            onEdit={() => handleEdit('exchange')}
            onSave={() => handleSave('exchange')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'exchange'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'exchange'}
            saveError={editingField === 'exchange' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.exchange || ''}
                onChange={(e) => updateEditValue('exchange', e.target.value.toUpperCase())}
                placeholder="MOEX, NASDAQ, LSE..."
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs" style={{ color: '#D1D5DB' }}>
              {t.exchange && t.exchange !== 'null' ? t.exchange : <span style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Trend */}
          <EditableCard
            title="Trend"
            isEditing={editingField === 'trend'}
            onEdit={() => handleEdit('trend')}
            onSave={() => handleSave('trend')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'trend'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'trend'}
            saveError={editingField === 'trend' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.trend || ''}
                onChange={(e) => updateEditValue('trend', e.target.value)}
                placeholder="AI, Green Energy, EV..."
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs" style={{ color: '#D1D5DB' }}>
              {t.trend && t.trend !== 'null' ? t.trend : <span style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Sector */}
          <EditableCard
            title="Sector"
            isEditing={editingField === 'sector'}
            onEdit={() => handleEdit('sector')}
            onSave={() => handleSave('sector')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'sector'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'sector'}
            saveError={editingField === 'sector' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.sector || ''}
                onChange={(e) => updateEditValue('sector', e.target.value)}
                placeholder="Technology, Finance, Energy..."
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs" style={{ color: '#D1D5DB' }}>
              {t.sector && t.sector !== 'null' ? t.sector : <span style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Key Products */}
          <EditableCard
            title="Key Products"
            isEditing={editingField === 'key_products'}
            onEdit={() => handleEdit('key_products')}
            onSave={() => handleSave('key_products')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'key_products'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'key_products'}
            saveError={editingField === 'key_products' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.key_products || []}
                onChange={(v) => updateEditValue('key_products', v)}
                maxItems={20}
                placeholder="Add product..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {t.key_products.length > 0 ? t.key_products.map(kp => (
                <span key={kp} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                  {kp}
                </span>
              )) : <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>}
            </div>
          </EditableCard>

          {/* Keywords */}
          <EditableCard
            title="Keywords"
            isEditing={editingField === 'keywords'}
            onEdit={() => handleEdit('keywords')}
            onSave={() => handleSave('keywords')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'keywords'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'keywords'}
            saveError={editingField === 'keywords' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.keywords || []}
                onChange={(v) => updateEditValue('keywords', v)}
                minItems={1}
                maxItems={50}
                placeholder="Add keyword..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {t.keywords.map(kw => (
                <span key={kw} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                  {kw}
                </span>
              ))}
            </div>
          </EditableCard>

          {/* Related Tags */}
          <EditableCard
            title="Related Tags"
            isEditing={editingField === 'related_tags'}
            onEdit={() => handleEdit('related_tags')}
            onSave={() => handleSave('related_tags')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'related_tags'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'related_tags'}
            saveError={editingField === 'related_tags' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.related_tags || []}
                onChange={(v) => updateEditValue('related_tags', v)}
                maxItems={20}
                placeholder="Add related tag..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {t.related_tags.length > 0 ? t.related_tags.map(rt => (
                <span key={rt} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF' }}>
                  {rt}
                </span>
              )) : <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>}
            </div>
          </EditableCard>

          {/* Synonyms RU */}
          <EditableCard
            title="Synonyms (RU)"
            isEditing={editingField === 'synonyms_ru'}
            onEdit={() => handleEdit('synonyms_ru')}
            onSave={() => handleSave('synonyms_ru')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'synonyms_ru'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'synonyms_ru'}
            saveError={editingField === 'synonyms_ru' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.synonyms_ru || []}
                onChange={(v) => updateEditValue('synonyms_ru', v)}
                maxItems={20}
                placeholder="Add Russian synonym..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {t.synonyms_ru && t.synonyms_ru.length > 0 ? t.synonyms_ru.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                  {s}
                </span>
              )) : <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>}
            </div>
          </EditableCard>

          {/* Synonyms EN */}
          <EditableCard
            title="Synonyms (EN)"
            isEditing={editingField === 'synonyms_en'}
            onEdit={() => handleEdit('synonyms_en')}
            onSave={() => handleSave('synonyms_en')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'synonyms_en'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'synonyms_en'}
            saveError={editingField === 'synonyms_en' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.synonyms_en || []}
                onChange={(v) => updateEditValue('synonyms_en', v)}
                maxItems={20}
                placeholder="Add English synonym..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {t.synonyms_en && t.synonyms_en.length > 0 ? t.synonyms_en.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                  {s}
                </span>
              )) : <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>}
            </div>
          </EditableCard>

          {/* Activity Chart */}
          {data.daily_stats.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Articles (30 days)</p>
              </div>
              <ActivityChart data={data.daily_stats} />
            </div>
          )}

          {/* Recent articles */}
          {data.recent_articles.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Recent Articles ({data.recent_articles.length})</p>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {data.recent_articles.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs truncate" style={{ color: '#FFFFFF' }} title={a.title}>{a.title}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{a.source} · {formatDate(a.published_at)}</p>
                    </div>
                    {a.sentiment_score !== null && (
                      <span className="text-xs font-mono shrink-0" style={{
                        color: a.sentiment_score > 0 ? '#34D399' : a.sentiment_score < 0 ? '#EF4444' : '#9CA3AF'
                      }}>
                        {a.sentiment_score > 0 ? '+' : ''}{a.sentiment_score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscribers */}
          {data.subscribers.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Subscribers ({data.subscribers.length})</p>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {data.subscribers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-xs" style={{ color: '#FFFFFF' }}>{s.username || s.email}</span>
                    <span className="text-xs" style={{ color: '#6B7280' }}>{formatDate(s.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete Section */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid #EF4444' }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
              style={{
                color: '#EF4444',
                border: '1px solid #EF4444',
                background: 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#EF444411' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Trash2 size={16} />
              <span className="text-sm">Delete Tag</span>
            </button>
          </div>

        </div>

        {showDeleteConfirm && (
          <DeleteConfirmModal
            tagId={tagId}
            tagName={t.tag_name}
            onClose={() => setShowDeleteConfirm(false)}
            onDeleted={handleDeleted}
          />
        )}

      </div>
    </div>,
    document.body
  )
}

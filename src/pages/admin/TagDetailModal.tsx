import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, Tag, RefreshCw, Users, FileText, RotateCcw, Trash2, Sparkles, CheckCircle2 } from 'lucide-react'
import { EditableCard } from '@/components/admin/EditableCard'
import { TagChipsInput } from '@/components/admin/TagChipsInput'
import { SitesListInput } from '@/components/admin/SitesListInput'
import { Hint } from '@/components/admin/Hint'
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
  website: string | null        // legacy, = websites[0]; not shown separately in UI
  websites: string[]            // NEW: list of sites, first = official
  wikipedia_url: string | null  // NEW: admin-only Wikipedia URL
  country: string | null        // NEW: country in Russian
  isin: string | null           // NEW: ISIN
  is_verified: boolean          // NEW: admin quality flag
  description: string | null
  key_products: string[]
  synonyms_ru: string[]
  synonyms_en: string[]
  exchange: string | null
  trend: string | null      // legacy, = trends[0]; not edited in UI
  sector: string | null     // legacy, = sectors[0]; not edited in UI
  sectors: string[]         // NEW: industry chips
  trends: string[]          // NEW: trend chips
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
    setEditValues({
      ...data.tag,
      synonyms_ru: data.tag.synonyms_ru ?? [],
      synonyms_en: data.tag.synonyms_en ?? [],
      key_products: data.tag.key_products ?? [],
      related_tags: data.tag.related_tags ?? [],
      keywords: data.tag.keywords ?? [],
      websites: data.tag.websites ?? [],
      sectors: data.tag.sectors ?? [],
      trends: data.tag.trends ?? [],
    })
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
      let value = editValues[field as keyof TagDetail]

      // Fallback: для array-полей берём актуальное значение из data.tag, если в editValues оно не задано
      const arrayFields = ['synonyms_ru', 'synonyms_en', 'key_products', 'related_tags', 'keywords', 'websites', 'sectors', 'trends']
      if (value === undefined && arrayFields.includes(field)) {
        value = (data.tag as any)[field] ?? []
      }

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

  const handleVerifiedToggle = async () => {
    if (!data) return
    const next = !data.tag.is_verified
    // Optimistic update
    setData(prev => prev ? { ...prev, tag: { ...prev.tag, is_verified: next } } : null)
    try {
      await adminApi.put(`/admin/tags/${tagId}`, { is_verified: next })
    } catch (err: any) {
      // Rollback
      setData(prev => prev ? { ...prev, tag: { ...prev.tag, is_verified: !next } } : null)
      alert(err.message || 'Failed to update Verified')
    }
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
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-all hover:border-[#333333]"
              style={{
                backgroundColor: '#111111',
                borderColor: data.tag.is_verified ? '#10B98144' : '#222222',
                color: data.tag.is_verified ? '#34D399' : '#6B7280',
              }}
              title="Отметить тег как качественно заполненный"
            >
              <input
                type="checkbox"
                checked={data.tag.is_verified}
                onChange={handleVerifiedToggle}
                className="accent-emerald-500"
              />
              Verified
              <Hint text="Админская отметка: тег проверен и заполнен качественно. Нигде не используется — ни на что не влияет. Хранится отдельной колонкой, поэтому не сбрасывается при повторном обогащении." />
            </label>
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
            hint="Тип тега: company, ticker, sector, trend, person, commodity, index, currency. Определяется эвристикой при создании, уточняется LLM при обогащении. Влияет на цвет тега в ленте."
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
            hint="Биржевой тикер (AAPL, SBER, NVDA). Используется для идентификации и попадает в keywords."
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

          {/* Sites */}
          <EditableCard
            title="Sites"
            hint="Сайты, связанные с тегом. Первый в списке — официальный: он автоматически дублируется в legacy-поле website, которое видят юзеры в публичной карточке тега. До 10 ссылок."
            isEditing={editingField === 'websites'}
            onEdit={() => handleEdit('websites')}
            onSave={() => handleSave('websites')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'websites'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'websites'}
            saveError={editingField === 'websites' ? saveError : null}
            editChildren={
              <SitesListInput
                value={editValues.websites || t.websites || []}
                onChange={(v) => updateEditValue('websites', v)}
              />
            }
          >
            <div className="space-y-1">
              {(t.websites || []).length > 0 ? (
                t.websites.map((site, i) => (
                  <div key={`${site}-${i}`} className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: i === 0 ? '#2563EB22' : 'transparent', color: i === 0 ? '#60A5FA' : '#4B5563' }}
                    >
                      {i === 0 ? 'official' : `${i + 1}`}
                    </span>
                    <a href={site} target="_blank" rel="noopener" className="text-xs truncate hover:opacity-80" style={{ color: '#60A5FA' }}>
                      {site} ↗
                    </a>
                  </div>
                ))
              ) : (
                <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>
              )}
            </div>
          </EditableCard>

          {/* Wikipedia */}
          <EditableCard
            title="Wikipedia"
            hint="Ссылка на статью Wikipedia. Только для админки — юзеру не показывается. Заполняется LLM при обогащении, можно править вручную."
            isEditing={editingField === 'wikipedia_url'}
            onEdit={() => handleEdit('wikipedia_url')}
            onSave={() => handleSave('wikipedia_url')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'wikipedia_url'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'wikipedia_url'}
            saveError={editingField === 'wikipedia_url' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.wikipedia_url || ''}
                onChange={(e) => updateEditValue('wikipedia_url', e.target.value)}
                placeholder="https://ru.wikipedia.org/wiki/..."
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-xs">
              {t.wikipedia_url ? (
                <a href={t.wikipedia_url} target="_blank" rel="noopener" style={{ color: '#60A5FA' }}>{t.wikipedia_url} ↗</a>
              ) : (
                <span style={{ color: '#6B7280' }}>Not set</span>
              )}
            </p>
          </EditableCard>

          {/* Country */}
          <EditableCard
            title="Country"
            hint="Страна тега (на русском: «Россия», «США»). Атрибут, а не тип тега. Не участвует в матчинге новостей — иначе были бы ложные срабатывания."
            isEditing={editingField === 'country'}
            onEdit={() => handleEdit('country')}
            onSave={() => handleSave('country')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'country'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'country'}
            saveError={editingField === 'country' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.country || ''}
                onChange={(e) => updateEditValue('country', e.target.value)}
                placeholder="Россия"
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              />
            }
          >
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
              {t.country || <span className="text-xs font-normal" style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* ISIN */}
          <EditableCard
            title="ISIN"
            hint="Международный код ценной бумаги, 12 символов (RU0009029540). Только для торгуемых инструментов. По ISIN тег находится через поиск тегов."
            isEditing={editingField === 'isin'}
            onEdit={() => handleEdit('isin')}
            onSave={() => handleSave('isin')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'isin'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'isin'}
            saveError={editingField === 'isin' ? saveError : null}
            editChildren={
              <input
                type="text"
                value={editValues.isin || ''}
                onChange={(e) => updateEditValue('isin', e.target.value.toUpperCase())}
                placeholder="RU0009029540"
                maxLength={12}
                className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#D1D5DB', fontFamily: 'monospace' }}
              />
            }
          >
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>
              {t.isin || <span className="text-xs font-normal" style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </EditableCard>

          {/* Description */}
          <EditableCard
            title="Description"
            hint="Описание тега на русском, 2 абзаца. Пишет LLM при обогащении по данным веб-поиска. Видно юзеру в публичной карточке тега."
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
            hint="Биржа листинга (NASDAQ, MOEX). Одна на тег. Не участвует в keywords; используется в поиске тегов и в finnhub-интеграции (фильтр USA)."
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

          {/* Sectors */}
          <EditableCard
            title="Sectors"
            hint="Индустрии/сектора тега — их может быть несколько. Первый чипс дублируется в legacy-поле sector для поиска. В keywords не попадают: иначе новости об индустрии матчились бы ко всем тегам этого сектора."
            isEditing={editingField === 'sectors'}
            onEdit={() => handleEdit('sectors')}
            onSave={() => handleSave('sectors')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'sectors'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'sectors'}
            saveError={editingField === 'sectors' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.sectors || t.sectors || []}
                onChange={(v) => updateEditValue('sectors', v)}
                maxItems={10}
                placeholder="Add sector..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {(t.sectors || []).length > 0 ? (
                t.sectors.map((s, i) => (
                  <span key={`${s}-${i}`} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>
              )}
            </div>
          </EditableCard>

          {/* Trends */}
          <EditableCard
            title="Trends"
            hint="Тренды/темы, связанные с тегом, — их может быть несколько. Первый чипс дублируется в legacy-поле trend для поиска. В keywords не попадают."
            isEditing={editingField === 'trends'}
            onEdit={() => handleEdit('trends')}
            onSave={() => handleSave('trends')}
            onCancel={handleCancel}
            isSaving={saveStatus === 'saving' && editingField === 'trends'}
            saveSuccess={saveStatus === 'success' && lastSavedField === 'trends'}
            saveError={editingField === 'trends' ? saveError : null}
            editChildren={
              <TagChipsInput
                value={editValues.trends || t.trends || []}
                onChange={(v) => updateEditValue('trends', v)}
                maxItems={10}
                placeholder="Add trend..."
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {(t.trends || []).length > 0 ? (
                t.trends.map((s, i) => (
                  <span key={`${s}-${i}`} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>
              )}
            </div>
          </EditableCard>

          {/* Key Products */}
          <EditableCard
            title="Key Products"
            hint="Ключевые продукты и сервисы (iPhone, СберБанк Онлайн). Попадают в keywords → напрямую влияют на матчинг новостей к тегу."
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
            hint="Слова, по которым новости матчатся к тегу (Layer 1). Пересобираются автоматически из enriched-полей при любом сохранении — ручная правка отключает автосборку до следующего явного изменения."
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
            hint="Связанные теги/сущности. Показываются в UI и участвуют в поиске тегов, но НЕ в keywords — иначе чужие новости матчились бы к этому тегу."
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
            hint="Русские синонимы и транслитерации («Сбер», «эппл»). Попадают в keywords → влияют на матчинг новостей."
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
            hint="Английские синонимы и алиасы. Попадают в keywords → влияют на матчинг новостей."
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

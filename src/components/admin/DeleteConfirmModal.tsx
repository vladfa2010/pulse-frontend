import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { Trash2, AlertTriangle, X } from 'lucide-react'

interface DeletePreview {
  tag_id: string
  tag_name: string
  links_count: number
  portfolios_count: number
  matched_articles_count: number
  llm_articles_count: number
  related_tags_count: number
  smart_cache_entries: number
}

interface Props {
  tagId: string
  tagName: string
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteConfirmModal({ tagId, tagName, onClose, onDeleted }: Props) {
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [safetyInput, setSafetyInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.get(`/admin/tags/${tagId}/delete-preview`)
      .then(setPreview)
      .catch((err: any) => setError(err.message || 'Failed to load preview'))
      .finally(() => setLoading(false))
  }, [tagId])

  const handleDelete = async () => {
    if (safetyInput !== tagId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await adminApi.delete(`/admin/tags/${tagId}`)
      onDeleted()
    } catch (err: any) {
      setDeleting(false)
      setDeleteError(err.message || 'Delete failed')
    }
  }

  const isSafetyMatch = safetyInput === tagId

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div
        className="rounded-xl border w-full mx-4 overflow-hidden"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF444422' }}>
            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Delete Tag</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#222222]" style={{ color: '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-sm text-center py-4" style={{ color: '#6B7280' }}>Loading preview...</div>
          ) : error ? (
            <div className="text-sm text-center py-4" style={{ color: '#EF4444' }}>{error}</div>
          ) : preview ? (
            <>
              <p className="text-sm" style={{ color: '#D1D5DB' }}>
                Delete <strong style={{ color: '#FFFFFF' }}>"{tagName}"</strong> (<code style={{ color: '#9CA3AF' }}>{tagId}</code>)?
                This action cannot be undone.
              </p>

              {/* Stats */}
              <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Will be cleaned:</p>
                {[
                  { label: 'Article links (news_tag_links)', count: preview.links_count },
                  { label: 'User subscriptions (portfolios)', count: preview.portfolios_count },
                  { label: 'Articles (matched_tags)', count: preview.matched_articles_count },
                  { label: 'Articles (tag_impact)', count: preview.llm_articles_count },
                  { label: 'Cache entries (smart_tag_cache)', count: preview.smart_cache_entries },
                  { label: 'Related tag references', count: preview.related_tags_count },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span style={{ color: '#9CA3AF' }}>{item.label}</span>
                    <span className="font-mono" style={{ color: item.count > 0 ? '#EF4444' : '#6B7280' }}>{item.count}</span>
                  </div>
                ))}
              </div>

              {/* Safety Input */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                  Type <code style={{ color: '#EF4444' }}>{tagId}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={safetyInput}
                  onChange={e => setSafetyInput(e.target.value)}
                  placeholder={tagId}
                  className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#EF4444]"
                  style={{ borderColor: '#222222', color: '#FFFFFF' }}
                />
              </div>

              {deleteError && (
                <div className="text-xs py-2 px-3 rounded" style={{ color: '#EF4444', backgroundColor: '#EF444411' }}>
                  {deleteError}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#222222' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222]"
            style={{ color: '#9CA3AF' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isSafetyMatch || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isSafetyMatch && !deleting ? '#EF4444' : '#333333',
              color: '#FFFFFF',
            }}
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting...' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

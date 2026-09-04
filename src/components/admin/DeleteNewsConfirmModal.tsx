import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  title: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
  error: string | null
}

/**
 * Диалог подтверждения удаления новости (ТЗ-удаление-новости-админом v1.3).
 * Образец — DeleteConfirmModal.tsx, НО оверлей z-[80] (не z-[60] образца):
 * модалка новости NewsDetailModal живёт на z-[70], с z-60 диалог ушёл бы под неё.
 * Esc не обрабатываем здесь — гард живёт в NewsDetailModal (инаце двойная обработка).
 */
export default function DeleteNewsConfirmModal({ title, onConfirm, onCancel, isLoading, error }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-xl border w-full mx-4 overflow-hidden"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F59E0B22' }}>
            <AlertTriangle size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Удалить новость?</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: '#D1D5DB' }}>
            Вы точно хотите удалить новость <strong style={{ color: '#FFFFFF' }}>«{title}»</strong>?
          </p>
          <p className="text-xs" style={{ color: '#EF4444' }}>Это действие необратимо.</p>

          {/* Связанные данные (5 таблиц с ON DELETE CASCADE — раздел 6.1 ТЗ) */}
          <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#6B7280' }}>Будут удалены связанные данные:</p>
            <ul className="text-xs space-y-1" style={{ color: '#9CA3AF' }}>
              <li>— Привязки к тегам (news_tag_links)</li>
              <li>— Отметки прочтения (user_news_reads)</li>
              <li>— Записи об отправленных пушах (push_notifications_sent)</li>
              <li>— Задачи факт-чекинга (fact_check_jobs)</li>
              <li>— Сессии факт-чекинга (fact_check_sessions)</li>
            </ul>
          </div>

          {error && (
            <div className="text-xs py-2 px-3 rounded" style={{ color: '#EF4444', backgroundColor: '#EF444411' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#222222' }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50"
            style={{ color: '#9CA3AF' }}
          >
            Нет, отменить
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                Удаление...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Да, удалить
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

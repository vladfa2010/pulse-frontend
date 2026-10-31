import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
  error: string | null
}

/**
 * Диалог подтверждения сброса результата фактчека (ТЗ-210).
 * Образец — DeleteNewsConfirmModal.tsx: тот же оверлей z-[80]
 * (модалка новости NewsDetailModal живёт на z-[70]).
 */
export default function DeleteFactCheckConfirmModal({ onConfirm, onCancel, isLoading, error }: Props) {
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
            <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Удалить фактчек?</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: '#D1D5DB' }}>
            Результат проверки будет удалён, новость вернётся в статус «не проверена».
            Пользователи потеряют доступ к результату, активные ссылки шеринга перестанут работать.
            Действие нельзя отменить.
          </p>

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
            Отмена
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
                Удалить фактчек
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

import { Download, X, Sparkles, Loader2 } from 'lucide-react'

interface AppUpdateModalProps {
  version: string
  onUpdate: () => void
  onDismiss: () => void
  updating?: boolean
  progress?: number
}

export function AppUpdateModal({ version, onUpdate, onDismiss, updating, progress = 0 }: AppUpdateModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'rgba(20, 20, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 153, 204, 0.1))' }}
          >
            <Sparkles size={18} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Доступно обновление</h3>
            <p className="text-xs text-[#6B7280]">Версия {version}</p>
          </div>
        </div>

        {updating ? (
          <div className="mb-6">
            <div className="flex items-center gap-3 text-sm text-[#9CA3AF] mb-3">
              <Loader2 size={18} className="animate-spin" style={{ color: '#00D4FF' }} />
              Загрузка обновления… Не закрывайте приложение.
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: 'linear-gradient(90deg, #00D4FF, #0099CC)' }}
              />
            </div>
            <p className="text-xs text-[#6B7280] mt-2 text-right">{progress}%</p>
          </div>
        ) : (
          <p className="text-sm text-[#9CA3AF] mb-6">
            Новая версия приложения уже собрана. Установи её, чтобы получить последние исправления и функции.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            disabled={updating}
            className="flex-1 h-11 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#9CA3AF' }}
          >
            <X size={16} className="inline mr-2" />
            Позже
          </button>
          <button
            onClick={onUpdate}
            disabled={updating}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
          >
            <Download size={16} className="inline mr-2" />
            {updating ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
      </div>
    </div>
  )
}

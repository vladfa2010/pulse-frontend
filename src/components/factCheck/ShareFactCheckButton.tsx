/**
 * PULSE — Кнопка шеринга результата фактчека (ТЗ-209, ТЗ-211).
 *
 * Переиспользуемый компонент: POST /api/news/:id/fact-check/share →
 * модалка «Ссылка на результат» с копированием (многоразовая, TTL 7 дней).
 *
 * Варианты:
 *   full — кнопка на всю ширину с текстом (карточка новости, FactCheckSection);
 *   icon — иконка Share2 для шапок/тулбаров (детальная модалка /factcheck).
 *      Ошибки (409/429/404) показываем в модалке — рядом с иконкой места нет.
 *
 * Условия видимости (result без error, авторизация) решает вызывающий код —
 * компонент только кнопка + модалка.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Copy, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Props {
  newsId: string
  variant?: 'full' | 'icon'
}

export default function ShareFactCheckButton({ newsId, variant = 'full' }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const handleShare = async () => {
    setShareLoading(true)
    setShareError(null)
    try {
      const res = await api.post(`/news/${newsId}/fact-check/share`, {})
      setShareUrl(res.url)
      setModalOpen(true)
    } catch (err: any) {
      const message = err?.message || 'Не удалось создать ссылку'
      if (variant === 'icon') {
        // В шапке нет места для инлайн-текста — ошибку показываем в модалке
        setShareUrl(null)
        setShareError(message)
        setModalOpen(true)
      } else {
        setShareError(message)
      }
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // clipboard может быть недоступен — юзер скопирует из поля вручную
    }
  }

  const close = () => {
    setModalOpen(false)
    setShareError(null)
  }

  return (
    <>
      {variant === 'full' ? (
        <>
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1a1a1a', color: '#D1D5DB', border: '1px solid #222' }}
          >
            {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            Поделиться результатом
          </button>
          {shareError && (
            <p className="text-xs text-center" style={{ color: '#EF4444' }}>
              {shareError}
            </p>
          )}
        </>
      ) : (
        <button
          onClick={handleShare}
          disabled={shareLoading}
          title="Поделиться фактчеком"
          aria-label="Поделиться фактчеком"
          className="flex p-1 transition-colors shrink-0 disabled:opacity-50"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => { if (!shareLoading) e.currentTarget.style.color = '#FFFFFF' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280' }}
        >
          {shareLoading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
        </button>
      )}

      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: '#111111', border: '1px solid #222' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-100">
                {shareUrl ? 'Ссылка на результат' : 'Не удалось создать ссылку'}
              </p>
              <button onClick={close} style={{ color: '#6B7280' }}>
                <X size={16} />
              </button>
            </div>
            {shareUrl ? (
              <>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  Гость увидит результат проверки без регистрации. Ссылка многоразовая и живёт 7 дней.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 px-3 py-2 rounded-lg text-xs bg-[#0A0A0A] border border-[#222] text-gray-300"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={
                      shareCopied
                        ? { backgroundColor: '#34D39920', color: '#34D399', border: '1px solid #34D39940' }
                        : { backgroundColor: '#00D4FF', color: '#050505' }
                    }
                  >
                    {shareCopied ? <Check size={12} /> : <Copy size={12} />}
                    {shareCopied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs" style={{ color: '#EF4444' }}>
                {shareError}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

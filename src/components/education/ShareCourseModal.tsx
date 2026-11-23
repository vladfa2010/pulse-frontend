/**
 * =============================================================================
 * PULSE — Модалка «Поделиться курсом» (ТЗ-205)
 * =============================================================================
 *
 * Постоянная ссылка на курс (без токенов, в отличие от magic-link уроков ТЗ-187):
 * canonicalCourse(slug) + UTM-метки. Каналы: copy / нативный шаринг
 * (navigator.share, мобильные) / Telegram (десктоп). Аналитика —
 * snake_case без точек (Firebase молча дропает dotted-имена): education_course_shared.
 * logAnalyticsEvent — no-op на Capacitor: в приложении события не будет (ожидаемо).
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Share2, Copy, Check, Send } from 'lucide-react'
import { canonicalCourse, courseTitle, metaDescription } from '@/lib/seo'
import { logAnalyticsEvent } from '@/lib/analytics'

interface Props {
  slug: string
  courseName: string
  description?: string | null
  onClose: () => void
}

const UTM = '?utm_source=share&utm_medium=social&utm_campaign=course_share'

export default function ShareCourseModal({ slug, courseName, description, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)

  const shareUrl = canonicalCourse(slug) + UTM
  const shareTitle = courseTitle(courseName)
  const shareText = metaDescription(description) || shareTitle

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current) }, [])

  const track = (channel: 'copy' | 'native' | 'telegram') =>
    logAnalyticsEvent('education_course_shared', { course_id: slug, slug, channel })

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Фолбэк для окружений без Clipboard API (старые WebView) — паттерн SharePathModal
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    track('copy')
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const onNativeShare = async () => {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
      track('native')
    } catch {
      /* юзер отменил шаринг — не ошибка */
    }
  }

  const onTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      '_blank',
    )
    track('telegram')
  }

  const hasNativeShare = typeof navigator.share === 'function'

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,.66)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[18px] p-6 relative"
        style={{
          maxWidth: 420,
          background: 'rgba(16,16,16,.92)',
          border: '1px solid #2a2a2a',
          animation: 'shareCourseIn .25s cubic-bezier(.16,1,.3,1) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes shareCourseIn { from { transform: translateY(10px) scale(.97); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 transition-colors"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-semibold mb-1" style={{ color: '#FFFFFF' }}>
          Поделиться курсом
        </h3>
        <p className="mb-4" style={{ fontSize: 12, color: '#6B7280' }}>
          {shareTitle}
        </p>

        {/* Поле ссылки */}
        <div
          className="flex items-center gap-2 mb-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <code
            className="flex-1 truncate"
            style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#9CA3AF' }}
            title={shareUrl}
          >
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Скопировать ссылку"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
            style={{
              border: '1px solid rgba(0,212,255,.25)',
              color: copied ? '#34D399' : '#00D4FF',
              background: 'rgba(0,212,255,.08)',
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span style={{ fontSize: 11 }}>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>

        {/* Каналы */}
        <div className="flex flex-col gap-2 mt-4">
          {hasNativeShare && (
            <button
              type="button"
              onClick={onNativeShare}
              className="flex items-center justify-center gap-2 rounded-full h-10 font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                color: '#060606',
                fontSize: 13,
              }}
            >
              <Share2 size={15} /> Поделиться…
            </button>
          )}
          <button
            type="button"
            onClick={onTelegram}
            className="flex items-center justify-center gap-2 rounded-full h-10 font-semibold transition-colors"
            style={{ background: '#161616', border: '1px solid #222222', color: '#E5E7EB', fontSize: 13 }}
          >
            <Send size={14} style={{ color: '#0088CC' }} /> Отправить в Telegram
          </button>
        </div>

        <p className="mt-4 text-center" style={{ fontSize: 11, color: '#6B7280' }}>
          Получателю не нужен аккаунт — страница курса открыта всем
        </p>
      </div>
    </div>,
    document.body,
  )
}

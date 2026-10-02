import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw, Share2, Trash2 } from 'lucide-react'
import GlassModal from '@/components/GlassModal'
import {
  createPathShare,
  fetchPathShare,
  revokePathShare,
} from '@/lib/educationApi'
import type { PathShare } from '@/lib/educationApi'

// Мodal «Поделиться путём» (шеринг инвестиционного пути).
// При первом открытии, если ссылки ещё нет (token === null) — сразу создаём (POST).
// «Перевыпустить» — двухшаговое подтверждение (старая ссылка мгновенно умрёт).
// «Отозвать» — destructive, после 204 показываем состояние «ссылки нет».

interface Props {
  open: boolean
  onClose: () => void
}

export default function SharePathModal({ open, onClose }: Props) {
  const [share, setShare] = useState<PathShare | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmReissue, setConfirmReissue] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const copyTimer = useRef<number | null>(null)

  // Загрузка/создание ссылки при открытии
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setCopied(false)
    setConfirmReissue(false)
    setConfirmRevoke(false)
    fetchPathShare()
      .catch(() => null) // GET упал — всё равно попробуем создать
      .then(current => {
        if (cancelled) return
        if (current?.token) {
          setShare(current)
          setLoading(false)
        } else {
          // Ссылки ещё нет — создаём сразу при первом открытии
          createPathShare()
            .then(created => { if (!cancelled) setShare(created) })
            .catch(err => { if (!cancelled) setError(err?.message || 'Не удалось создать ссылку') })
            .finally(() => { if (!cancelled) setLoading(false) })
        }
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

  const onCopy = async () => {
    if (!share?.url) return
    try {
      await navigator.clipboard.writeText(share.url)
    } catch {
      // Фолбэк для окружений без Clipboard API (старые WebView)
      const ta = document.createElement('textarea')
      ta.value = share.url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const onReissue = () => {
    if (busy) return
    if (!confirmReissue) {
      setConfirmReissue(true)
      setConfirmRevoke(false)
      return
    }
    setBusy(true)
    setError(null)
    createPathShare()
      .then(created => {
        setShare(created)
        setCopied(false)
        setConfirmReissue(false)
      })
      .catch(err => setError(err?.message || 'Не удалось перевыпустить ссылку'))
      .finally(() => setBusy(false))
  }

  const onRevoke = () => {
    if (busy) return
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      setConfirmReissue(false)
      return
    }
    setBusy(true)
    setError(null)
    revokePathShare()
      .then(() => {
        setShare({ token: null, url: null })
        setConfirmRevoke(false)
        setCopied(false)
      })
      .catch(err => setError(err?.message || 'Не удалось отозвать ссылку'))
      .finally(() => setBusy(false))
  }

  const ghostBtn =
    'flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-semibold border border-[#222] text-[#9CA3AF] hover:border-[#3a3a3a] hover:text-white transition-colors disabled:opacity-50'

  return (
    <GlassModal open={open} onClose={onClose} title="Поделиться путём">
      <p className="text-[12px] text-[#9CA3AF] leading-relaxed mb-4">
        По ссылке видны ваши курсы и прогресс — без доступа к личным данным.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : share?.url ? (
        <>
          <div
            className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 mb-3"
            style={{ background: '#161616', border: '1px solid #222' }}
          >
            <Share2 size={14} className="flex-none text-[#6B7280]" />
            <span className="flex-1 min-w-0 text-[12px] text-[#9CA3AF] truncate">{share.url}</span>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 mb-3"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onReissue} disabled={busy} className={ghostBtn} style={confirmReissue ? { borderColor: 'rgba(245,158,11,.5)', color: '#F59E0B' } : undefined}>
              <RefreshCw size={13} />
              {confirmReissue ? 'Старая ссылка умрёт. Точно?' : 'Перевыпустить'}
            </button>
            <button
              type="button"
              onClick={onRevoke}
              disabled={busy}
              className={ghostBtn}
              style={confirmRevoke
                ? { borderColor: 'rgba(239,68,68,.6)', color: '#EF4444' }
                : { borderColor: 'rgba(239,68,68,.3)', color: '#F87171' }}
            >
              <Trash2 size={13} />
              {confirmRevoke ? 'Точно отозвать?' : 'Отозвать'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[#9CA3AF] mb-4">Ссылка отозвана. Создать новую?</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError(null)
              createPathShare()
                .then(created => setShare(created))
                .catch(err => setError(err?.message || 'Не удалось создать ссылку'))
                .finally(() => setBusy(false))
            }}
            className="w-full h-10 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
          >
            {busy ? 'Создаём…' : 'Создать ссылку'}
          </button>
        </>
      )}

      {error && <p className="text-[12px] text-[#F87171] mt-3">{error}</p>}
    </GlassModal>
  )
}

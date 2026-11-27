/**
 * =============================================================================
 * PULSE — Шеринг цитаты из урока: карточка-изображение + шит (ТЗ-237, этап 2)
 * =============================================================================
 *
 * Решение владельца 2026-11-27: одно действие — «ссылка равна карточке».
 * Мобильный путь: canvas-карточка 1080×1350 (эфемерный blob, нигде не
 * хранится) → navigator.share({files, text, url}) — в Telegram/WhatsApp уходят
 * PNG и ссылка одним сообщением (ссылка даёт OG-превью /q/:token).
 * Фолбэки: (а) нет canShare({files}) → share только ссылки; (б) нет
 * navigator.share (десктоп) → в шите «копировать ссылку · скачать PNG».
 * Карточка — §2.7 (1:1), document.fonts.ready перед отрисовкой (техлид).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2 } from 'lucide-react'
import { logAnalyticsEvent } from '@/lib/analytics'

// ─── Карточка-цитата 1080×1350 (§2.7) ────────────────────────────────────────

export async function makeQuoteCardBlob(quote: string, courseTitle: string): Promise<Blob | null> {
  try {
    // шрифт обязан быть загружен ДО fillText, иначе fallback-шрифт (техлид-ревью)
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))])
    await document.fonts.load('500 34px Inter').catch(() => undefined)
    await document.fonts.load('700 40px Inter').catch(() => undefined)

    const W = 1080, H = 1350, PAD = 90
    const cv = document.createElement('canvas')
    cv.width = W; cv.height = H
    const ctx = cv.getContext('2d')
    if (!ctx) return null

    // фон: градиент #0A1A22 → #060606 (160°)
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H)
    g.addColorStop(0, '#0A1A22')
    g.addColorStop(0.55, '#060606')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // радиальное свечение top-right rgba(0,212,255,.14)
    const glow = ctx.createRadialGradient(W - 80, 60, 0, W - 80, 60, 520)
    glow.addColorStop(0, 'rgba(0,212,255,.14)')
    glow.addColorStop(1, 'rgba(0,212,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    // рамка 1px #33383F
    ctx.strokeStyle = '#33383F'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)

    // кавычка “ — Inter 700, #00D4FF
    ctx.fillStyle = '#00D4FF'
    ctx.font = '700 150px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText('\u201C', PAD - 10, PAD - 40)

    // текст цитаты — Inter 500, lh 1.5, #FFFFFF; эллипсис > ~300 знаков
    const text = quote.length > 300 ? `${quote.slice(0, 300)}…` : quote
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '500 40px Inter, system-ui, sans-serif'
    const lineH = 60
    const maxW = W - PAD * 2
    const words = text.split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w }
      else cur = t
    }
    if (cur) lines.push(cur)
    const maxLines = 12
    const show = lines.slice(0, maxLines)
    if (lines.length > maxLines) show[maxLines - 1] = `${show[maxLines - 1].slice(0, -1)}…`
    let y = PAD + 130
    for (const line of show) { ctx.fillText(line, PAD, y); y += lineH }

    // футер: border-top #222222; курс — 700 uppercase ls.06em #00D4FF; бренд #9CA3AF
    const fy = H - 170
    ctx.strokeStyle = '#222222'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(PAD, fy); ctx.lineTo(W - PAD, fy); ctx.stroke()
    ctx.font = '700 30px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#00D4FF'
    const course = courseTitle.length > 40 ? `${courseTitle.slice(0, 40)}…` : courseTitle
    ctx.fillText(course.toUpperCase(), PAD, fy + 34)
    ctx.font = '400 26px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#9CA3AF'
    ctx.fillText('PULSE · pulse.inside-trade.ru', PAD, fy + 84)

    return await new Promise<Blob | null>(resolve => cv.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}

// ─── Оркестрация шеринга ─────────────────────────────────────────────────────

export type SharePath = 'files' | 'link_only' | 'copy_link' | 'download_png'

/** Мобильный основной путь. Возвращает выбранную ветку или null (нет navigator.share). */
export async function shareViaNavigator(blob: Blob | null, quote: string, url: string): Promise<SharePath | null> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share !== 'function') return null
  const text = quote.length > 120 ? `${quote.slice(0, 120)}…` : quote
  if (blob) {
    const file = new File([blob], 'quote.png', { type: 'image/png' })
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text, url })
        return 'files'
      } catch { /* отмена юзером — не ошибка */ return 'files' }
    }
  }
  try {
    await nav.share({ url, title: 'Цитата из курса · PULSE', text })
    return 'link_only'
  } catch { return 'link_only' }
}

// ─── Шит «Поделиться» (§2.6) ─────────────────────────────────────────────────

interface SheetProps {
  quote: string
  courseTitle: string
  shareUrl: string
  onClose: () => void
  onToast: (msg: string) => void
}

export default function QuoteShareSheet({ quote, courseTitle, shareUrl, onClose, onToast }: SheetProps) {
  const [busy, setBusy] = useState(false)
  const blobRef = useRef<Blob | null>(null)
  const hasNativeShare = typeof (navigator as any).share === 'function'

  // карточка генерится один раз на открытие шита (эфемерно, §8 п.3)
  useEffect(() => {
    let alive = true
    void makeQuoteCardBlob(quote, courseTitle).then(b => { if (alive) blobRef.current = b })
    return () => { alive = false }
  }, [quote, courseTitle])

  const doShare = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (!blobRef.current) blobRef.current = await makeQuoteCardBlob(quote, courseTitle)
      const path = await shareViaNavigator(blobRef.current, quote, shareUrl)
      if (path) {
        logAnalyticsEvent('hl_shared', { path })
        onClose()
      } else {
        onToast('Шеринг недоступен — скопируйте ссылку')
      }
    } finally {
      setBusy(false)
    }
  }, [busy, quote, courseTitle, shareUrl, onClose, onToast])

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(shareUrl).then(
      () => { logAnalyticsEvent('hl_shared', { path: 'copy_link' }); onToast('Скопировано'); onClose() },
      () => onToast('Не удалось скопировать'),
    )
  }, [shareUrl, onToast, onClose])

  const downloadPng = useCallback(async () => {
    if (!blobRef.current) blobRef.current = await makeQuoteCardBlob(quote, courseTitle)
    if (!blobRef.current) { onToast('Не удалось создать картинку'); return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blobRef.current)
    a.download = 'quote.png'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    logAnalyticsEvent('hl_shared', { path: 'download_png' })
    onClose()
  }, [quote, courseTitle, onToast, onClose])

  return createPortal(
    <>
      <div className="hl-sheet-dim" onClick={onClose} />
      <div className="hl-sheet">
        <div className="grab" />
        <div className="ttl">Поделиться цитатой</div>
        {hasNativeShare && (
          <button type="button" className="opt" onClick={() => void doShare()} disabled={busy}>
            <span className="ic"><Share2 size={18} /></span>
            <span>
              <span className="nm">{busy ? 'Готовим карточку…' : 'Поделиться'}</span>
              <div className="sb">Карточка-цитата и ссылка одним сообщением</div>
            </span>
          </button>
        )}
        {!hasNativeShare && (
          <div className="fb">
            <a onClick={copyLink}>копировать ссылку</a>
            {' · '}
            <a onClick={() => void downloadPng()}>скачать PNG</a>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

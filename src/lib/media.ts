/**
 * =============================================================================
 * PULSE — резолвер медиа-URL (LMS storage)
 * =============================================================================
 *
 * Конвенция хранения (docs/education.md): в БД — ТОЛЬКО относительные пути
 * `/media/<kind>/<uuid>.<ext>`. В браузере они резолвятся к origin сайта
 * (caddy: /media/tile-reveal|hero-video → dist, остальное → backend mediaGuard).
 *
 * В нативном Android-приложении (Capacitor) origin WebView — https://localhost,
 * поэтому относительный `/media/...` уходит в localhost и даёт 404 — отсюда
 * «битые» обложки/картинки образования в приложении при рабочей главной
 * (статика public/ зашита в APK и отдаётся WebViewAssetHandler локально).
 *
 * Правило: на нативной платформе любой относительный /media/* превращаем
 * в абсолютный URL к API-ориджину. В web — возвращаем путь как есть
 * (тот же origin, caddy-кэш и cookie не ломаются).
 */

import { Capacitor } from '@capacitor/core'
import { API_BASE } from './api'

const API_ORIGIN = API_BASE.replace(/\/api$/, '')

/** Относительный путь storage (/media/...) → URL, рабочий и в web, и в приложении. */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  if (Capacitor.isNativePlatform()) return `${API_ORIGIN}${path}`
  return path
}

/** Тот же резолв для HTML конспекта/описания: <img src="/media/..."> → абсолютный src. */
export function resolveMediaHtml(html: string): string {
  if (!Capacitor.isNativePlatform()) return html
  return html.replace(/(\s(?:src|href)=["'])(\/media\/[^"']*)(["'])/g, `$1${API_ORIGIN}$2$3`)
}

/**
 * =============================================================================
 * PULSE — Радио: клиентский TTS через серверный прокси (ТЗ-44, задача 1)
 * =============================================================================
 *
 * Прямой вызов Minimax из браузера НЕ переносится (ключ — только на сервере,
 * ТЗ-42). Эта обёртка ходит в POST /api/radio/tts (authMiddleware) и отдаёт
 * Blob mp3. Ошибки несут status: 503 tts_not_configured (нет ключа на сервере
 * — useSpeech фолбэкается на браузерный синтез), 502 tts_upstream (сегмент
 * пропускается, очередь идёт дальше).
 */
import { API_BASE } from '@/lib/api'

export interface RadioTtsOptions {
  voiceId: string
  speed?: number
  /** −12..+12; аналитик при общем голосе на обе роли — +2 полутона */
  pitch?: number
}

export class RadioTtsError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'RadioTtsError'
    this.status = status
  }
}

/** синтез речи: текст → Blob mp3 через /api/radio/tts */
export async function serverTTS(
  text: string,
  opts: RadioTtsOptions,
  signal?: AbortSignal
): Promise<Blob> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pulse_token') || '' : ''
  const res = await fetch(`${API_BASE}/radio/tts`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: opts.voiceId,
      speed: opts.speed ?? 1,
      pitch: opts.pitch ?? 0,
    }),
  })
  if (!res.ok) {
    let code = `tts_http_${res.status}`
    try {
      const data = await res.json()
      if (data?.error) code = data.error
    } catch {
      /* тело не json — оставляем код по статусу */
    }
    throw new RadioTtsError(res.status, code)
  }
  return res.blob()
}

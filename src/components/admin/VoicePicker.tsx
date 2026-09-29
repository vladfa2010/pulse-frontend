/**
 * PULSE — Админка: выбор голосов TTS с тестовым прослушиванием (ТЗ68).
 *
 * Список: GET /api/admin/radio/voices — динамический каталог Minimax
 *         (POST /v1/get_voice) + метаданные + probe доступности (inAccount).
 * Превью: POST /api/admin/radio/voices/preview → mp3 Blob (без кэша).
 * Сохранение: PUT /api/admin/radio-flags (minimax_host_voice / minimax_guest_voice)
 *         — тот же механизм, что и флаги в RadioTab (ТЗ-45).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Headphones, Play, Square, AlertCircle, CheckCircle2 } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { broadcastRadioFlagsChange } from '@/lib/radio/radioFlagsSync'
import {
  groupVoicesByFamily,
  filterVoices,
  countAvailable,
} from '@/lib/admin/voicePickerUtils'

export interface MinimaxVoiceMeta {
  id: string
  labelRu: string
  labelEn: string
  gender: 'm' | 'f' | 'n'
  age: 'young' | 'middle' | 'mature'
  language: string[]
  tone: 'neutral' | 'energetic' | 'calm' | 'warm' | 'dramatic'
  voiceType?: 'system' | 'voice_cloning' | 'voice_generation'
  /** true/false = измерено probe'ом, undefined = не измерено (вне словаря). */
  inAccount?: boolean
}

interface VoicePickerProps {
  hostVoice: string
  guestVoice: string
  /** Перезагрузить флаги родителем после успешного сохранения. */
  onSaved?: () => void
}

const DEFAULT_TEST_TEXT =
  'Привет, я Михаил. Сегодня доллар 92.50, нефть 84, индекс Мосбиржи 3150 пунктов. ' +
  'ЦБ сохранил ключевую ставку на уровне 5.25 процента. Слушайте наши новости!'

const PREVIEW_MAX_CHARS = 1000

export function VoicePicker({ hostVoice, guestVoice, onSaved }: VoicePickerProps) {
  const [voices, setVoices] = useState<MinimaxVoiceMeta[]>([])
  const [source, setSource] = useState<'minimax' | 'static'>('static')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveRole, setSaveRole] = useState<'minimax_host_voice' | 'minimax_guest_voice'>(
    'minimax_host_voice',
  )
  const [filter, setFilter] = useState<'all' | 'available'>('all')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Загрузка списка голосов (кэш 24ч на бэке).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = (await adminApi.get('/api/admin/radio/voices')) as {
          voices: MinimaxVoiceMeta[]
          source: 'minimax' | 'static'
        }
        if (cancelled) return
        setVoices(res.voices)
        setSource(res.source)
        setError(null)
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Не удалось загрузить список голосов')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Cleanup blob URL при смене/размонтировании.
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  // Превью: генерация mp3 + проигрывание. Тоггл — повторный клик по играющему.
  const handlePlay = useCallback(
    async (voiceId: string) => {
      if (playingId === voiceId) {
        audioRef.current?.pause()
        setPlayingId(null)
        return
      }
      setPendingId(voiceId)
      setError(null)
      try {
        const blob = await adminApi.postBlob('/api/admin/radio/voices/preview', {
          voice_id: voiceId,
          text: testText,
        })
        const url = URL.createObjectURL(blob)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(url)
        setPlayingId(voiceId)
      } catch (err: any) {
        setError(err?.message ?? 'Ошибка генерации превью')
      } finally {
        setPendingId(null)
      }
    },
    [playingId, previewUrl, testText],
  )

  const handleAudioEnded = useCallback(() => setPlayingId(null), [])

  // Сохранение выбранного голоса в runtime-флаги радио.
  const handleSave = useCallback(async () => {
    if (!playingId) return
    const voiceToSave = playingId
    setSaving(true)
    try {
      await adminApi.put('/api/admin/radio-flags', { key: saveRole, value: voiceToSave })
      broadcastRadioFlagsChange() // TZ-73 S-5: уведомить юзерские табы
      setSavedAt(new Date().toLocaleTimeString('ru-RU'))
      setTimeout(() => setSavedAt(null), 6000)
      onSaved?.()
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }, [saveRole, playingId, onSaved])

  // Группировка по семейству (префикс из латинских букв: English, male, female…).
  const voicesByFamily = groupVoicesByFamily(voices)

  const availableCount = countAvailable(voices)
  const playingUnavailable = voices.find((v) => v.id === playingId)?.inAccount === false

  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-2"
        style={{ borderColor: '#222222' }}
      >
        <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Headphones size={14} />
          Голоса TTS · тестовое прослушивание
        </span>
        <span className="text-xs" style={{ color: '#6B7280' }}>
          {voices.length} голосов · Minimax · источник: {source === 'minimax' ? 'API' : 'static'}
        </span>
      </div>

      {/* Success / Error banners */}
      {savedAt && (
        <div
          className="mx-6 mt-4 rounded-lg border p-3 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            borderColor: 'rgba(52, 211, 153, 0.2)',
            color: '#34D399',
          }}
        >
          <CheckCircle2 size={16} />
          <span>
            Голос сохранён как{' '}
            <strong>
              {saveRole === 'minimax_host_voice' ? 'HOST (Михаил)' : 'GUEST (Татьяна)'}
            </strong>{' '}
            в {savedAt}. Юзеры подхватят через ~5 мин.
          </span>
        </div>
      )}
      {error && (
        <div
          className="mx-6 mt-4 rounded-lg border p-3 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            color: '#EF4444',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Тестовый текст */}
        <div>
          <div
            className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2"
            style={{ color: '#6B7280' }}
          >
            Тестовый текст
          </div>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value.slice(0, PREVIEW_MAX_CHARS))}
            maxLength={PREVIEW_MAX_CHARS}
            className="w-full rounded-lg p-3 text-sm"
            style={{
              backgroundColor: '#0A0A0A',
              border: '1px solid #222222',
              color: '#FFFFFF',
              minHeight: 80,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div className="text-xs mt-1" style={{ color: '#6B7280' }}>
            {testText.length}/{PREVIEW_MAX_CHARS} · числа: 92.50, 3150, 5.25 · имена: «Мосбиржи»,
            «ЦБ»
          </div>
        </div>

        {/* Фильтр «Все / Только доступные» */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#6B7280' }}>
            Системные голоса
          </div>
          <div
            className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ backgroundColor: '#0A0A0A', border: '1px solid #222222' }}
          >
            {(['all', 'available'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className="px-3 py-1 text-xs rounded-md transition-colors"
                style={{
                  backgroundColor: filter === mode ? '#00D4FF' : 'transparent',
                  color: filter === mode ? '#060606' : '#9CA3AF',
                  fontWeight: filter === mode ? 'bold' : 'normal',
                }}
              >
                {mode === 'all' ? `Все (${voices.length})` : `Доступные (${availableCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Загрузка / пусто */}
        {!voices.length && !error && (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {loading ? 'Загрузка списка голосов…' : 'Нет данных'}
            </p>
          </div>
        )}

        {/* Сетка голосов по семействам */}
        <div className="space-y-4">
          {Object.entries(voicesByFamily).map(([family, list]) => {
            const filtered = filterVoices(list, filter)
            if (!filtered.length) return null
            return (
              <div key={family}>
                <div
                  className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: '#6B7280' }}
                >
                  {family} · {filtered.length}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filtered.map((v) => {
                    const unavailable = v.inAccount === false
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 p-3 rounded-lg border transition-all"
                        style={{
                          backgroundColor: '#0A0A0A',
                          borderColor: playingId === v.id ? '#00D4FF' : '#222222',
                          borderLeftWidth: 3,
                          borderLeftColor:
                            hostVoice === v.id
                              ? '#F87171'
                              : guestVoice === v.id
                                ? '#22D3EE'
                                : unavailable
                                  ? 'rgba(239, 68, 68, 0.4)'
                                  : 'transparent',
                          boxShadow:
                            playingId === v.id
                              ? '0 0 0 1px #00D4FF, 0 4px 16px rgba(0,212,255,0.15)'
                              : 'none',
                          opacity: pendingId === v.id ? 0.6 : 1,
                        }}
                        title={
                          unavailable ? 'Голос не доступен на текущем плане Minimax' : v.id
                        }
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold"
                          style={{
                            backgroundColor: unavailable
                              ? 'rgba(239, 68, 68, 0.10)'
                              : 'rgba(0, 212, 255, 0.10)',
                            color: unavailable ? '#EF4444' : '#00D4FF',
                            flexShrink: 0,
                          }}
                        >
                          {v.gender === 'f' ? '♀' : v.gender === 'm' ? '♂' : '⚥'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: unavailable ? '#EF4444' : '#FFFFFF' }}
                          >
                            {v.labelRu}
                            {unavailable && (
                              <span className="ml-1 text-[9px] font-bold" style={{ color: '#EF4444' }}>
                                ✕
                              </span>
                            )}
                          </div>
                          <div
                            className="text-[10px] flex gap-1.5 mt-0.5 items-center flex-wrap"
                            style={{ color: '#71717a' }}
                          >
                            <span>{v.language[0]?.toUpperCase()}</span>
                            <span>·</span>
                            <span>{v.age}</span>
                            {unavailable && (
                              <span className="font-bold" style={{ color: '#EF4444' }}>
                                недоступен
                              </span>
                            )}
                            {hostVoice === v.id && (
                              <span className="text-red-400 font-bold">HOST</span>
                            )}
                            {guestVoice === v.id && (
                              <span className="text-cyan-400 font-bold">GUEST</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handlePlay(v.id)}
                          disabled={pendingId === v.id}
                          className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                          style={{
                            backgroundColor:
                              playingId === v.id ? '#00D4FF' : 'rgba(0, 212, 255, 0.10)',
                            border: `1px solid ${
                              playingId === v.id ? '#00D4FF' : 'rgba(0, 212, 255, 0.30)'
                            }`,
                            color: playingId === v.id ? '#060606' : '#00D4FF',
                            cursor: pendingId === v.id ? 'wait' : 'pointer',
                            flexShrink: 0,
                          }}
                          title={playingId === v.id ? 'Стоп' : 'Прослушать'}
                        >
                          {pendingId === v.id ? (
                            <span style={{ fontSize: 14 }}>⟳</span>
                          ) : playingId === v.id ? (
                            <Square size={14} />
                          ) : (
                            <Play size={14} style={{ marginLeft: 1 }} />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Audio element для playback */}
        {previewUrl && (
          <audio
            ref={(el) => {
              audioRef.current = el
              if (el) void el.play().catch(() => setPlayingId(null))
            }}
            src={previewUrl}
            onEnded={handleAudioEnded}
            onError={handleAudioEnded}
          />
        )}

        {/* Save bar */}
        <div
          className="flex items-center justify-between pt-4 border-t flex-wrap gap-3"
          style={{ borderColor: '#222222' }}
        >
          <div className="text-xs" style={{ color: '#6B7280' }}>
            Сохранить{' '}
            <strong style={{ color: '#FFFFFF' }}>
              {playingId ??
                voices.find((v) => v.id === hostVoice)?.labelRu ??
                hostVoice}
            </strong>{' '}
            как:
          </div>
          <div className="flex items-center gap-3">
            <select
              value={saveRole}
              onChange={(e) =>
                setSaveRole(e.target.value as 'minimax_host_voice' | 'minimax_guest_voice')
              }
              className="px-3 py-2 rounded-lg text-sm border bg-[#0A0A0A]"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            >
              <option value="minimax_host_voice">HOST (Михаил)</option>
              <option value="minimax_guest_voice">GUEST (Татьяна)</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving || !playingId || playingUnavailable}
              className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#00D4FF', color: '#060606' }}
              title={playingUnavailable ? 'Голос недоступен на плане Minimax' : undefined}
            >
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VoicePicker

/** TZ71: SFX-cue — склейка URL и фолбэк при пустой библиотеке. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем audioContext — в jsdom нет AudioContext
const playMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/audioContext', () => ({
  getSfxElement: () => ({ src: '', play: playMock }),
  resumeAudio: () => {},
}))

import { sfxAbsoluteUrl, playSfxCueFromLibrary } from '@/lib/radio/sfx'
import { API_BASE } from '@/lib/api'

describe('sfxAbsoluteUrl', () => {
  it('склеивает origin API с путём из ответа бэка', () => {
    const origin = API_BASE.replace(/\/api$/, '')
    expect(sfxAbsoluteUrl('/api/radio/sfx/file/news_cue.mp3')).toBe(
      `${origin}/api/radio/sfx/file/news_cue.mp3`,
    )
  })

  it('абсолютный http(s) URL пропускает как есть', () => {
    expect(sfxAbsoluteUrl('https://cdn.example.com/cue.mp3')).toBe('https://cdn.example.com/cue.mp3')
  })
})

describe('playSfxCueFromLibrary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    playMock.mockClear()
  })

  it('пустая библиотека ({url:null}) → false (фолбэк на beep)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ url: null }) } as Response)
    expect(await playSfxCueFromLibrary()).toBe(false)
    expect(playMock).not.toHaveBeenCalled()
  })

  it('ошибка сети → false (фолбэк на beep)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))
    expect(await playSfxCueFromLibrary()).toBe(false)
  })

  it('файл есть → true и play() вызван', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/api/radio/sfx/file/news_cue.mp3' }),
    } as Response)
    expect(await playSfxCueFromLibrary()).toBe(true)
    expect(playMock).toHaveBeenCalledTimes(1)
  })
})

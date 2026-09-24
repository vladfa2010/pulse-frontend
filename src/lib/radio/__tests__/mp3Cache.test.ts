/**
 * PULSE — Радио: тесты mp3Cache (ТЗ-59).
 *
 * Мокаем serverTTS через dynamic import — mp3Cache подгружает ttsApi лениво.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  serverTTS: vi.fn(),
}))

vi.mock('@/lib/radio/ttsApi', () => ({
  serverTTS: (...args: any[]) => mocks.serverTTS(...args),
  RadioTtsError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { loadMp3, clearMp3Cache, getMp3CacheSize } from '../mp3Cache'

describe('mp3Cache — единый кеш mp3 для префетча (C) и конвейера (B), ТЗ-59', () => {
  beforeEach(() => {
    clearMp3Cache()
    vi.clearAllMocks()
  })

  it('cache hit: повторный loadMp3 не дёргает serverTTS', async () => {
    mocks.serverTTS.mockResolvedValue(new Blob(['x']))
    const a = await loadMp3('hello', 'presenter_male', 1.05)
    const b = await loadMp3('hello', 'presenter_male', 1.05)
    expect(a).toBe(b)
    expect(mocks.serverTTS).toHaveBeenCalledTimes(1)
  })

  it('параллельные loadMp3 дедуплицируются в один запрос', async () => {
    let resolve!: (b: Blob) => void
    mocks.serverTTS.mockImplementation(() => new Promise((r) => { resolve = r }))
    const p1 = loadMp3('text', 'voice', 1.05)
    const p2 = loadMp3('text', 'voice', 1.05)
    // ttsFetch сначала делает dynamic import — ждём, пока serverTTS реально вызван
    await vi.waitFor(() => expect(mocks.serverTTS).toHaveBeenCalledTimes(1))
    resolve(new Blob(['x']))
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(r2)
    expect(mocks.serverTTS).toHaveBeenCalledTimes(1)
  })

  it('failed промис вытесняется из кеша — retry делает новый запрос', async () => {
    mocks.serverTTS.mockRejectedValueOnce(new Error('429'))
    mocks.serverTTS.mockResolvedValueOnce(new Blob(['x']))
    await expect(loadMp3('text', 'v', 1.05)).rejects.toThrow('429')
    expect(getMp3CacheSize()).toBe(0)
    const b = await loadMp3('text', 'v', 1.05)
    expect(b).toBeInstanceOf(Blob)
    expect(mocks.serverTTS).toHaveBeenCalledTimes(2)
  })

  it('разный speed/pitch — разные ключи', async () => {
    mocks.serverTTS.mockResolvedValue(new Blob(['x']))
    await loadMp3('text', 'v', 1.0, 0)
    await loadMp3('text', 'v', 1.5, 0)
    await loadMp3('text', 'v', 1.0, 2)
    expect(mocks.serverTTS).toHaveBeenCalledTimes(3)
  })

  it('LRU eviction: не больше MAX_ENTRIES=32', async () => {
    mocks.serverTTS.mockResolvedValue(new Blob(['x']))
    for (let i = 0; i < 40; i++) {
      await loadMp3(`text-${i}`, 'v', 1.05)
    }
    expect(getMp3CacheSize()).toBeLessThanOrEqual(32)
  })

  it('pitch передаётся в serverTTS (фолбэк тембром при одинаковых голосах)', async () => {
    mocks.serverTTS.mockResolvedValue(new Blob(['x']))
    await loadMp3('text', 'presenter_male', 1.05, 2)
    expect(mocks.serverTTS).toHaveBeenCalledWith('text', {
      voiceId: 'presenter_male',
      speed: 1.05,
      pitch: 2,
    })
  })
})

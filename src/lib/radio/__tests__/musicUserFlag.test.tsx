/**
 * PULSE — Радио: тесты musicUserFlag (TZ70).
 *
 * Юзерский флаг фоновой музыки: один localStorage-ключ для всех UI (иконка ♪
 * в GlobalPlayerBar, тоггл в SettingsPanel), реактивная синхронизация через
 * кастомное событие pulse_music_toggled (это окно) и storage (другие табы).
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  MUSIC_USER_FLAG_KEY,
  MUSIC_TOGGLED_EVENT,
  getMusicUserFlag,
  setMusicUserFlag,
  useMusicUserFlag,
} from '../musicUserFlag'

describe('musicUserFlag (TZ70)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('дефолт: ключа нет → включено (true)', () => {
    expect(getMusicUserFlag()).toBe(true)
  })

  it('set(false) → "0" в localStorage, get → false', () => {
    setMusicUserFlag(false)
    expect(localStorage.getItem(MUSIC_USER_FLAG_KEY)).toBe('0')
    expect(getMusicUserFlag()).toBe(false)
  })

  it('set(true) → "1", get → true', () => {
    setMusicUserFlag(false)
    setMusicUserFlag(true)
    expect(localStorage.getItem(MUSIC_USER_FLAG_KEY)).toBe('1')
    expect(getMusicUserFlag()).toBe(true)
  })

  it('set диспатчит pulse_music_toggled — слушатель вызывается', () => {
    const listener = vi.fn()
    window.addEventListener(MUSIC_TOGGLED_EVENT, listener)
    setMusicUserFlag(false)
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(MUSIC_TOGGLED_EVENT, listener)
  })

  it('useMusicUserFlag реагирует на set (это окно)', () => {
    const { result } = renderHook(() => useMusicUserFlag())
    expect(result.current).toBe(true)
    act(() => setMusicUserFlag(false))
    expect(result.current).toBe(false)
  })

  it('useMusicUserFlag реагирует на storage-событие (другая таба)', () => {
    const { result } = renderHook(() => useMusicUserFlag())
    expect(result.current).toBe(true)
    act(() => {
      localStorage.setItem(MUSIC_USER_FLAG_KEY, '0')
      window.dispatchEvent(new StorageEvent('storage', { key: MUSIC_USER_FLAG_KEY }))
    })
    expect(result.current).toBe(false)
  })
})

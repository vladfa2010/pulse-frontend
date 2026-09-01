import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveReturnUrl, popReturnUrl, peekReturnUrl, isInternalPath } from '../returnUrl'

describe('returnUrl', () => {
  let storage: Record<string, string> = {}
  const sessionStorageMock = {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
    removeItem: vi.fn((key: string) => { delete storage[key] }),
  }

  beforeEach(() => {
    storage = {}
    sessionStorageMock.getItem.mockClear()
    sessionStorageMock.setItem.mockClear()
    sessionStorageMock.removeItem.mockClear()
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
      configurable: true,
    })
  })

  describe('isInternalPath', () => {
    it('accepts internal paths', () => {
      expect(isInternalPath('/feed')).toBe(true)
      expect(isInternalPath('/feed?tag=Сбер')).toBe(true)
      expect(isInternalPath('/')).toBe(true)
    })

    it('rejects external URLs', () => {
      expect(isInternalPath('https://evil.com')).toBe(false)
      expect(isInternalPath('http://evil.com')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
      expect(isInternalPath('//evil.com')).toBe(false)
    })
  })

  describe('saveReturnUrl', () => {
    it('saves explicit internal url', () => {
      saveReturnUrl('/feed?tag=Сбер')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('pulse:returnUrl', '/feed?tag=Сбер')
      expect(storage['pulse:returnUrl']).toBe('/feed?tag=Сбер')
    })

    it('does not save external url', () => {
      saveReturnUrl('https://evil.com')
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('does not save protocol-relative url', () => {
      saveReturnUrl('//evil.com')
      expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('saves current location when no url passed', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { location: { pathname: '/feed', search: '?q=див' } },
        writable: true,
        configurable: true,
      })
      saveReturnUrl()
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('pulse:returnUrl', '/feed?q=див')
      expect(storage['pulse:returnUrl']).toBe('/feed?q=див')
    })
  })

  describe('popReturnUrl', () => {
    it('returns and removes saved url', () => {
      saveReturnUrl('/feed?tag=Сбер')
      expect(popReturnUrl()).toBe('/feed?tag=Сбер')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('pulse:returnUrl')
    })

    it('returns null when nothing saved', () => {
      expect(popReturnUrl()).toBeNull()
    })
  })

  describe('peekReturnUrl', () => {
    it('returns saved url without removing', () => {
      saveReturnUrl('/feed?tag=Сбер')
      expect(peekReturnUrl()).toBe('/feed?tag=Сбер')
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalled()
    })

    it('returns null when nothing saved', () => {
      expect(peekReturnUrl()).toBeNull()
    })
  })
})

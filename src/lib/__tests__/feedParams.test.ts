import { describe, it, expect } from 'vitest'
import { buildFeedParams, parseFeedParams } from '../feedParams'

describe('feedParams', () => {
  describe('buildFeedParams', () => {
    it('returns empty params when both are empty', () => {
      const params = buildFeedParams(null, null)
      expect(params.toString()).toBe('')
    })

    it('returns empty params for whitespace-only values', () => {
      const params = buildFeedParams('   ', '  ')
      expect(params.toString()).toBe('')
    })

    it('builds tag-only params', () => {
      const params = buildFeedParams('Сбербанк', null)
      expect(params.toString()).toBe('tag=%D0%A1%D0%B1%D0%B5%D1%80%D0%B1%D0%B0%D0%BD%D0%BA')
    })

    it('builds q-only params', () => {
      const params = buildFeedParams(null, 'дивиденды')
      expect(params.toString()).toBe('q=%D0%B4%D0%B8%D0%B2%D0%B8%D0%B4%D0%B5%D0%BD%D0%B4%D1%8B')
    })

    it('builds tag + q params with tag first', () => {
      const params = buildFeedParams('Сбербанк', 'дивиденды')
      expect(params.toString()).toBe(
        'tag=%D0%A1%D0%B1%D0%B5%D1%80%D0%B1%D0%B0%D0%BD%D0%BA&q=%D0%B4%D0%B8%D0%B2%D0%B8%D0%B4%D0%B5%D0%BD%D0%B4%D1%8B'
      )
    })

    it('trims whitespace', () => {
      const params = buildFeedParams('  Сбербанк  ', '  дивиденды  ')
      expect(params.get('tag')).toBe('Сбербанк')
      expect(params.get('q')).toBe('дивиденды')
    })
  })

  describe('parseFeedParams', () => {
    it('parses empty params', () => {
      expect(parseFeedParams(new URLSearchParams())).toEqual({ tag: null, q: null })
    })

    it('parses tag and q', () => {
      const sp = new URLSearchParams('tag=Сбербанк&q=дивиденды')
      expect(parseFeedParams(sp)).toEqual({ tag: 'Сбербанк', q: 'дивиденды' })
    })

    it('normalizes empty strings to null', () => {
      const sp = new URLSearchParams('tag=&q=')
      expect(parseFeedParams(sp)).toEqual({ tag: null, q: null })
    })

    it('trims whitespace', () => {
      const sp = new URLSearchParams('tag=  Сбербанк  &q=  дивиденды  ')
      expect(parseFeedParams(sp)).toEqual({ tag: 'Сбербанк', q: 'дивиденды' })
    })
  })
})

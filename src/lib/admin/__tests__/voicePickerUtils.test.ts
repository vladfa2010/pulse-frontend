import { describe, it, expect } from 'vitest'
import {
  voiceFamily,
  groupVoicesByFamily,
  filterVoices,
  countAvailable,
} from '../voicePickerUtils'

const VOICES = [
  { id: 'presenter_male', inAccount: true },
  { id: 'presenter_female', inAccount: true },
  { id: 'audiobook_male_2', inAccount: false },
  { id: 'English_Graceful_Lady', inAccount: undefined },
  { id: 'Spanish_Lively_Man', inAccount: undefined },
]

describe('voicePickerUtils (ТЗ68)', () => {
  it('voiceFamily: префикс из латинских букв', () => {
    expect(voiceFamily('presenter_male')).toBe('presenter')
    expect(voiceFamily('male-qn-qingse')).toBe('male')
    expect(voiceFamily('English_Graceful_Lady')).toBe('English')
    expect(voiceFamily('female-shaonv')).toBe('female')
    expect(voiceFamily('123abc')).toBe('other')
  })

  it('groupVoicesByFamily: группирует и сохраняет порядок', () => {
    const groups = groupVoicesByFamily(VOICES)
    expect(Object.keys(groups)).toEqual(['presenter', 'audiobook', 'English', 'Spanish'])
    expect(groups.presenter.map((v) => v.id)).toEqual(['presenter_male', 'presenter_female'])
    expect(groups.English).toHaveLength(1)
  })

  it('filterVoices "all" возвращает всё', () => {
    expect(filterVoices(VOICES, 'all')).toHaveLength(5)
  })

  it('filterVoices "available" отсекает только inAccount === false', () => {
    const filtered = filterVoices(VOICES, 'available')
    expect(filtered.map((v) => v.id)).not.toContain('audiobook_male_2')
    // undefined (не измерено) — показываем
    expect(filtered.map((v) => v.id)).toContain('English_Graceful_Lady')
    expect(filtered).toHaveLength(4)
  })

  it('countAvailable считает inAccount !== false', () => {
    expect(countAvailable(VOICES)).toBe(4)
    expect(countAvailable([])).toBe(0)
  })
})

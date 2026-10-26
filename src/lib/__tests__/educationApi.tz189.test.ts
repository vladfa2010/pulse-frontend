// ТЗ-189: «Глазами ученика» — preview_token пробрасывается в API-слое.
// С токеном → ?preview_token=..., без → чистый URL.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPublicCourse } from '@/lib/educationApi'

const getMock = vi.fn().mockResolvedValue({})

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: (...args: unknown[]) => getMock(...args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  getMock.mockResolvedValue({})
})

describe('fetchPublicCourse (ТЗ-189)', () => {
  it('без токена — запрос без query-параметров', async () => {
    await fetchPublicCourse('my-course')
    expect(getMock).toHaveBeenCalledWith('/education/courses/my-course')
  })

  it('с токеном — добавляется ?preview_token= (encodeURIComponent)', async () => {
    await fetchPublicCourse('my-course', 'jwt.token+with/specials=')
    expect(getMock).toHaveBeenCalledWith(
      `/education/courses/my-course?preview_token=${encodeURIComponent('jwt.token+with/specials=')}`,
    )
  })

  it('null-токен — как без токена', async () => {
    await fetchPublicCourse('my-course', null)
    expect(getMock).toHaveBeenCalledWith('/education/courses/my-course')
  })

  it('slug экранируется в любом режиме', async () => {
    await fetchPublicCourse('курс с пробелом', 'tok')
    expect(getMock).toHaveBeenCalledWith(
      `/education/courses/${encodeURIComponent('курс с пробелом')}?preview_token=tok`,
    )
  })
})

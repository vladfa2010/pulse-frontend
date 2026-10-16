// @vitest-environment jsdom
/**
 * ТЗ-178 — регрессия гонки одновременных аудиопотоков в useLessonAudio.
 *
 * fetchTtsSegment замокан управляемыми deferred: тест держит сеть «в воздухе»,
 * дёргает seek/pause/смену скорости и только потом резолвит blob'ы.
 * Инстансы Audio считаются через мок-класс — после фикса эпох play() может
 * быть вызван ровно один раз на одну живую цепочку.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLessonAudio } from '@/lib/useLessonAudio'
import { fetchTtsSegment } from '@/lib/educationApi'

vi.mock('@/lib/educationApi', () => ({ fetchTtsSegment: vi.fn() }))

const SEGMENTS = ['Первый сегмент конспекта урока', 'Второй сегмент подлиннее', 'Третий финальный']

/** Управляемые deferred-ответы «сети». */
let pending: Array<(b: Blob) => void> = []
function holdNetwork() {
  pending = []
  vi.mocked(fetchTtsSegment).mockImplementation(
    () => new Promise<Blob>(resolve => { pending.push(resolve) }),
  )
}
async function flushNetwork() {
  await act(async () => {
    const p = pending
    pending = []
    p.forEach(resolve => resolve(new Blob(['audio'])))
    await new Promise(r => setTimeout(r, 0))
  })
}

/** Мок Audio: считает инстансы и вызовы play(). */
const playedInstances: MockAudio[] = []
class MockAudio {
  static instances: MockAudio[] = []
  currentTime = 0
  duration = 1
  onended: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  play = vi.fn(() => { playedInstances.push(this); return Promise.resolve() })
  pause = vi.fn()
  constructor(_url: string) {
    MockAudio.instances.push(this)
  }
}

function setup() {
  holdNetwork()
  MockAudio.instances = []
  playedInstances.length = 0
  vi.stubGlobal('Audio', MockAudio)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
  const props = {
    lessonId: 'lesson-1',
    segments: SEGMENTS,
    active: true,
    onListened: vi.fn(),
    onError: vi.fn(),
  }
  const hook = renderHook(props => useLessonAudio(props), { initialProps: props })
  return { hook, props }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('ТЗ-178: гонка потоков озвучки', () => {
  it('start → seek до резолва сегмента → играет ровно одна цепочка', async () => {
    const { hook } = setup()
    act(() => hook.result.current.toggle()) // start (playing=false → start)
    expect(vi.mocked(fetchTtsSegment).mock.calls.length).toBeGreaterThan(0)

    act(() => hook.result.current.seekByFraction(0.5)) // гонка: сеть ещё в воздухе
    await flushNetwork()

    expect(playedInstances.length).toBe(1) // старая позиция не стартовала
    expect(MockAudio.instances.length).toBe(1)
    expect(hook.result.current.playing).toBe(true)
  })

  it('пауза до резолва сегмента → звук НЕ стартует сам, playing=false', async () => {
    const { hook } = setup()
    act(() => hook.result.current.toggle()) // start
    act(() => hook.result.current.toggle()) // пауза, пока сеть в воздухе
    expect(hook.result.current.playing).toBe(false)

    await flushNetwork()

    expect(playedInstances.length).toBe(0)
    expect(hook.result.current.playing).toBe(false)
  })

  it('двойной seek подряд до резолва → один играющий поток', async () => {
    const { hook } = setup()
    act(() => hook.result.current.toggle()) // start
    act(() => hook.result.current.seekByFraction(0.3))
    act(() => hook.result.current.seekByFraction(0.9))
    await flushNetwork()

    expect(playedInstances.length).toBe(1)
    expect(MockAudio.instances.length).toBe(1)
  })

  it('смена скорости на лету до резолва → один играющий поток', async () => {
    const { hook } = setup()
    act(() => hook.result.current.toggle()) // start
    act(() => hook.result.current.cycleSpeed()) // гонка: стоп + новый playFrom
    await flushNetwork()

    expect(playedInstances.length).toBe(1)
    expect(hook.result.current.speed).toBe(1.25)
    expect(hook.result.current.playing).toBe(true)
  })

  it('stop убивает цепочку, висящую в loadBlob', async () => {
    const { hook } = setup()
    act(() => hook.result.current.toggle()) // start
    act(() => hook.result.current.stop()) // уход из режима
    await flushNetwork()

    expect(playedInstances.length).toBe(0)
    expect(MockAudio.instances.length).toBe(0)
    expect(hook.result.current.playing).toBe(false)
  })
})

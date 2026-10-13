// ТЗ-164: videoHostName называет Rutube правильно (карточка «Сервис видео
// временно недоступен», ТЗ-129). Регрессия: соседние хосты не сломаны.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { videoHostName } from '@/pages/LessonPage'

describe('videoHostName (ТЗ-164)', () => {
  it('rutube → Rutube', () => {
    expect(videoHostName('https://rutube.ru/play/embed/cae960e8244d38e0381311b644223c15')).toBe('Rutube')
  })

  it('регрессия: соседние хосты как раньше', () => {
    expect(videoHostName('https://www.youtube.com/embed/abc')).toBe('YouTube')
    expect(videoHostName('https://vkvideo.ru/video_ext.php?oid=1&id=2')).toBe('VK Видео')
    expect(videoHostName('https://player.vimeo.com/video/123')).toBe('player.vimeo.com') // host как есть — существующее поведение
    expect(videoHostName(null)).toBe('Видео')
    expect(videoHostName('not a url')).toBe('Видео')
  })
})

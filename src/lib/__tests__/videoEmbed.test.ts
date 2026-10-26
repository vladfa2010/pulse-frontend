// ТЗ-188: перенос toEmbedUrl/videoHostName в общий модуль — поведение 1:1
// (единый источник правды для плеера ученика и превью в форме урока).
import { describe, it, expect } from 'vitest'
import { toEmbedUrl, videoHostName } from '@/lib/videoEmbed'

describe('toEmbedUrl (ТЗ-188)', () => {
  it('YouTube watch → embed', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123')
    expect(toEmbedUrl('https://youtube.com/watch?v=abc123&t=42s')).toBe('https://www.youtube.com/embed/abc123')
    expect(toEmbedUrl('https://m.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123')
  })

  it('youtu.be → embed', () => {
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123')
  })

  it('shorts — как есть (прецедент: функция не конвертирует, поведение ученика то же)', () => {
    expect(toEmbedUrl('https://www.youtube.com/shorts/abc123')).toBe('https://www.youtube.com/shorts/abc123')
  })

  it('прочие URL — без изменений', () => {
    expect(toEmbedUrl('https://www.youtube-nocookie.com/embed/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123')
    expect(toEmbedUrl('https://rutube.ru/play/embed/123')).toBe('https://rutube.ru/play/embed/123')
    expect(toEmbedUrl('https://player.vimeo.com/video/123')).toBe('https://player.vimeo.com/video/123')
  })

  it('не-URL мусор — отдаётся как есть, не падает', () => {
    expect(toEmbedUrl('not a url')).toBe('not a url')
    expect(toEmbedUrl('')).toBe('')
  })
})

describe('videoHostName (ТЗ-129/164, перенос ТЗ-188)', () => {
  it('известные площадки', () => {
    expect(videoHostName('https://www.youtube.com/embed/x')).toBe('YouTube')
    expect(videoHostName('https://youtu.be/x')).toBe('YouTube')
    expect(videoHostName('https://www.youtube-nocookie.com/embed/x')).toBe('YouTube')
    expect(videoHostName('https://m.youtube.com/watch?v=x')).toBe('YouTube')
    expect(videoHostName('https://vkvideo.ru/video_ext.php?oid=1&id=2')).toBe('VK Видео')
    expect(videoHostName('https://vk.com/video-1_2')).toBe('VK Видео')
    expect(videoHostName('https://vimeo.com/123')).toBe('Vimeo')
    expect(videoHostName('https://rutube.ru/play/embed/cae960e8244d38e0381311b644223c15')).toBe('Rutube')
  })

  it('unknown host — как есть', () => {
    expect(videoHostName('https://player.vimeo.com/video/123')).toBe('player.vimeo.com')
  })

  it('битая строка / null — фолбэк «Видео»', () => {
    expect(videoHostName('not a url')).toBe('Видео')
    expect(videoHostName(null)).toBe('Видео')
  })
})

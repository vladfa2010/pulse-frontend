import { useEffect, useRef, useState } from 'react'
import { Clock, ExternalLink, FileText, Link2, Newspaper, Upload, X } from 'lucide-react'
import GlassModal from '@/components/GlassModal'
import {
  searchNewsPublic,
  submitCourseFile,
  submitCourseMaterial,
} from '@/lib/educationApi'
import type { PublicNewsItem } from '@/lib/educationApi'

// Модал «Предложить материал» (ТЗ-102, фронт CoursePage): три типа — ссылка,
// файл, новость PULSE. Предлагать могут только записанные на курс (кнопку
// рендерит CoursePage по my_enrollment). После отправки — состояние
// «На модерации» и кнопка закрытия. Rate limit бэка — 5 предложений/сутки (429).

type SuggestTab = 'link' | 'file' | 'news'

const ACCEPT_EXT = '.pdf,.xlsx,.docx,.png,.jpg,.jpeg,.webp'
const MAX_SIZE_MB = 10

export default function SuggestMaterialModal({
  open,
  courseSlug,
  onClose,
}: {
  open: boolean
  courseSlug: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<SuggestTab>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pickedNews, setPickedNews] = useState<PublicNewsItem | null>(null)
  const [newsQ, setNewsQ] = useState('')
  const [newsOptions, setNewsOptions] = useState<PublicNewsItem[]>([])
  const [newsDropOpen, setNewsDropOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newsRef = useRef<HTMLDivElement>(null)

  // Сброс состояния при открытии.
  useEffect(() => {
    if (open) {
      setTab('link')
      setTitle('')
      setUrl('')
      setFile(null)
      setPickedNews(null)
      setNewsQ('')
      setNewsOptions([])
      setSent(false)
      setFormError(null)
      setSubmitting(false)
    }
  }, [open])

  // Поиск новости — debounce 300 мс по публичному /api/news/search (ТЗ-102:
  // переиспользуем публичный поиск, НЕ admin /news-search).
  useEffect(() => {
    const q = newsQ.trim()
    if (!q) {
      setNewsOptions([])
      setNewsDropOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        setNewsOptions(await searchNewsPublic(q))
        setNewsDropOpen(true)
      } catch {
        setNewsOptions([])
        setNewsDropOpen(true)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [newsQ])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (newsRef.current && !newsRef.current.contains(e.target as Node)) setNewsDropOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pickFile = (f: File | null) => {
    setFormError(null)
    if (!f) {
      setFile(null)
      return
    }
    const extOk = /\.(pdf|xlsx|docx|png|jpe?g|webp)$/i.test(f.name)
    if (!extOk) {
      setFile(null)
      setFormError('Формат не поддерживается. Можно: PDF, XLSX, DOCX, PNG, JPG, WebP.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFile(null)
      setFormError(`Файл больше ${MAX_SIZE_MB} МБ. Сожмите или уберите часть содержимого.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(f)
  }

  const canSubmit =
    !submitting &&
    ((tab === 'link' && title.trim() && /^https?:\/\//i.test(url.trim())) ||
      (tab === 'file' && title.trim() && file) ||
      (tab === 'news' && !!pickedNews))

  const handleSubmit = async () => {
    setFormError(null)
    setSubmitting(true)
    try {
      if (tab === 'link') {
        await submitCourseMaterial(courseSlug, { kind: 'link', title: title.trim(), url: url.trim() })
      } else if (tab === 'file') {
        await submitCourseFile(courseSlug, title.trim(), file!)
      } else {
        await submitCourseMaterial(courseSlug, {
          kind: 'news',
          news_id: pickedNews!.id,
          title: pickedNews!.title_ru,
        })
      }
      setSent(true)
    } catch (err: any) {
      // 429 — текст бэка (rate limit 5/сутки), 409 — дубликат новости, иначе общий.
      setFormError(err?.message || 'Не удалось отправить. Попробуйте позже.')
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { id: SuggestTab; label: string; icon: typeof Link2 }[] = [
    { id: 'link', label: 'Ссылка', icon: Link2 },
    { id: 'file', label: 'Файл', icon: FileText },
    { id: 'news', label: 'Новость PULSE', icon: Newspaper },
  ]

  return (
    <GlassModal open={open} onClose={onClose} title="Предложить материал" showClose={!sent}>
      {sent ? (
        <div className="text-center py-4">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)' }}
          >
            <Clock size={24} style={{ color: '#FBBF24' }} />
          </div>
          <p className="text-white font-semibold mb-2">На модерации</p>
          <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
            Спасибо! Материал появится на странице курса после проверки редакцией.
            Статус можно посмотреть в профиле — раздел «Мои предложения».
          </p>
          <button
            onClick={onClose}
            className="h-11 px-8 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
          >
            Закрыть
          </button>
        </div>
      ) : (
        <>
          {/* Тип предложения */}
          <div className="flex gap-2 mb-5">
            {tabs.map(t => {
              const Icon = t.icon
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id)
                    setFormError(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    background: on ? 'rgba(0,212,255,.08)' : 'rgba(255,255,255,.02)',
                    color: on ? '#00D4FF' : '#6B7280',
                    border: on ? '1px solid rgba(0,212,255,.3)' : '1px solid rgba(255,255,255,.06)',
                  }}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">
              Название{tab === 'news' ? ' (необязательно — подставим заголовок новости)' : ''}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={tab === 'link' ? 'Например: Шпаргалка по мультипликаторам' : 'Название материала'}
              disabled={tab === 'news'}
              className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors disabled:opacity-50"
            />
          </div>

          {tab === 'link' && (
            <div className="mb-4">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">
                Ссылка
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors"
              />
              <div className="text-[11px] mt-1.5 leading-relaxed text-[#6B7280]">
                Только http(s):// — внешние ресурсы и статьи PULSE.
              </div>
            </div>
          )}

          {tab === 'file' && (
            <div className="mb-4">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">
                Файл
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_EXT}
                onChange={e => pickFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-[#9CA3AF] file:mr-3 file:h-9 file:px-4 file:rounded-lg file:border-0 file:text-[12px] file:font-semibold file:bg-[#161616] file:text-white file:border file:border-[#222] hover:file:border-[rgba(0,212,255,0.5)] file:cursor-pointer"
              />
              <div className="text-[11px] mt-1.5 leading-relaxed text-[#6B7280]">
                Форматы: PDF, XLSX, DOCX, PNG, JPG, WebP · до {MAX_SIZE_MB} МБ. Файл проверяется антивирусом.
              </div>
              {file && (
                <div
                  className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-white"
                  style={{ background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.25)' }}
                >
                  <FileText size={14} style={{ color: '#00D4FF' }} />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-[#6B7280]">{(file.size / 1024 / 1024).toFixed(1)} МБ</span>
                  <button type="button" onClick={() => pickFile(null)} className="text-[#6B7280] hover:text-white" aria-label="Убрать файл">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'news' && (
            <div className="mb-4" ref={newsRef}>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] mb-1.5">
                Новость PULSE
              </label>
              <input
                type="text"
                value={newsQ}
                onChange={e => {
                  setNewsQ(e.target.value)
                  setPickedNews(null)
                }}
                onFocus={() => { if (newsOptions.length && newsQ.trim()) setNewsDropOpen(true) }}
                placeholder="Поиск по новостям PULSE…"
                autoComplete="off"
                className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors"
              />
              {newsDropOpen && !pickedNews && (
                <div
                  className="mt-1.5 rounded-[10px] overflow-hidden max-h-56 overflow-y-auto"
                  style={{ background: '#101010', border: '1px solid #222' }}
                >
                  {newsOptions.length === 0 ? (
                    <div className="px-3 py-2.5 text-[12px] text-[#6B7280]">Ничего не найдено</div>
                  ) : (
                    newsOptions.map(n => (
                      <div
                        key={n.id}
                        onMouseDown={e => {
                          e.preventDefault()
                          setPickedNews(n)
                          setTitle(n.title_ru)
                          setNewsDropOpen(false)
                        }}
                        className="px-3 py-2.5 text-[12px] text-white cursor-pointer hover:bg-[#161616] flex items-baseline gap-2"
                      >
                        <span className="text-[10px] text-[#6B7280] flex-none">
                          {n.published_at ? new Date(n.published_at).toLocaleDateString('ru-RU') : ''}
                        </span>
                        <span className="min-w-0 line-clamp-2">{n.title_ru}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {pickedNews && (
                <div
                  className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px]"
                  style={{ background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.3)' }}
                >
                  <Newspaper size={14} className="mt-0.5 flex-none" style={{ color: '#00D4FF' }} />
                  <span className="flex-1 min-w-0 text-white">{pickedNews.title_ru}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedNews(null)
                      setTitle('')
                    }}
                    className="text-[#6B7280] hover:text-white flex-none"
                    aria-label="Сбросить выбор"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {formError && (
            <div
              className="mb-4 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed"
              style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.3)', color: '#F87171' }}
            >
              {formError}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 h-11 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              {tab === 'link' ? <ExternalLink size={14} /> : tab === 'file' ? <Upload size={14} /> : <Newspaper size={14} />}
              {submitting ? 'Отправляем…' : 'Отправить на проверку'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl text-[13px] font-semibold text-[#9CA3AF] border border-[#222] hover:border-[#3a3a3a] hover:text-white transition-colors"
              style={{ background: 'transparent' }}
            >
              Отмена
            </button>
          </div>
          <div className="text-[11px] mt-3 leading-relaxed text-[#6B7280]">
            Предложение появится на странице курса после одобрения редакцией. Не более 5 предложений в сутки.
          </div>
        </>
      )}
    </GlassModal>
  )
}

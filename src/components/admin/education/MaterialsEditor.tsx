import { useRef, useState } from 'react'
import NewsLinkPicker from './NewsLinkPicker'
import {
  createMaterial,
  deleteMaterial,
  patchMaterial,
  uploadMaterial,
} from './api'
import { Btn, C, IconBtn } from './ui'
import type { CourseCard, Material, PickedSource } from './types'

// Вкладка «Материалы» (ТЗ-101 v5): три типа — файл (upload с прогрессом),
// ссылка (URL + название), новость (поиск). Тумблер «Открыт» (is_free) —
// мгновенный PATCH без формы.

const KIND_LABEL: Record<Material['kind'], string> = {
  file: 'ФАЙЛ',
  link: 'ССЫЛКА',
  news: 'НОВОСТЬ PULSE',
}

export default function MaterialsEditor({
  course,
  onUpdated,
  toast,
}: {
  course: CourseCard
  onUpdated: (card: CourseCard) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [materials, setMaterials] = useState<Material[]>(course.materials)
  const [addMode, setAddMode] = useState<'none' | 'file' | 'link' | 'news'>('none')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [newsPicked, setNewsPicked] = useState<PickedSource | null>(null)
  const [newsTitle, setNewsTitle] = useState('')
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [uploadWaiting, setUploadWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleFree = async (m: Material) => {
    try {
      const updated = await patchMaterial(m.id, { is_free: !m.is_free })
      setMaterials(prev => {
        const next = prev.map(x => (x.id === m.id ? updated : x))
        onUpdated({ ...course, materials: next } as CourseCard)
        return next
      })
      toast(updated.is_free ? 'Материал открыт для гостей' : 'Материал только для записанных', 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось изменить доступность', 'error')
    }
  }

  const remove = async (m: Material) => {
    if (!window.confirm(`Удалить материал «${m.title}»?`)) return
    try {
      await deleteMaterial(course.id, m.id)
      setMaterials(prev => {
        const next = prev.filter(x => x.id !== m.id)
        onUpdated({ ...course, materials: next } as CourseCard)
        return next
      })
      toast('Материал удалён', 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось удалить материал', 'error')
    }
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    setUploadPercent(0)
    setUploadWaiting(false)
    try {
      const created = await uploadMaterial(course.id, file, (percent, waiting) => {
        setUploadPercent(percent)
        setUploadWaiting(waiting)
      })
      setMaterials(prev => {
        const next = [...prev, created]
        onUpdated({ ...course, materials: next } as CourseCard)
        return next
      })
      toast(`Файл «${created.title}» загружен`, 'success')
      setAddMode('none')
    } catch (err: any) {
      // 415 не whitelist / 413 > 20 МБ — текстом бэкенда.
      toast(err?.message || 'Не удалось загрузить файл', 'error')
    } finally {
      setBusy(false)
      setUploadPercent(null)
      setUploadWaiting(false)
    }
  }

  const addLink = async () => {
    if (!/^https?:\/\//i.test(linkUrl.trim())) {
      toast('URL материала-ссылки — http(s) ссылка', 'error')
      return
    }
    if (!linkTitle.trim()) {
      toast('Укажите название материала', 'error')
      return
    }
    setBusy(true)
    try {
      const created = await createMaterial(course.id, {
        kind: 'link',
        title: linkTitle.trim(),
        url: linkUrl.trim(),
      })
      setMaterials(prev => {
        const next = [...prev, created]
        onUpdated({ ...course, materials: next } as CourseCard)
        return next
      })
      toast('Ссылка добавлена в материалы', 'success')
      setAddMode('none')
      setLinkUrl('')
      setLinkTitle('')
    } catch (err: any) {
      toast(err?.message || 'Не удалось добавить ссылку', 'error')
    } finally {
      setBusy(false)
    }
  }

  const addNews = async () => {
    if (!newsPicked) {
      toast('Найдите и выберите новость', 'error')
      return
    }
    setBusy(true)
    try {
      const created = await createMaterial(course.id, {
        kind: 'news',
        title: newsTitle.trim() || newsPicked.title || 'Новость PULSE',
        news_id: newsPicked.id,
      })
      setMaterials(prev => {
        const next = [...prev, created]
        onUpdated({ ...course, materials: next } as CourseCard)
        return next
      })
      toast('Новость прикреплена как материал', 'success')
      setAddMode('none')
      setNewsPicked(null)
      setNewsTitle('')
    } catch (err: any) {
      toast(err?.message || 'Не удалось прикрепить новость', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
        Открытые материалы видны гостям на странице курса (даже без записи и оплаты).
      </div>

      {materials.length === 0 && addMode === 'none' && (
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          Материалов пока нет.
        </div>
      )}

      {/* Список материалов (мокап .news-item). */}
      {materials.map(m => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: '.5rem',
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{m.title}</span>
          <span style={{ fontSize: 11, color: C.textMuted, flex: 'none', whiteSpace: 'nowrap' }}>
            {KIND_LABEL[m.kind]}
            {m.kind === 'file' && m.url ? ` · ${extOf(m.url).toUpperCase()}` : ''}
          </span>
          {/* Тумблер «Открыт» — мгновенный PATCH (мокап .mat-free). */}
          <button
            type="button"
            onClick={() => toggleFree(m)}
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              background: 'transparent',
              transition: 'all .2s',
              flex: 'none',
              color: m.is_free ? C.success : C.textMuted,
              border: `1px solid ${m.is_free ? 'rgba(52,211,153,.4)' : C.border}`,
            }}
          >
            {m.is_free ? 'Открыт' : 'Закрыт'}
          </button>
          <IconBtn title="Удалить материал" danger onClick={() => remove(m)}>
            ✕
          </IconBtn>
        </div>
      ))}

      {/* Добавление: файл / ссылка / новость (мокап — три кнопки в ряд). */}
      {addMode === 'none' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Btn
            sm
            onClick={() => {
              setAddMode('file')
              setTimeout(() => fileRef.current?.click(), 0)
            }}
          >
            + Файл
          </Btn>
          <Btn sm onClick={() => setAddMode('link')}>
            + Ссылка
          </Btn>
          <Btn sm onClick={() => setAddMode('news')}>
            + Новость
          </Btn>
        </div>
      )}

      {addMode === 'file' && (
        <div style={{ marginTop: 12 }}>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          {uploadPercent !== null && (
            <div style={{ maxWidth: 420 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: '#1c1c1c',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${uploadPercent}%`,
                    background: C.accent,
                    transition: 'width .2s',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                {uploadWaiting ? 'Обрабатывается на сервере…' : `Загрузка: ${uploadPercent}%`}
              </div>
            </div>
          )}
          {!busy && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn sm onClick={() => fileRef.current?.click()}>
                Выбрать файл…
              </Btn>
              <Btn sm onClick={() => setAddMode('none')}>
                Отмена
              </Btn>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
            pdf, office, изображения, zip, txt/md/csv · до 20 МБ. Тип определяется сервером по
            содержимому (magic bytes).
          </div>
        </div>
      )}

      {addMode === 'link' && (
        <div
          style={{
            marginTop: 12,
            background: '#0a0a0a',
            border: `1px dashed ${C.border}`,
            borderRadius: '.5rem',
            padding: 16,
            maxWidth: 560,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none"
              style={{ background: C.bgHover, border: `1px solid ${C.border}` }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              placeholder="Название материала"
              className="w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none"
              style={{ background: C.bgHover, border: `1px solid ${C.border}` }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn sm variant="accent" disabled={busy} onClick={addLink}>
              Добавить ссылку
            </Btn>
            <Btn sm disabled={busy} onClick={() => setAddMode('none')}>
              Отмена
            </Btn>
          </div>
        </div>
      )}

      {addMode === 'news' && (
        <div
          style={{
            marginTop: 12,
            background: '#0a0a0a',
            border: `1px dashed ${C.border}`,
            borderRadius: '.5rem',
            padding: 16,
            maxWidth: 560,
          }}
        >
          <NewsLinkPicker
            picked={newsPicked}
            onPick={setNewsPicked}
            autoFillTitle
            onAutoTitle={setNewsTitle}
            placeholder="Начните вводить заголовок новости…"
          />
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              value={newsTitle}
              onChange={e => setNewsTitle(e.target.value)}
              placeholder="Название материала (по умолчанию — заголовок новости)"
              className="w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none"
              style={{ background: C.bgHover, border: `1px solid ${C.border}` }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn sm variant="accent" disabled={busy || !newsPicked} onClick={addNews}>
              Прикрепить новость
            </Btn>
            <Btn sm disabled={busy} onClick={() => setAddMode('none')}>
              Отмена
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function extOf(url: string): string {
  const m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)
  return m ? m[1] : ''
}

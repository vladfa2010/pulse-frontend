import { useCallback, useEffect, useState } from 'react'
import GlassModal from '@/components/GlassModal'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  reorderCategories,
  updateCategory,
} from './api'
import { Btn, C, IconBtn } from './ui'
import type { Category } from './types'

// Модал «Категории курсов» (ТЗ-101 v9): справочник разделов витрины.
// Порядок здесь = порядок пилюль на витрине.

export default function CategoriesModal({
  open,
  onClose,
  onChanged,
  toast,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newId, setNewId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCats(await fetchCategories())
    } catch (err: any) {
      toast(err?.message || 'Не удалось загрузить категории', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const catPlural = (n: number) => {
    const m = n % 10
    const h = n % 100
    return m === 1 && h !== 11 ? 'курс' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'курса' : 'курсов'
  }

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await updateCategory(id, { name: trimmed })
      setCats(prev => prev.map(c => (c.id === id ? { ...c, name: trimmed } : c)))
      onChanged()
      toast(`Категория переименована: «${trimmed}» (id не меняется — на него ссылаются курсы)`, 'success')
    } catch (err: any) {
      toast(err?.message || 'Не удалось переименовать', 'error')
      load()
    }
  }

  const handleMove = async (id: string, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.position - b.position)
    const i = sorted.findIndex(c => c.id === id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const ids = sorted.map(c => c.id)
    // Оптимистично, затем сервер (порядок = пилюли витрины).
    setCats(sorted.map((c, idx) => ({ ...c, position: idx + 1 })))
    try {
      await reorderCategories(ids)
      onChanged()
    } catch (err: any) {
      toast(err?.message || 'Не удалось изменить порядок', 'error')
      load()
    }
  }

  const handleDelete = async (c: Category) => {
    try {
      await deleteCategory(c.id)
      setCats(prev => prev.filter(x => x.id !== c.id))
      onChanged()
      toast('Категория удалена — кэш витрины инвалидирован', 'success')
    } catch (err: any) {
      // 409: «в категории N курса(ов) — сначала переведите их».
      toast(err?.message || 'Не удалось удалить категорию', 'error')
    }
  }

  // Автоподстановка id (slug) транслитом из имени — как в мокапе.
  const translit = (s: string) => {
    const T: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
      й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
      у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
      э: 'e', ю: 'yu', я: 'ya',
    }
    return s
      .toLowerCase()
      .split('')
      .map(ch => T[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '-'))
      .join('')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleAdd = async () => {
    const name = newName.trim()
    const id = newId.trim()
    if (!name) {
      toast('Введите название раздела', 'error')
      return
    }
    if (!/^[a-z0-9-]{2,50}$/.test(id)) {
      toast('400: id — только латиница, цифры и дефис (2–50 символов)', 'error')
      return
    }
    try {
      const created = await createCategory({ id, name })
      setCats(prev => [...prev, created])
      setNewName('')
      setNewId('')
      onChanged()
      toast(`Категория «${name}» создана — появится на витрине, когда в ней будет видимый курс`, 'success')
    } catch (err: any) {
      // 400 валидация / 409 дубль id.
      toast(err?.message || 'Не удалось создать категорию', 'error')
    }
  }

  const sorted = [...cats].sort((a, b) => a.position - b.position)

  return (
    <GlassModal open={open} onClose={onClose} title="Категории курсов">
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
        Разделы витрины. Порядок здесь = порядок пилюль на витрине. Счётчик — все живые курсы
        (включая черновики и скрытые; на витрине считаются только видимые).
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Загружаем…
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Категорий нет — создайте первую.
          </div>
        ) : (
          sorted.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: i === sorted.length - 1 ? 'none' : '1px solid #1c1c1c',
              }}
            >
              <span style={{ fontSize: 11, color: C.textMuted, width: 18, textAlign: 'center', flex: 'none' }}>
                {i + 1}
              </span>
              <input
                type="text"
                defaultValue={c.name}
                key={`${c.id}:${c.name}`}
                onBlur={e => {
                  if (e.target.value.trim() && e.target.value.trim() !== c.name) handleRename(c.id, e.target.value)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                style={{
                  flex: 1,
                  background: C.bgSurface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  color: '#fff',
                  padding: '6px 10px',
                  fontSize: 13,
                  outline: 'none',
                  minWidth: 0,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              />
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', minWidth: 110, flex: 'none' }}>
                {c.id}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted, minWidth: 70, textAlign: 'right', flex: 'none' }}>
                {c.courses_count} {catPlural(c.courses_count)}
              </span>
              <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                <IconBtn title="Выше" disabled={i === 0} onClick={() => handleMove(c.id, -1)}>
                  ↑
                </IconBtn>
                <IconBtn title="Ниже" disabled={i === sorted.length - 1} onClick={() => handleMove(c.id, 1)}>
                  ↓
                </IconBtn>
              </span>
              <IconBtn
                title={
                  c.courses_count > 0
                    ? `в категории ${c.courses_count} ${catPlural(c.courses_count)} — сначала переведите их`
                    : 'Удалить категорию'
                }
                danger
                disabled={c.courses_count > 0}
                onClick={() => handleDelete(c)}
              >
                ✕
              </IconBtn>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          type="text"
          value={newName}
          onChange={e => {
            setNewName(e.target.value)
            setNewId(translit(e.target.value))
          }}
          placeholder="Название раздела"
          style={{
            flex: 1,
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: '#fff',
            padding: '8px 12px',
            fontSize: 13,
            outline: 'none',
            minWidth: 0,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={e => (e.currentTarget.style.borderColor = C.border)}
        />
        <input
          type="text"
          value={newId}
          onChange={e => setNewId(e.target.value)}
          placeholder="id (slug)"
          style={{
            width: 150,
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: '#fff',
            padding: '8px 12px',
            fontSize: 13,
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={e => (e.currentTarget.style.borderColor = C.border)}
        />
        <Btn variant="accent" sm onClick={handleAdd} >
          Добавить
        </Btn>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
        id — только латиница, цифры и дефис; после создания не меняется.
      </div>
    </GlassModal>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { archivePath, createPath, fetchPaths, publishPath } from './api'
import { Btn, C, StatusPill, fmtDate } from './ui'
import PathEditor from './PathEditor'
import type { PathListItem } from './types'

// Секция «Программы» под таблицей курсов (ТЗ-105 v2 Задача 5.3, мокап
// admin.html 308-333): заголовок + таблица (Программа / Статус / Курсов /
// Записано / Действия). Клик по строке — редактор. Черновик — «Опубл.»,
// published — «Архив». Публикация с <2 живых курсов — 422 текстом в тосте.

export default function PathSection({
  toast,
  toastError,
}: {
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
  toastError: (msg: string) => void
}) {
  const [paths, setPaths] = useState<PathListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPaths(await fetchPaths())
    } catch (err: any) {
      toastError(err?.message || 'Не удалось загрузить программы')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    try {
      const p = await createPath({ title: 'Новая программа' })
      toast('Черновик программы создан — добавьте курсы в редакторе', 'success')
      await load()
      setEditingId(p.id)
    } catch (err: any) {
      toastError(err?.message || 'Не удалось создать программу')
    }
  }

  const simpleAction = async (
    fn: () => Promise<unknown>,
    successMsg: string,
  ) => {
    try {
      await fn()
      await load()
      toast(successMsg, 'success')
    } catch (err: any) {
      // 422 publish (<2 живых курсов) — текстом бэкенда, не «успех».
      toastError(err?.message || 'Операция не удалась')
    }
  }

  return (
    <div style={{ marginTop: 28 }}>
      {/* Заголовок секции (мокап .page-title с .tick) + «+ Новая программа». */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 700 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: C.accent,
              boxShadow: '0 0 10px rgba(0,212,255,.55)',
              flex: 'none',
            }}
          />
          Программы
          <span style={{ color: C.textMuted, fontWeight: 500, fontSize: 14 }}>
            {paths.length} · маршруты из курсов
          </span>
        </div>
        <Btn variant="accent" onClick={handleCreate}>
          + Новая программа
        </Btn>
      </div>

      {/* Таблица (мокап .table-card). */}
      <div
        style={{
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderRadius: '.75rem',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Загружаем программы…
          </div>
        ) : paths.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
            Программ пока нет — создайте первую.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Программа', 'Статус', 'Курсов', 'Записано', 'Создана', 'Действия'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: C.textMuted,
                        padding: '14px 16px',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paths.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setEditingId(p.id)}
                    style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.bgHover }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>/education/paths/{p.slug}</div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <StatusPill status={p.status} />
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: '#E5E7EB' }}>
                      {p.courses_count}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: '#E5E7EB' }}>
                      {p.enrollments_count}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>
                      {fmtDate(p.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                      {p.status === 'draft' && (
                        <Btn
                          sm
                          variant="accent"
                          onClick={() =>
                            simpleAction(() => publishPath(p.id), 'Программа опубликована — видна на витрине')
                          }
                        >
                          Опубл.
                        </Btn>
                      )}
                      {p.status === 'published' && (
                        <Btn
                          sm
                          onClick={() =>
                            simpleAction(() => archivePath(p.id), 'Программа в архиве: с витрины убрана, записанные прогресс видят')
                          }
                        >
                          Архив
                        </Btn>
                      )}
                      {p.status === 'archived' && (
                        <Btn
                          sm
                          onClick={() =>
                            simpleAction(() => publishPath(p.id), 'Программа снова опубликована')
                          }
                        >
                          Опубл.
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId && (
        <PathEditor
          pathId={editingId}
          toast={toast}
          toastError={toastError}
          onClose={() => {
            setEditingId(null)
            load()
          }}
        />
      )}
    </div>
  )
}

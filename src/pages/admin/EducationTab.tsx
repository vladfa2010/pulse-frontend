import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import CategoriesModal from '@/components/admin/education/CategoriesModal'
import CourseEditor from '@/components/admin/education/CourseEditor'
import CourseTable from '@/components/admin/education/CourseTable'
import CreateCourseModal from '@/components/admin/education/CreateCourseModal'
import ModerationPanel from '@/components/admin/education/ModerationPanel'
import { archiveCourse, fetchCourse, fetchCourses, publishCourse, restoreCourse } from '@/components/admin/education/api'
import { C } from '@/components/admin/education/ui'
import type { CourseCard, CourseListItem } from '@/components/admin/education/types'

// Таб «Образование» админки (ТЗ-101): список курсов ↔ редактор.
// ТЗ-102: под-вкладка «На проверке (N)» — очередь модерации UGC; счётчик pending
// поднимаем наверх в Admin.tsx (бейдж на самом табе).

type EduSubTab = 'courses' | 'moderation'

export default function EducationTab({
  onModerationCount,
}: {
  onModerationCount?: (total: number) => void
}) {
  const { toast, toastError } = useToast()
  const [subTab, setSubTab] = useState<EduSubTab>('courses')
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [orphanCount, setOrphanCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [orphanOnly, setOrphanOnly] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [card, setCard] = useState<CourseCard | null>(null)
  const [moderationCount, setModerationCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchCourses({ orphans: orphanOnly, includeDeleted })
      setCourses(list)
      if (!orphanOnly) {
        fetchCourses({ orphans: true })
          .then(o => setOrphanCount(o.length))
          .catch(() => {})
      } else {
        setOrphanCount(list.length)
      }
    } catch (err: any) {
      toastError(err?.message || 'Не удалось загрузить курсы')
    } finally {
      setLoading(false)
    }
  }, [orphanOnly, includeDeleted, toastError])

  useEffect(() => {
    load()
  }, [load])

  const handleModerationCount = useCallback(
    (total: number) => {
      setModerationCount(total)
      onModerationCount?.(total)
    },
    [onModerationCount],
  )

  const openEditor = async (id: string) => {
    try {
      setCard(await fetchCourse(id))
      setEditingId(id)
    } catch (err: any) {
      toastError(err?.message || 'Не удалось открыть курс')
    }
  }

  const closeEditor = () => {
    setEditingId(null)
    setCard(null)
    load()
  }

  const simpleAction = async (
    c: CourseListItem,
    fn: () => Promise<unknown>,
    successMsg: string,
  ) => {
    try {
      await fn()
      await load()
      if (editingId === c.id) setCard(await fetchCourse(c.id).catch(() => null))
      toast(successMsg, 'success')
    } catch (err: any) {
      // 409 «курс с активными покупками, только архив», 422 publish — текстом бэкенда.
      toastError(err?.message || 'Операция не удалась')
    }
  }

  return (
    <div>
      {/* Под-вкладки (ТЗ-102): курсы и очередь модерации UGC. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(
          [
            { id: 'courses', label: 'Курсы', count: 0 },
            { id: 'moderation', label: 'На проверке', count: moderationCount },
          ] as { id: EduSubTab; label: string; count: number }[]
        ).map(t => {
          const on = subTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.05em',
                cursor: 'pointer',
                transition: 'all .2s',
                background: on ? C.bgHover : 'transparent',
                color: on ? C.accent : C.textMuted,
                border: on ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
              }}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: C.accent,
                    color: '#060606',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'inline-grid',
                    placeItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {subTab === 'courses' && (
        <>
          <CourseTable
            courses={courses}
            loading={loading}
            orphanCount={orphanCount}
            orphanOnly={orphanOnly}
            onToggleOrphan={() => setOrphanOnly(v => !v)}
            includeDeleted={includeDeleted}
            onToggleIncludeDeleted={() => setIncludeDeleted(v => !v)}
            onReload={load}
            onOpenCourse={openEditor}
            onOpenCreate={() => setShowCreate(true)}
            onOpenCategories={() => setShowCats(true)}
            onPublish={c => simpleAction(c, () => publishCourse(c.id), 'Курс опубликован — виден на витрине')}
            onArchive={c => simpleAction(c, () => archiveCourse(c.id), 'Курс в архиве: с витрины убран, ученики доступ сохраняют')}
            onRestore={c => simpleAction(c, () => restoreCourse(c.id), 'Курс восстановлен')}
            toast={toast}
          />

          {editingId && card && (
            <CourseEditor
              course={card}
              toast={toast}
              onClose={closeEditor}
              onUpdated={setCard}
              onReloadList={load}
            />
          )}

          <CreateCourseModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={load}
            toast={toast}
          />

          <CategoriesModal
            open={showCats}
            onClose={() => setShowCats(false)}
            onChanged={load}
            toast={toast}
          />
        </>
      )}

      {subTab === 'moderation' && (
        <ModerationPanel onCountChange={handleModerationCount} />
      )}
    </div>
  )
}

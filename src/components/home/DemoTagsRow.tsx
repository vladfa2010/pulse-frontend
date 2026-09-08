/**
 * PULSE — Демо-чипы тегов под поиском (гостевая главная, ТЗ-59)
 *
 * Показываем гостю теги демо-аккаунта (GET /api/public/demo-tags) как
 * работающий продукт. Чипы read-only: клик по любому открывает модалку
 * регистрации. Ошибка/пусто → ничего не рендерим.
 */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuthModal } from '@/contexts/AuthModalContext'

interface DemoTag {
  tag_id: string
  tag_name: string
  tag_type: string
}

// Те же цвета, что в компоненте Tag (компания/сектор/личность/тренд)
const typeColors: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}

// Пробегающее свечение по кромке чипов (ТЗ-66). Тюнит владелец.
const SWEEP_MS = 1200 // длительность пробега по одному чипу
const GAP_MS = 500    // пауза между чипами

export default function DemoTagsRow() {
  const { open: openAuthModal } = useAuthModal()
  const [tags, setTags] = useState<DemoTag[]>([])
  // Поочерёдный пробег блика: активный чип (ТЗ-66). Без анимации — статично.
  const [activeIdx, setActiveIdx] = useState(0)
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    let cancelled = false
    api.get('/public/demo-tags')
      .then((data: any) => {
        if (!cancelled && Array.isArray(data?.tags) && data.tags.length > 0) {
          setTags(data.tags)
        }
      })
      .catch(() => { /* демо-аккаунт не настроен/сервер недоступен — блок скрыт */ })
    return () => { cancelled = true }
  }, [])

  // Оркестратор пробега: чип 1 → 2 → 3 → по кругу (ТЗ-66)
  useEffect(() => {
    if (prefersReducedMotion || tags.length === 0) return
    const interval = window.setInterval(() => {
      setActiveIdx(i => (i + 1) % tags.length)
    }, SWEEP_MS + GAP_MS)
    return () => window.clearInterval(interval)
  }, [prefersReducedMotion, tags.length])

  if (tags.length === 0) return null

  return (
    <div className="w-full max-w-[720px] mx-auto mt-4">
      <div className="flex flex-wrap justify-center gap-2">
        {tags.map((tag, i) => {
          const color = typeColors[tag.tag_type] || '#00D4FF'
          return (
            <button
              key={tag.tag_id}
              onClick={() => openAuthModal('register')}
              title={tag.tag_name}
              className="relative overflow-hidden inline-flex items-center gap-2 h-9 px-3.5 rounded-pill text-sm font-medium text-text-primary transition-opacity hover:opacity-80"
              style={{
                backgroundColor: '#161616',
                border: `1px solid ${color}40`,
              }}
            >
              {i === activeIdx && (
                <>
                  <div
                    className="star-border-bottom"
                    style={{
                      background: `radial-gradient(circle, ${color}, transparent 10%)`,
                      animationDuration: `${SWEEP_MS}ms`,
                    }}
                  />
                  <div
                    className="star-border-top"
                    style={{
                      background: `radial-gradient(circle, ${color}, transparent 10%)`,
                      animationDuration: `${SWEEP_MS}ms`,
                    }}
                  />
                </>
              )}
              <span className="relative z-[1] w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="relative z-[1] truncate max-w-[clamp(72px,25vw,150px)]">{tag.tag_name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

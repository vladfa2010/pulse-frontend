/**
 * =============================================================================
 * ТЗ-201 — TagSelectBlockView: интерактивный блок «Теги портфеля» в уроке
 * =============================================================================
 *
 * Монтируется порталом в пустой div.tag-select-block (атом, как chart-block,
 * ТЗ-143): на LessonPage, в NodeView редактора (RichTextField) и доступен
 * гостю на shared-уроке (ТЗ-187 — гость видит демо, запросов к API нет,
 * любое взаимодействие → модалка логина).
 * ТЗ-203: glow — подсветка BorderGlow; при ней карточка уходит во frameless
 * (свои border/background/отступы отключаются, рамку рисует BorderGlow).
 */

import { useCallback } from 'react'
import { Tags } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { logAnalyticsEvent } from '@/lib/analytics'
import TagPicker from '@/components/tags/TagPicker'
import GlowBlock from '@/components/education/GlowBlock'

const DEMO_TAGS = [
  { label: 'Дивиденды', color: '#34D399' },
  { label: 'Рост', color: '#00D4FF' },
  { label: 'Облигации', color: '#A78BFA' },
  { label: 'Нефть', color: '#FBBF24' },
]

export default function TagSelectBlockView({ glow = false }: { glow?: boolean }) {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()

  const logInteraction = useCallback((action: string) => {
    logAnalyticsEvent('education.tag_block_interaction', {
      role: isLoggedIn ? 'user' : 'guest',
      action,
    })
  }, [isLoggedIn])

  return (
    <GlowBlock enabled={glow}>
      <div
        style={{
          background: glow ? 'transparent' : '#101010',
          border: glow ? 'none' : '1px solid #222222',
          borderRadius: 12,
          padding: '16px 18px',
          margin: glow ? 0 : '16px 0',
        }}
      >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Tags size={15} style={{ color: '#00D4FF' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>
          Теги портфеля
        </span>
      </div>

      {isLoggedIn ? (
        <TagPicker compact onChanged={(action) => logInteraction(action)} />
      ) : (
        /* Гость: демо-пилюли без API; любой клик → модалка логина/регистрации */
        <div onClickCapture={() => logInteraction('demo_click')}>
          {/* ТЗ-204: демо-пилюли по центру, как облако на главной */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {DEMO_TAGS.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => openAuthModal()}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#161616', border: `1px solid ${t.color}40`, color: '#D1D5DB' }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="mt-3 w-full min-h-[40px] rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
              color: '#060606',
              padding: '8px 16px',
            }}
          >
            Войдите, чтобы собрать свои теги
          </button>
        </div>
      )}
      </div>
    </GlowBlock>
  )
}

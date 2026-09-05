/**
 * =============================================================================
 * PULSE — Баннер «Тест каскадов и сюжетов» (ТЗ-47)
 * =============================================================================
 *
 * Временный баннер на авторизованной главной: переводит на внешний прототип
 * каскадов новостей. Снимается фичефлагом SHOW_CASCADE_TEST_BANNER — без реверта.
 *
 * - Кликабельна вся карточка (<a>, новая вкладка, noopener noreferrer).
 * - Эталон вёрстки — согласованный мокап f0271c5 (текст + кнопка, без мини-графика).
 * - Показ только авторизованным — условие рендера в Home.tsx.
 */

import { logAnalyticsEvent } from '@/lib/analytics'

// ТЗ-47 Задача 2: фичефлаг. false → баннер полностью убирается (визуально и из DOM).
const SHOW_CASCADE_TEST_BANNER = true

const PROTOTYPE_URL = 'https://j5gsuigoi6jro.kimi.page'

export default function CascadeTestBanner() {
  if (!SHOW_CASCADE_TEST_BANNER) return null

  return (
    <a
      href={PROTOTYPE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => logAnalyticsEvent('cascade_prototype_click', { source: 'home_banner' })}
      className="cascade-test-banner group relative block overflow-hidden rounded-[18px] px-7 py-7 transition-all duration-200 hover:-translate-y-px"
      style={{
        backgroundColor: '#101012',
        border: '1px solid rgba(255,255,255,.09)',
      }}
    >
      {/* Радиальные подсветки: бирюза сверху справа, золото снизу слева */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,.10) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-24 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(253,203,110,.07) 0%, transparent 70%)' }}
      />
      {/* Ховер-рамка (бирюза) поверх подсветок */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[18px] transition-colors duration-200 opacity-0 group-hover:opacity-100"
        style={{ border: '1px solid rgba(34,211,238,.45)' }}
      />

      <div className="relative flex flex-col gap-4">
        {/* Кикер */}
        <span
          className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
          style={{
            color: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,.08)',
            border: '1px solid rgba(34,211,238,.35)',
          }}
        >
          <span className="cascade-test-banner__dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22d3ee' }} />
          Прототип · тест
        </span>

        {/* Заголовок */}
        <h3
          className="cascade-test-banner__title font-bold"
          style={{ color: '#f2f2f2', lineHeight: 1.2, letterSpacing: '-0.02em' }}
        >
          Тест каскадов и сюжетов.
          <br />
          <span style={{ color: '#22d3ee' }}>Какой источник дает первую информацию</span>
        </h3>

        {/* Описание */}
        <p className="text-sm leading-relaxed" style={{ color: '#8b8f98', maxWidth: '480px' }}>
          Смотрите, кто публикует новость первым и с каким отставанием идут дубли — на живом графике каскада. Оцените прототип и оставьте фидбек.
        </p>

        {/* Кнопка */}
        <span
          className="cascade-test-banner__btn inline-flex items-center gap-2 self-start h-11 px-5 rounded-full text-sm font-semibold transition-colors duration-200"
          style={{
            color: '#fdcb6e',
            backgroundColor: 'rgba(253,203,110,.12)',
            border: '1px solid rgba(253,203,110,.4)',
          }}
        >
          Открыть прототип →
        </span>
      </div>
    </a>
  )
}

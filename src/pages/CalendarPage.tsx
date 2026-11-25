/**
 * =============================================================================
 * PULSE — Страница «Календарь» (ТЗ-194 + ТЗ «нативная встройка» + ТЗ-212 v2)
 * =============================================================================
 *
 * Двухблоковая страница: виджет «Ритм рынков» (нативный React-компонент,
 * `src/components/market-rhythm/`, порт эталона ТЗ-194) + копия блока
 * «Календарь инвестора» с главной (ТЗ-212 v2 — копия, не перенос: на главной
 * блок сохраняется). Компонент CalendarBlock без изменений; общий queryKey
 * ['calendar'] React Query — переход главная ↔ /calendar без дубля запроса.
 */

import { useAuth } from '@/hooks/useAuth'
import CalendarBlock from '@/components/CalendarBlock'
import LazyRender from '@/components/LazyRender'
import MarketRhythm from '@/components/market-rhythm/MarketRhythm'

export default function CalendarPage() {
  const { portfolio, user } = useAuth()

  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1280px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Календарь</h1>
        <p className="text-sm text-text-muted">
          Ритм рынков и события: торговые сессии мировых бирж, отчётности, дивиденды и собрания.
        </p>
      </header>

      <MarketRhythm />

      {/* caption-паттерном приложения вместо футера виджета (текст дословно из ТЗ-194) */}
      <p className="mt-4 text-xs text-text-muted leading-relaxed">
        Как читать: линия на шкале — текущее время, зелёные строки — открытые сейчас биржи
        (скоро закрывающиеся сверху), приглушённая строка — выбранная биржа, если она закрыта.
        Клик по строке подсвечивает биржу на карте. Яркость символов — реальный день и ночь:
        светлая зона — там, где сейчас день.
      </p>

      {/* ==================== INVESTOR CALENDAR ==================== */}
      {/* ТЗ-212 v2: копия блока с главной, компонент без изменений.
          LazyRender — запрос /api/calendar уходит только при скролле к блоку */}
      <LazyRender>
        <CalendarBlock portfolio={portfolio} isAdmin={user?.isAdmin ?? false} />
      </LazyRender>
    </div>
  )
}

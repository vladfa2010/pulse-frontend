/**
 * =============================================================================
 * PULSE — Страница «Календарь» (ТЗ-194 + ТЗ «нативная встройка»)
 * =============================================================================
 *
 * Виджет «Ритм рынков» — нативный React-компонент
 * (`src/components/market-rhythm/`, порт эталона ТЗ-194): iframe-встройка
 * отклонена владельцем (ТЗ «нативная встройка + фикс X-Frame-Options»),
 * public/widgets/ удалён, запросов к /widgets/* нет — X-Frame-Options DENY
 * на статике больше не мешает (остаётся на API, где и был).
 */

import MarketRhythm from '@/components/market-rhythm/MarketRhythm'

export default function CalendarPage() {
  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1280px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Календарь</h1>
        <p className="text-sm text-text-muted">
          Ритм рынков: карта торговых сессий мировых бирж в реальном времени.
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
    </div>
  )
}

/**
 * =============================================================================
 * PULSE — Страница «Календарь» (ТЗ-194)
 * =============================================================================
 *
 * Каркас страницы: шапка + самодостаточный виджет «Ритм рынков»
 * (public/widgets/market-rhythm/index.html — копия 1:1 из раздела 3 ТЗ-194,
 * замороженный артефакт, менять только через правку ТЗ). Виджет без бэкенда
 * и протоколов, поэтому встраивается через iframe с sandbox="allow-scripts".
 * Публичная страница — данные о сессиях бирж не персональные.
 */
export default function CalendarPage() {
  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1280px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Календарь</h1>
        <p className="text-sm text-text-muted">
          Ритм рынков: карта торговых сессий мировых бирж в реальном времени.
        </p>
      </header>

      {/* ТЗ-194 Задача 3: рекомендуемые атрибуты iframe */}
      <iframe
        src="/widgets/market-rhythm/index.html"
        title="Ритм рынков — карта торговых сессий"
        loading="lazy"
        sandbox="allow-scripts"
        className="w-full h-[1380px] md:h-[920px] rounded-2xl border border-white/[0.06]"
        style={{ background: '#060606' }}
      />
    </div>
  )
}

import SentimentChartCard from '@/components/SentimentChartCard'

export default function SentimentIndex() {
  return (
    <div className="min-h-screen bg-bg-primary text-white pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-[1000px] mx-auto">
        {/* ТЗ-162: метрики сообщества скрыты (база маленькая — «Онлайн: 2» демотивирует).
            Временно: вернём проп при росте активной базы. Компонент и его дефолт не трогаем. */}
        <SentimentChartCard showMetrics={false} />
      </div>
    </div>
  )
}

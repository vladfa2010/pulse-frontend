interface EmptyStubProps {
  scope: 'portfolio' | 'tag' | 'all'
}

export default function EmptyStub({ scope }: EmptyStubProps) {
  const title = scope === 'portfolio'
    ? 'Добавьте теги в портфель'
    : scope === 'tag'
      ? 'Нет данных по этому тегу'
      : 'Нет данных'

  const desc = scope === 'portfolio'
    ? 'Здесь появится тепловая карта новостной активности по вашим тегам.'
    : scope === 'tag'
      ? 'За выбранный период по тегу не найдено новостей.'
      : 'За выбранный период не найдено новостей.'

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-xs">{desc}</p>
    </div>
  )
}

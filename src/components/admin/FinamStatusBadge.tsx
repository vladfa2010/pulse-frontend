interface FinamStatus { ok: boolean; ms: number; error?: string }

export default function FinamStatusBadge({ finam }: { finam: FinamStatus | null | undefined }) {
  if (!finam) return null
  const maintenance = finam.ok && finam.error?.includes('maintenance')
  if (maintenance) {
    return <span className="text-yellow-500">● Finam: техработы до 06:15 МСК</span>
  }
  if (finam.ok) {
    return <span className="text-green-500">● Finam: подключён{finam.ms > 0 ? ` · ${finam.ms} мс` : ''}</span>
  }
  const noKey = finam.error?.includes('FINAM_MARKET_SECRET')
  return (
    <span className="text-red-500" title={finam.error}>
      ● Finam: {noKey ? 'нет ключа' : 'ошибка'} {finam.ms > 0 ? `· ${finam.ms} мс` : ''}
    </span>
  )
}

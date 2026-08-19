import { useEffect, useRef, useState } from 'react'
import { adminApi } from '@/lib/api'

interface ExchangeItem {
  mic: string
  name: string
}

interface Match {
  symbol: string
  mic: string
  ticker: string
  name: string
  type: string
  isin?: string | null
}

interface Props {
  onPick: (match: Match) => void
  placeholder?: string
  compact?: boolean
  initialQuery?: string
}

const TYPE_LABEL: Record<string, string> = {
  EQUITIES: 'акция',
  BONDS: 'облигация',
  FUTURES: 'фьючерс',
  OPTIONS: 'опцион',
  CURRENCIES: 'валюта',
  INDICES: 'индекс',
  ETF: 'ETF',
}

export default function InstrumentSearchInput({
  onPick,
  placeholder = 'Тикер, название или ISIN',
  compact = false,
  initialQuery = '',
}: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [exchangesLoaded, setExchangesLoaded] = useState(false)
  const [exchangeNames, setExchangeNames] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    adminApi.get('/admin/market/exchanges')
      .then((d) => {
        const list: ExchangeItem[] = d.exchanges || []
        const map: Record<string, string> = {}
        for (const e of list) map[String(e.mic).toUpperCase()] = e.name
        setExchangeNames(map)
        setExchangesLoaded(true)
      })
      .catch(() => { setExchangesLoaded(true) })
  }, [])

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const exchangeLabel = (mic: string): string => {
    const name = exchangeNames[mic?.toUpperCase()]
    return name ? `${mic} · ${name}` : mic
  }

  const onQueryChange = (value: string) => {
    setQuery(value.toUpperCase())
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const d = await adminApi.get(`/admin/market/search?q=${encodeURIComponent(value.trim())}`)
        setSuggestions(d.matches || [])
        setOpen(true)
      } catch { setSuggestions([]) }
      finally { setSearching(false) }
    }, 300)
  }

  const pick = (m: Match) => {
    setQuery(m.symbol)
    setOpen(false)
    onPick(m)
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions.length > 0) pick(suggestions[0])
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={exchangesLoaded ? placeholder : 'Загружаем справочник бирж…'}
        disabled={!exchangesLoaded}
        className={`rounded-lg bg-[#111111] border border-[#222222] text-sm text-white disabled:opacity-50 outline-none focus:border-[#333333] ${compact ? 'px-2 py-1 w-full' : 'px-3 py-1.5 w-72'}`}
      />
      {searching && <span className="absolute right-3 top-2 text-xs text-gray-500">…</span>}
      {open && suggestions.length > 0 && (
        <div className={`absolute z-10 mt-1 rounded-lg border border-[#222222] bg-[#0D0D0D] shadow-xl max-h-64 overflow-y-auto ${compact ? 'w-full min-w-[360px]' : 'w-full min-w-[420px]'}`}>
          {suggestions.map((m) => (
            <button key={m.symbol} onMouseDown={() => pick(m)}
              className="flex gap-3 items-baseline w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-[#161616] hover:text-white">
              <span className="font-medium">{m.ticker}</span>
              <span className="text-gray-400 truncate"> — {m.name} </span>
              {m.isin && <span className="text-gray-600 text-xs hidden sm:inline">{m.isin}</span>}
              <span className="text-gray-500 text-xs ml-auto whitespace-nowrap">
                {m.type ? <span className="mr-1 px-1 rounded bg-[#1a1a1a] border border-[#262626] text-gray-400">{TYPE_LABEL[m.type] ?? m.type}</span> : null}
                ({exchangeLabel(m.mic)})
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !searching && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#222222] bg-[#0D0D0D] px-3 py-2 text-xs text-gray-500">
          Не найдено. Индексы (IMOEX) в справочнике отсутствуют — это нормально.
        </div>
      )}
    </div>
  )
}

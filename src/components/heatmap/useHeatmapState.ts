import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '@/lib/api'
import type { Scope, Scale, IndexChoice, YearPayload, DayPayload, DayHoursPayload, CandlesPayload } from './types'

interface HeatmapState {
  scope: Scope
  scale: Scale
  tagId: string
  date: string
  index: IndexChoice
  year: YearPayload | null
  day: DayPayload | null
  hours: DayHoursPayload | null
  candles: CandlesPayload | null
  loading: boolean
  error: string | null
  hoveredDate: string | null
}

export function useHeatmapState(): {
  state: HeatmapState
  setScope: (s: Scope) => void
  setScale: (s: Scale) => void
  setTagId: (id: string) => void
  setDate: (d: string) => void
  setIndex: (ix: IndexChoice) => void
  setHoveredDate: (d: string | null) => void
  updateParams: (entries: Record<string, string>) => void
  refetch: () => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const scope = (searchParams.get('scope') as Scope) || 'portfolio'
  const scale = (searchParams.get('scale') as Scale) || 'year'
  const tagId = searchParams.get('tag_id') || ''
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const index = (searchParams.get('index') as IndexChoice) || 'IMOEX'

  const [year, setYear] = useState<YearPayload | null>(null)
  const [day, setDay] = useState<DayPayload | null>(null)
  const [hours, setHours] = useState<DayHoursPayload | null>(null)
  const [candles, setCandles] = useState<CandlesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const updateParam = useCallback(
    (key: string, value: string) => {
      // Одиночный ключ за вызов. ВАЖНО: setSearchParams — это navigate,
      // а не setState: функциональная форма получает searchParams из
      // замыкания, вызовы в одном батче НЕ накапливаются (второй затирает
      // первый). Несколько ключей — только через updateParams.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Атомарное обновление нескольких query-параметров одним navigate.
  const updateParams = useCallback(
    (entries: Record<string, string>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(entries)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const setScope = useCallback(
    (s: Scope) => updateParam('scope', s),
    [updateParam]
  )
  const setScale = useCallback(
    (s: Scale) => updateParam('scale', s),
    [updateParam]
  )
  const setTagId = useCallback(
    (id: string) => updateParam('tag_id', id),
    [updateParam]
  )
  const setDate = useCallback(
    (d: string) => updateParam('date', d),
    [updateParam]
  )
  const setIndex = useCallback(
    (ix: IndexChoice) => updateParam('index', ix === 'IMOEX' ? '' : ix),
    [updateParam]
  )

  const fetchYear = useCallback(async () => {
    const params = new URLSearchParams({ scope, scale: 'year' })
    if (scope === 'tag') params.set('tag_id', tagId)
    return api.get(`/news_heatmap?${params.toString()}`) as Promise<YearPayload>
  }, [scope, tagId])

  const fetchDay = useCallback(async () => {
    const params = new URLSearchParams({ scope, scale: 'day', date })
    if (scope === 'tag') params.set('tag_id', tagId)
    return api.get(`/news_heatmap?${params.toString()}`) as Promise<DayPayload>
  }, [scope, tagId, date])

  const fetchHours = useCallback(async () => {
    const params = new URLSearchParams({ scope, scale: 'day_hours' })
    if (scope === 'tag') params.set('tag_id', tagId)
    return api.get(`/news_heatmap?${params.toString()}`) as Promise<DayHoursPayload>
  }, [scope, tagId])

  const fetchCandles = useCallback(async () => {
    if (scope === 'tag' && tagId) {
      return api.get(`/news_heatmap/candles?tag_id=${encodeURIComponent(tagId)}`) as Promise<CandlesPayload>
    }
    if ((scope === 'all' || scope === 'portfolio') && index !== 'none') {
      return api.get(`/news_heatmap/candles?index=${index}`) as Promise<CandlesPayload>
    }
    return null
  }, [scope, tagId, index])

  const refetch = useCallback(async () => {
    // Диплинк scope=tag без tag_id: ждём ввод тикера, API не дёргаем (иначе 400).
    if (scope === 'tag' && !tagId) {
      setYear(null)
      setCandles(null)
      setDay(null)
      setHours(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [yearData, candlesData] = await Promise.all([
        fetchYear(),
        fetchCandles(),
        scale === 'day' ? fetchDay() : Promise.resolve(null),
        scale === 'day_hours' ? fetchHours() : Promise.resolve(null),
      ])
      setYear(yearData)
      setCandles(candlesData)
      if (scale === 'day') setDay(await fetchDay())
      if (scale === 'day_hours') setHours(await fetchHours())
    } catch (err: any) {
      setError(err.message || 'Failed to load heatmap')
    } finally {
      setLoading(false)
    }
  }, [fetchYear, fetchCandles, fetchDay, fetchHours, scale])

  useEffect(() => {
    refetch()
  }, [scope, tagId, scale, date, index, refetch])

  return {
    state: {
      scope,
      scale,
      tagId,
      date,
      index,
      year,
      day,
      hours,
      candles,
      loading,
      error,
      hoveredDate,
    },
    setScope,
    setScale,
    setTagId,
    setDate,
    setIndex,
    setHoveredDate,
    updateParams,
    refetch,
  }
}

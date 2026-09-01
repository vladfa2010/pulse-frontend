import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '@/lib/api'
import type { Scope, Scale, YearPayload, DayPayload, DayHoursPayload, CandlesPayload } from './types'

interface HeatmapState {
  scope: Scope
  scale: Scale
  tagId: string
  date: string
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
  setHoveredDate: (d: string | null) => void
  refetch: () => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const scope = (searchParams.get('scope') as Scope) || 'portfolio'
  const scale = (searchParams.get('scale') as Scale) || 'year'
  const tagId = searchParams.get('tag_id') || ''
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const [year, setYear] = useState<YearPayload | null>(null)
  const [day, setDay] = useState<DayPayload | null>(null)
  const [hours, setHours] = useState<DayHoursPayload | null>(null)
  const [candles, setCandles] = useState<CandlesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
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
    if (scope === 'all' || scope === 'portfolio') {
      return api.get(`/news_heatmap/candles?index=IMOEX`) as Promise<CandlesPayload>
    }
    return null
  }, [scope, tagId])

  const refetch = useCallback(async () => {
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
  }, [scope, tagId, scale, date, refetch])

  return {
    state: {
      scope,
      scale,
      tagId,
      date,
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
    setHoveredDate,
    refetch,
  }
}

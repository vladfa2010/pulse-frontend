import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { logAnalyticsEvent } from '@/lib/analytics'

export function useAnalyticsPageTracking() {
  const location = useLocation()

  useEffect(() => {
    logAnalyticsEvent('page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    })
  }, [location])
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDashboardOverview } from '@features/dashboard/services/dashboardService'
import type { DashboardOverview } from '@features/dashboard/dashboard.types'

export const useDashboardOverview = (enabled: boolean) => {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const next = await getDashboardOverview()

      setData(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh
    }),
    [data, loading, error, refresh]
  )
}


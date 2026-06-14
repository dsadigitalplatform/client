'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getMonthlyPerformance } from '@features/dashboard/services/dashboardService'
import type { MonthlyPerformanceData } from '@features/dashboard/dashboard.types'

export const useMonthlyPerformance = (enabled: boolean, assignedAgentId?: string) => {
  const [data, setData] = useState<MonthlyPerformanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setError(null)
      setLoading(false)

      return
    }

    setLoading(true)
    setError(null)

    try {
      const next = await getMonthlyPerformance(assignedAgentId)

      setData(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to load monthly performance')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [assignedAgentId, enabled])

  useEffect(() => {
    void refresh()
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

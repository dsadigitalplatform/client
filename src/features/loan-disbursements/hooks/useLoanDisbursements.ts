'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DisbursementTrackerListItem } from '@features/loan-disbursements/loan-disbursements.types'
import {
  listDisbursementTrackers,
  type DisbursementListSummary
} from '@features/loan-disbursements/services/loanDisbursementsService'

const emptySummary: DisbursementListSummary = {
  total: 0,
  pending: 0,
  partial: 0,
  completed: 0,
  totalDisbursed: 0
}

export function useLoanDisbursements(filters?: { statusFilter?: string; assignedAgentId?: string }) {
  const [trackers, setTrackers] = useState<DisbursementTrackerListItem[]>([])
  const [summary, setSummary] = useState<DisbursementListSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await listDisbursementTrackers(
        filters?.assignedAgentId ? { assignedAgentId: filters.assignedAgentId } : undefined
      )
      let list = data.trackers

      if (filters?.statusFilter) {
        list = list.filter(t => t.disbursementStatus === filters.statusFilter)
      }

      setTrackers(list)
      setSummary(data.summary)
    } catch (e: unknown) {
      setTrackers([])
      setSummary(emptySummary)
      setError((e as Error)?.message || 'Failed to load disbursements')
    } finally {
      setLoading(false)
    }
  }, [filters?.assignedAgentId, filters?.statusFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { trackers, summary, loading, error, refresh }
}

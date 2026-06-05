'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getLoanCases } from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

export type LoanCasesFilters = {
  stageId?: string
  assignedAgentId?: string
  bankName?: string
  showInactive?: boolean
  stagedDateFrom?: string
  stagedDateTo?: string
  progressivePaymentFilter?: 'ready_to_track' | 'tracking_active'
}

export const useLoanCases = (filters: LoanCasesFilters) => {
  const [cases, setCases] = useState<LoanCaseListItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const data = await getLoanCases(filters)

      setCases(data as LoanCaseListItem[])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  return useMemo(
    () => ({
      cases,
      loading,
      refresh
    }),
    [cases, loading, refresh]
  )
}

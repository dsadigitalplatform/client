'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import type { LoanStatusStage } from '@features/loan-status-pipeline/loan-status-pipeline.types'

export const useLoanStatusPipeline = () => {
  const [stages, setStages] = useState<LoanStatusStage[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getLoanStatusPipelineStages({ q: search })

    setStages(data as unknown as LoanStatusStage[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      stages,
      loading,
      search,
      setSearch,
      refresh
    }),
    [stages, loading, search, refresh]
  )

  return value
}


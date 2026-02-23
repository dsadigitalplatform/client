'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getLoanTypes } from '@features/loan-types/services/loanTypesService'
import type { LoanType } from '@features/loan-types/loan-types.types'

export const useLoanTypes = () => {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getLoanTypes({ q: search })

    setLoanTypes(data as unknown as LoanType[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      loanTypes,
      loading,
      search,
      setSearch,
      refresh
    }),
    [loanTypes, loading, search, refresh]
  )

  return value
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getBanks } from '@features/banks/services/banksService'
import type { Bank } from '@features/banks/banks.types'

export const useBanks = () => {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getBanks({ q: search })

    setBanks(data as unknown as Bank[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      banks,
      loading,
      search,
      setSearch,
      refresh
    }),
    [banks, loading, search, refresh]
  )

  return value
}

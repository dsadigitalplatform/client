'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getCorporates } from '@features/corporates/services/corporatesService'
import type { Corporate } from '@features/corporates/corporates.types'

export const useCorporates = () => {
  const [corporates, setCorporates] = useState<Corporate[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getCorporates({ q: search })

    setCorporates(data as unknown as Corporate[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      corporates,
      loading,
      search,
      setSearch,
      refresh
    }),
    [corporates, loading, search, refresh]
  )

  return value
}

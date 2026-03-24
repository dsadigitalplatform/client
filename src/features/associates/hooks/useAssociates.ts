'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getAssociates } from '@features/associates/services/associatesService'
import type { Associate } from '@features/associates/associates.types'

export const useAssociates = () => {
  const [associates, setAssociates] = useState<Associate[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getAssociates({ q: search })

    setAssociates(data as unknown as Associate[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      associates,
      loading,
      search,
      setSearch,
      refresh
    }),
    [associates, loading, search, refresh]
  )

  return value
}

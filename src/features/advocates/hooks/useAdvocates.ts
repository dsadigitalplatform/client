'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getAdvocates } from '@features/advocates/services/advocatesService'
import type { Advocate } from '@features/advocates/advocates.types'

export const useAdvocates = () => {
  const [advocates, setAdvocates] = useState<Advocate[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getAdvocates({ q: search })

    setAdvocates(data as unknown as Advocate[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      advocates,
      loading,
      search,
      setSearch,
      refresh
    }),
    [advocates, loading, search, refresh]
  )

  return value
}

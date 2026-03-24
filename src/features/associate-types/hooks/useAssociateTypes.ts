'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getAssociateTypes } from '@features/associate-types/services/associateTypesService'
import type { AssociateType } from '@features/associate-types/associate-types.types'

export const useAssociateTypes = () => {
  const [associateTypes, setAssociateTypes] = useState<AssociateType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getAssociateTypes({ q: search })

    setAssociateTypes(data as unknown as AssociateType[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      associateTypes,
      loading,
      search,
      setSearch,
      refresh
    }),
    [associateTypes, loading, search, refresh]
  )

  return value
}

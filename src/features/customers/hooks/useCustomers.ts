'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getCustomers } from '@features/customers/services/customersService'
import type { Customer } from '@features/customers/customers.types'

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getCustomers({ q: search })

    setCustomers(data as unknown as Customer[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      customers,
      loading,
      search,
      setSearch,
      refresh
    }),
    [customers, loading, search, refresh]
  )

  return value
}

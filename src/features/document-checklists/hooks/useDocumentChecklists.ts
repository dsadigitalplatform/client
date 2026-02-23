'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDocumentChecklists } from '@features/document-checklists/services/documentChecklistsService'
import type { DocumentChecklist } from '@features/document-checklists/document-checklists.types'

export const useDocumentChecklists = () => {
  const [documents, setDocuments] = useState<DocumentChecklist[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getDocumentChecklists({ q: search })

    setDocuments(data as unknown as DocumentChecklist[])
    setLoading(false)
  }, [search])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      documents,
      loading,
      search,
      setSearch,
      refresh
    }),
    [documents, loading, search, refresh]
  )

  return value
}

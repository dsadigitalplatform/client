'use client'

import { useEffect, useState } from 'react'

import Skeleton from '@mui/material/Skeleton'

import { LeadCodeChip } from '@features/loan-cases/components/LeadCodeDisplay'
import { previewLeadCode } from '@features/loan-cases/services/loanCasesService'

type Props = {
  customerName?: string | null
  loanTypeName?: string | null
  loanTypeCode?: string | null
  bankName?: string | null
  bankCode?: string | null
}

export function LeadCodePreview({
  customerName,
  loanTypeName,
  loanTypeCode,
  bankName,
  bankCode
}: Props) {
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)

      try {
        const result = await previewLeadCode({
          customerName,
          loanTypeName,
          loanTypeCode,
          bankName,
          bankCode
        })

        if (cancelled) return

        setPreview(result.preview || null)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [bankCode, bankName, customerName, loanTypeCode, loanTypeName])

  if (loading) {
    return <Skeleton variant='rounded' width={148} height={24} sx={{ borderRadius: 999 }} />
  }

  if (!preview) return null

  return <LeadCodeChip code={preview} color='primary' variant='outlined' />
}

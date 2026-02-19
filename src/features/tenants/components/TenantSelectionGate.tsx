'use client'

import { useEffect, useState } from 'react'

import { TenantSelectionModal } from './TenantSelectionModal'

export const TenantSelectionGate = () => {
  const [shouldOpen, setShouldOpen] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const mRes = await fetch('/api/memberships/by-user', { cache: 'no-store' })

        const m = await mRes.json()

        if (mRes.ok) {
          const count = Number(m?.count || 0)

          if (count > 1) {
            setShouldOpen(true)
          }
        }
      } catch {
        // ignore
      }
    }

    check()
  }, [])

  return shouldOpen ? <TenantSelectionModal open /> : null
}

'use client'

import { useEffect, useState } from 'react'

import { TenantSelectionModal } from './TenantSelectionModal'

export const TenantSelectionGate = () => {
  const [shouldOpen, setShouldOpen] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        // First, see if a current tenant is already selected
        const sRes = await fetch('/api/session/tenant', { cache: 'no-store' })
        const s = await sRes.json().catch(() => ({}))

        const hasCurrent = typeof s?.currentTenantId === 'string' && s.currentTenantId.length > 0

        if (hasCurrent) {
          setShouldOpen(false)
          
return
        }

        // If no current tenant, and user has multiple memberships, prompt selection
        const mRes = await fetch('/api/memberships/by-user', { cache: 'no-store' })
        const m = await mRes.json()

        if (mRes.ok) {
          const count = Number(m?.count || 0)

          setShouldOpen(count > 1)
        }
      } catch {
        // ignore
      }
    }

    check()
  }, [])

  return shouldOpen ? <TenantSelectionModal open /> : null
}

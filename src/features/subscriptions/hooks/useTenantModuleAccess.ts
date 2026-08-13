'use client'

import { useEffect, useState } from 'react'

import { useSession } from 'next-auth/react'

import type { ModuleFeatureKey } from '@features/subscription-plans/featureCatalog'

type ModuleAccessState = {
  loading: boolean
  enabled: boolean
  planName: string | null
}

function isSessionSuperAdmin(session: unknown): boolean {
  const s = session as { isSuperAdmin?: boolean; user?: { isSuperAdmin?: boolean } } | null

  return Boolean(s?.isSuperAdmin || s?.user?.isSuperAdmin)
}

/**
 * Client-side check for a plan module via the tenant subscription API.
 * Defaults to enabled while loading to avoid a flash of lock UI for entitled tenants.
 * Super admins always bypass plan module restrictions.
 */
export function useTenantModuleAccess(moduleKey: ModuleFeatureKey): ModuleAccessState {
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = isSessionSuperAdmin(session)

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [planName, setPlanName] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (sessionStatus === 'loading') return

    if (isSuperAdmin) {
      setEnabled(true)
      setPlanName(null)
      setLoading(false)

      return
    }

    ;(async () => {
      setLoading(true)

      try {
        const res = await fetch('/api/tenant/subscription', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))

        if (!active) return

        if (!res.ok) {
          // Keep page usable if subscription API fails; server still enforces.
          setEnabled(true)
          setPlanName(null)

          return
        }

        const modules = data?.entitlements?.modules
        const isOn = Boolean(modules?.[moduleKey])
        const usable = data?.access?.isUsable !== false

        setEnabled(usable && isOn)
        setPlanName(typeof data?.plan?.name === 'string' ? data.plan.name : null)
      } catch {
        if (active) {
          setEnabled(true)
          setPlanName(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [moduleKey, isSuperAdmin, sessionStatus])

  return { loading, enabled, planName }
}

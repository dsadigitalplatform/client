'use client'

import { useEffect, useState } from 'react'

import { useSession } from 'next-auth/react'

import type { LimitFeatureKey } from '@features/subscription-plans/featureCatalog'
import { isUnlimited } from '@features/subscription-plans/featureCatalog'

type LimitAccessState = {
  loading: boolean
  atLimit: boolean
  limit: number
  used: number
  unlimited: boolean
  planName: string | null
}

const USAGE_KEY: Record<LimitFeatureKey, 'users' | 'customers' | 'leads'> = {
  maxUsers: 'users',
  maxCustomers: 'customers',
  maxLeads: 'leads'
}

function isSessionSuperAdmin(session: unknown): boolean {
  const s = session as { isSuperAdmin?: boolean; user?: { isSuperAdmin?: boolean } } | null

  return Boolean(s?.isSuperAdmin || s?.user?.isSuperAdmin)
}

/**
 * Client-side check for a plan usage limit via the tenant subscription API.
 * Defaults to not-at-limit while loading so entitled tenants avoid a flash of lock UI.
 * Super admins always bypass plan usage limits.
 */
export function useTenantLimitAccess(limitKey: LimitFeatureKey): LimitAccessState {
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = isSessionSuperAdmin(session)

  const [loading, setLoading] = useState(true)
  const [atLimit, setAtLimit] = useState(false)
  const [limit, setLimit] = useState(-1)
  const [used, setUsed] = useState(0)
  const [unlimited, setUnlimited] = useState(true)
  const [planName, setPlanName] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (sessionStatus === 'loading') return

    if (isSuperAdmin) {
      setAtLimit(false)
      setUnlimited(true)
      setLimit(-1)
      setUsed(0)
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
          setAtLimit(false)
          setPlanName(null)

          return
        }

        const rawLimit = Number(data?.entitlements?.limits?.[limitKey] ?? -1)
        const rawUsed = Number(data?.usage?.[USAGE_KEY[limitKey]] ?? 0)
        const usable = data?.access?.isUsable !== false
        const unlimitedLimit = isUnlimited(rawLimit)

        setLimit(rawLimit)
        setUsed(rawUsed)
        setUnlimited(unlimitedLimit)
        setAtLimit(!usable || (!unlimitedLimit && rawUsed >= rawLimit))
        setPlanName(typeof data?.plan?.name === 'string' ? data.plan.name : null)
      } catch {
        if (active) {
          setAtLimit(false)
          setPlanName(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [limitKey, isSuperAdmin, sessionStatus])

  return { loading, atLimit, limit, used, unlimited, planName }
}

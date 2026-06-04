import 'server-only'

import type { Session } from 'next-auth'

import { getDemoTenantIdOrNull, isDemoLoginEnabled } from '@/lib/demoLogin'

type SessionWithTenant = Session & {
  userId?: string
  currentTenantId?: string
  isDemoMode?: boolean
}

export function resolveCurrentTenantId(
  session: SessionWithTenant | null | undefined,
  cookieTenantId?: string | null
): string {
  const sessionTenantId = String(session?.currentTenantId || '')
  const resolved = cookieTenantId || sessionTenantId

  if (session?.isDemoMode && isDemoLoginEnabled()) {
    const demoTenantId = getDemoTenantIdOrNull()

    if (demoTenantId) return demoTenantId
  }

  return resolved
}

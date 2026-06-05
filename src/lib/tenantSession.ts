import 'server-only'

import { getDemoTenantIdOrNull, isDemoLoginEnabled } from '@/lib/demoLogin'

export type SessionWithTenant = {
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

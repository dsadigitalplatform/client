import 'next-auth'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface ImpersonationSession {
    active: boolean
    actorUserId: string
    targetUserId: string
    startedAt: string
    reason?: string
    auditId?: string
  }

  interface User {
    isSuperAdmin?: boolean
  }
  interface Session {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
    isSuperAdmin?: boolean
    impersonation?: ImpersonationSession
    impersonationStartNonce?: string
    impersonationStop?: boolean
    user?: DefaultSession['user'] & {
      isSuperAdmin?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWTImpersonation {
    active: boolean
    actorUserId: string
    targetUserId: string
    startedAt: string
    reason?: string
    auditId?: string
  }

  interface JWT {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
    isSuperAdmin?: boolean
    impersonation?: JWTImpersonation
  }
}

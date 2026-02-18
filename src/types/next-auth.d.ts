import 'next-auth'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    isSuperAdmin?: boolean
  }
  interface Session {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
    isSuperAdmin?: boolean
    user?: DefaultSession['user'] & {
      isSuperAdmin?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
    isSuperAdmin?: boolean
  }
}

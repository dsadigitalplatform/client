import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    tenantIds?: string[]
    currentTenantId?: string
  }
}

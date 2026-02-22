'use client'

import type { ChildrenType } from '@core/types'
import { SessionProvider } from 'next-auth/react'

const ClientProviders = ({ children }: ChildrenType) => {
  return <SessionProvider>{children}</SessionProvider>
}

export default ClientProviders

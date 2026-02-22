'use client'

import { SessionProvider } from 'next-auth/react'

import type { ChildrenType } from '@core/types'

const ClientProviders = ({ children }: ChildrenType) => {
  return <SessionProvider>{children}</SessionProvider>
}

export default ClientProviders

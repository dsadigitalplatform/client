// Next Imports
import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import type { Metadata } from 'next'

// Component Imports
import Login from '@views/Login'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account'
}

export default async function LoginPage(props: {
  searchParams?: Promise<{ callbackUrl?: string | string[] }>
}) {
  const session = await getServerSession(authOptions)
  const sp = props.searchParams ? await props.searchParams : undefined
  const callbackUrl = sp?.callbackUrl

  if (session) {
    const isSafeRelative =
      typeof callbackUrl === 'string' && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')

    if (isSafeRelative) {
      redirect(callbackUrl!)
    }

    redirect('/post-login')
  }

  const mode = await getServerMode()


  return <Login mode={mode} callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />
}

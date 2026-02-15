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

const LoginPage = async () => {
  const session = await getServerSession(authOptions)
  if (session) redirect('/post-login')
  const mode = await getServerMode()
  return <Login mode={mode} />
}

export default LoginPage

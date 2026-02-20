import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'

import { authOptions } from '@/lib/auth'

const PostLoginPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  if ((session as any).isSuperAdmin) redirect('/home')

  const tenantIds = ((session as any).tenantIds as string[] | undefined) || []

  if (tenantIds.length === 1) {
    const host = (await headers()).get('host') || 'localhost:3000'
    const origin = process.env.NEXTAUTH_URL || `http://${host}`
    try {
      await fetch(`${origin}/api/session/tenant?redirect=/home`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tenantId: tenantIds[0] }).toString(),
        cache: 'no-store'
      })
    } catch {}
    redirect('/home')
  }

  redirect('/home')
}

export default PostLoginPage

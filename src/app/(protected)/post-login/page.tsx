import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import AutoSetTenant from '@features/auth/components/AutoSetTenant'
import { authOptions } from '@/lib/auth'

const PostLoginPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if ((session as any).isSuperAdmin) redirect('/home')
  const tenantIds = ((session as any).tenantIds as string[] | undefined) || []

  if (tenantIds.length === 1) {
    return <AutoSetTenant id={tenantIds[0]} />
  }

  redirect('/home')
}

export default PostLoginPage

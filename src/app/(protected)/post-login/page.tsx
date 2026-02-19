import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

const PostLoginPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  if ((session as any).isSuperAdmin) redirect('/home')


  const tenantIds = (session as any).tenantIds || []

  if (tenantIds.length === 0) redirect('/create-tenant')
  redirect('/home')
}

export default PostLoginPage

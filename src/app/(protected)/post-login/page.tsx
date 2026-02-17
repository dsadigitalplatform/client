import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

const PostLoginPage = async () => {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

 
  const tenantIds = (session as any).tenantIds || []

  if (tenantIds.length === 0) redirect('/admin/create-tenant')
  if (tenantIds.length === 1) redirect('/home')

  redirect('/select-tenant')
}

export default PostLoginPage

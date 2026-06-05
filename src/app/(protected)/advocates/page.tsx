import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { AdvocatesList } from '@features/advocates'
import { authOptions } from '@/lib/auth'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')

  return <AdvocatesList />
}

export default Page
